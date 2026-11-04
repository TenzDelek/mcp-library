import { z } from "zod";
import { pickLocalized } from "../domain/localized.js";
import { pageOf } from "../domain/pagination.js";
import { resolveMany } from "../domain/resolve.js";
import { coveringSpan } from "../domain/spans.js";
import { defineTool, emptyOnNotFound, pageInput } from "./_shared.js";
import { fetchSegmentTexts } from "./list-segments.js";

export const getAlignedSegments = defineTool({
  name: "get_aligned_segments",
  title: "Read two editions side by side",
  description:
    "Segment-by-segment alignment between two editions, e.g. a Tibetan original and its English translation. Without target_edition_id it lists the editions aligned with the source (with titles and languages) so you can pick one. With target_edition_id it returns aligned pairs with the text of both sides, paginated. Alignments are stored in one direction; the server tries both and reports direction_swapped.",
  inputSchema: {
    source_edition_id: z.string().describe("Edition id to read."),
    target_edition_id: z.string().optional().describe("Edition id to align against. Omit to list available targets."),
    offset: z.number().int().min(0).default(0).describe(pageInput.offset),
    limit: z.number().int().min(1).max(500).default(25).describe(pageInput.limit(500, 25)),
    with_content: z.boolean().default(true).describe("Include the text of both segments in each pair (two extra content requests)."),
    max_chars_per_segment: z.number().int().min(50).max(20000).default(2000).describe("Truncate each segment's text (default 2000)."),
  },
  async handler({ library, config }, input) {
    const src = input.source_edition_id;

    if (!input.target_edition_id) {
      const alignments = await emptyOnNotFound(library.listEditionAlignments(src), []);
      const others = alignments.map((a) =>
        a.aligned_edition_id === src
          ? { edition_id: a.target_edition_id, text_id: a.target_text_id }
          : { edition_id: a.aligned_edition_id, text_id: a.aligned_text_id },
      );
      const texts = await resolveMany(others.map((o) => o.text_id), (id) => library.getText(id), { cap: 10 });
      return {
        source_edition_id: src,
        available_targets: others.map((o) => {
          const t = texts.get(o.text_id);
          return {
            edition_id: o.edition_id,
            text_id: o.text_id,
            title: t ? pickLocalized(t.title, config.preferredLanguages)?.value ?? null : null,
            language: t?.language ?? null,
          };
        }),
        hint: others.length
          ? "Call again with target_edition_id set to one of available_targets[].edition_id."
          : "This edition has no alignments.",
      };
    }

    const tgt = input.target_edition_id;
    const page = { limit: input.limit, offset: input.offset };
    let pairs = await emptyOnNotFound(library.listAlignedSegmentPairs(src, tgt, page), {
      items: [],
      has_more: false,
      offset: input.offset,
      limit: input.limit,
    });
    let swapped = false;
    if (pairs.items.length === 0) {
      const reverse = await emptyOnNotFound(library.listAlignedSegmentPairs(tgt, src, page), pairs);
      if (reverse.items.length > 0) {
        swapped = true;
        pairs = {
          ...reverse,
          items: reverse.items.map((p) => ({ source_segment: p.target_segment, target_segment: p.source_segment })),
        };
      }
    }

    const sourceTexts = input.with_content
      ? await fetchSegmentTexts(library, src, pairs.items.map((p) => p.source_segment), input.max_chars_per_segment)
      : null;
    const targetTexts = input.with_content
      ? await fetchSegmentTexts(library, tgt, pairs.items.map((p) => p.target_segment), input.max_chars_per_segment)
      : null;

    const side = (s: (typeof pairs.items)[number]["source_segment"], texts: typeof sourceTexts) => ({
      segment_id: s.id,
      edition_id: s.edition_id,
      reference: s.reference ?? null,
      span: coveringSpan(s.lines),
      ...(texts && { content: texts.get(s.id)?.content ?? null }),
    });

    return {
      source_edition_id: src,
      target_edition_id: tgt,
      direction_swapped: swapped,
      ...pageOf(
        pairs.items.map((p) => ({ source: side(p.source_segment, sourceTexts), target: side(p.target_segment, targetTexts) })),
        input.offset,
        pairs.has_more,
      ),
    };
  },
});
