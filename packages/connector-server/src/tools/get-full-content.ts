import { z } from "zod";
import { fetchAllSegments } from "../domain/all-segments.js";
import { codePointLength, coveringSpan, linesText, truncateCodePoints } from "../domain/spans.js";
import { LibraryError, EditionTypeSchema, type Span } from "@webuddhist/library-client";
import { defineTool, pickEdition } from "./_shared.js";

export const DEFAULT_FULL_MAX_CHARS = 200_000;
export const MAX_FULL_MAX_CHARS = 1_000_000;

export const getFullContent = defineTool({
  name: "get_full_content",
  title: "Get the full content of a text",
  description:
    "Fetch the complete text of an edition in one call. Give a text_id (the server picks an edition: edition_type if given, else critical > diplomatic > collated) or an edition_id. The server pages through all segments, takes the span from the first segment's start to the last segment's end, and fetches that content. format 'text' (default) restores line breaks and blank lines between segments from the segment spans; 'segments' returns one entry per segment with reference and content; 'raw' returns the unbroken string as stored. Long editions are cut at max_chars with truncated=true; use read_edition with span_start to continue.",
  inputSchema: {
    text_id: z.string().optional().describe("Text id. The edition is chosen automatically."),
    edition_id: z.string().optional().describe("Edition id. Takes precedence over text_id."),
    edition_type: EditionTypeSchema.optional().describe("With text_id: which edition type to pick."),
    format: z.enum(["text", "segments", "raw"]).default("text").describe("Output shape (default text)."),
    max_chars: z
      .number()
      .int()
      .min(1000)
      .max(MAX_FULL_MAX_CHARS)
      .default(DEFAULT_FULL_MAX_CHARS)
      .describe(`Maximum code points of content to return (default ${DEFAULT_FULL_MAX_CHARS}).`),
  },
  async handler({ library }, input) {
    let editionId = input.edition_id;
    let textId: string | null = input.text_id ?? null;

    if (!editionId) {
      if (!textId) {
        throw new LibraryError({ kind: "validation", method: "GET", path: "/v2/editions/{id}/content", detail: "provide text_id or edition_id" });
      }
      const editions = await library.listTextEditions(textId, input.edition_type);
      const picked = pickEdition(editions, input.edition_type);
      if (!picked) {
        throw new LibraryError({
          kind: "not_found",
          method: "GET",
          path: `/v2/texts/${textId}/editions`,
          detail: input.edition_type ? `text has no ${input.edition_type} edition` : "text has no editions",
        });
      }
      editionId = picked.id;
    }

    const { segments, incomplete } = await fetchAllSegments(library, editionId);
    const cover = coveringSpan(segments.flatMap((s) => s.lines));
    // Editions without segmentation: read from the start instead.
    const span: Span = cover ?? { start: 0, end: input.max_chars };
    const capped = span.end - span.start > input.max_chars;
    const fetched: Span = capped ? { start: span.start, end: span.start + input.max_chars } : span;
    const raw = await library.getEditionContent(editionId, fetched);
    const fetchedLength = codePointLength(raw);
    const actual: Span = { start: fetched.start, end: fetched.start + fetchedLength };

    if (!textId) {
      try {
        textId = (await library.getEdition(editionId)).text_id;
      } catch {
        textId = null;
      }
    }

    const base = {
      edition_id: editionId,
      text_id: textId,
      segment_count: segments.length,
      span: actual,
      char_count: fetchedLength,
      truncated: capped,
      segments_incomplete: incomplete,
      next_span_start: capped ? actual.end : null,
      format: input.format,
    };

    if (input.format === "raw" || segments.length === 0) {
      const { text } = truncateCodePoints(raw, input.max_chars);
      return { ...base, content: text };
    }

    const perSegment = segments.map((s) => ({
      id: s.id,
      reference: s.reference ?? null,
      type: s.type,
      span: coveringSpan(s.lines)!,
      content: linesText(raw, actual, s.lines),
    }));
    const covered = perSegment.filter((s) => s.content !== null);

    if (input.format === "segments") {
      return { ...base, segments: covered };
    }
    return { ...base, content: covered.map((s) => s.content).join("\n\n") };
  },
});
