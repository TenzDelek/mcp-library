import { z } from "zod";
import { pageOf } from "../domain/pagination.js";
import { coveringSpan, linesText, truncateCodePoints } from "../domain/spans.js";
import type { LibraryClient, Span } from "@webuddhist/library-client";
import { defineTool, pageInput } from "./_shared.js";

/** Upper bound on the content window fetched to fill one page of segments. */
export const MAX_WINDOW_CHARS = 120_000;

export interface SegmentLike {
  id: string;
  lines: Span[];
}

/**
 * Fetches one content window covering `segments` and returns each segment's
 * text. Segments outside a window capped at MAX_WINDOW_CHARS get null.
 */
export async function fetchSegmentTexts(
  library: LibraryClient,
  editionId: string,
  segments: SegmentLike[],
  perSegmentMax: number,
): Promise<Map<string, { content: string | null; truncated: boolean }>> {
  const out = new Map<string, { content: string | null; truncated: boolean }>();
  const cover = coveringSpan(segments.flatMap((s) => s.lines));
  if (!cover) return out;
  const fetched: Span = { start: cover.start, end: Math.min(cover.end, cover.start + MAX_WINDOW_CHARS) };
  const content = await library.getEditionContent(editionId, fetched);
  for (const s of segments) {
    const text = linesText(content, fetched, s.lines);
    if (text === null) {
      out.set(s.id, { content: null, truncated: false });
    } else {
      const t = truncateCodePoints(text, perSegmentMax);
      out.set(s.id, { content: t.text, truncated: t.truncated });
    }
  }
  return out;
}

export const listSegments = defineTool({
  name: "list_segments",
  title: "List segments of an edition",
  description:
    "Page through the segments (paragraphs/verses) of an edition in reading order, with their text. Useful to read an edition structurally or to find segment ids for get_segment / alignment. The API gives no total count: keep following next_offset while has_more is true.",
  inputSchema: {
    edition_id: z.string().describe("Edition id."),
    offset: z.number().int().min(0).default(0).describe(pageInput.offset),
    limit: z.number().int().min(1).max(500).default(50).describe(pageInput.limit(500, 50)),
    with_content: z.boolean().default(true).describe("Include each segment's text (one extra content request)."),
    max_chars_per_segment: z.number().int().min(50).max(20000).default(2000).describe("Truncate each segment's text to this many code points (default 2000)."),
  },
  async handler({ library }, input) {
    const page = await library.listEditionSegments(input.edition_id, { limit: input.limit, offset: input.offset });
    const texts = input.with_content
      ? await fetchSegmentTexts(library, input.edition_id, page.items, input.max_chars_per_segment)
      : null;
    const items = page.items.map((s) => {
      const t = texts?.get(s.id);
      return {
        id: s.id,
        reference: s.reference ?? null,
        type: s.type,
        span: coveringSpan(s.lines),
        line_count: s.lines.length,
        ...(texts && { content: t?.content ?? null, content_truncated: t?.truncated ?? false }),
      };
    });
    return { edition_id: input.edition_id, ...pageOf(items, input.offset, page.has_more) };
  },
});
