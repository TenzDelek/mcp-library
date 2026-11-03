import { z } from "zod";
import { coveringSpan } from "../domain/spans.js";
import { resolveMany } from "../domain/resolve.js";
import { defineTool, emptyOnNotFound } from "./_shared.js";

export const getSegment = defineTool({
  name: "get_segment",
  title: "Get segment",
  description:
    "One segment (a paragraph/verse/line unit of an edition) with its text and position. Optionally include related segments in other editions, e.g. the same passage in a translation: set related_language (e.g. 'en') or related_text_id / related_edition_id. Related segments come with their text.",
  inputSchema: {
    segment_id: z.string().describe("Segment id (from search_content, list_segments, or another segment's related list)."),
    related_language: z.string().optional().describe("Also return related segments in this language (e.g. 'en' for the English translation of a Tibetan segment)."),
    related_text_id: z.string().optional().describe("Also return related segments from this text."),
    related_edition_id: z.string().optional().describe("Also return related segments from this edition."),
    related_limit: z.number().int().min(1).max(10).default(5).describe("Maximum related segments to return with text (default 5)."),
  },
  async handler({ library }, input) {
    const wantRelated = Boolean(input.related_language || input.related_text_id || input.related_edition_id);
    const [segment, content, relatedPage] = await Promise.all([
      library.getSegment(input.segment_id),
      library.getSegmentContent(input.segment_id),
      wantRelated
        ? emptyOnNotFound(
            library.listRelatedSegments(input.segment_id, {
              language: input.related_language,
              text_id: input.related_text_id,
              edition_id: input.related_edition_id,
              limit: input.related_limit,
              offset: 0,
            }),
            { items: [], has_more: false, offset: 0, limit: input.related_limit },
          )
        : Promise.resolve(null),
    ]);

    let related: unknown = undefined;
    if (relatedPage) {
      const texts = await resolveMany(relatedPage.items.map((s) => s.id), (id) => library.getSegmentContent(id), { cap: 10 });
      related = {
        items: relatedPage.items.map((s) => ({
          segment_id: s.id,
          edition_id: s.edition_id,
          text_id: s.text_id,
          reference: s.reference ?? null,
          span: coveringSpan(s.lines),
          content: texts.get(s.id) ?? null,
        })),
        has_more: relatedPage.has_more,
      };
    }

    return {
      id: segment.id,
      text_id: segment.text_id,
      edition_id: segment.edition_id,
      segmentation_id: segment.segmentation_id,
      type: segment.type,
      reference: segment.reference ?? null,
      tag_ids: segment.tag_ids ?? [],
      span: coveringSpan(segment.lines),
      lines: segment.lines,
      content,
      ...(related !== undefined && { related }),
    };
  },
});
