import { z } from "zod";
import { codePointLength, truncateCodePoints } from "../domain/spans.js";
import { EditionTypeSchema } from "../library/schemas.js";
import { LibraryError } from "../library/errors.js";
import { defineTool, pickEdition } from "./_shared.js";

export const DEFAULT_MAX_CHARS = 6000;
export const MAX_MAX_CHARS = 20000;

const CONTENT_PATH = "/v2/editions/{id}/content";

export const readEdition = defineTool({
  name: "read_edition",
  title: "Read edition content",
  description:
    "Read the text of an edition as plain text, a window at a time. Give an edition_id (preferred) or a text_id (the server picks an edition: edition_type if given, else critical > diplomatic > collated). Positions are Unicode code points, end-exclusive. If truncated is true, call again with span_start = next_span_start. Editions can be very long; use search_content or list_segments to locate passages instead of reading linearly.",
  inputSchema: {
    edition_id: z.string().optional().describe("Edition id (from get_text.editions, search_content, or list_segments)."),
    text_id: z.string().optional().describe("Text id; used only when edition_id is not given."),
    edition_type: EditionTypeSchema.optional().describe("With text_id: which edition type to pick."),
    span_start: z.number().int().min(0).default(0).describe("Start position in code points (default 0)."),
    span_end: z.number().int().min(1).optional().describe("End position, exclusive. Default: span_start + max_chars."),
    max_chars: z
      .number()
      .int()
      .min(100)
      .max(MAX_MAX_CHARS)
      .default(DEFAULT_MAX_CHARS)
      .describe(`Maximum code points to return (default ${DEFAULT_MAX_CHARS}, max ${MAX_MAX_CHARS}).`),
  },
  async handler({ library }, input) {
    let editionId = input.edition_id;
    let textId: string | null = input.text_id ?? null;

    if (!editionId) {
      if (!textId) {
        throw new LibraryError({ kind: "validation", method: "GET", path: CONTENT_PATH, detail: "provide edition_id or text_id" });
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

    const start = input.span_start;
    if (input.span_end !== undefined && input.span_end <= start) {
      throw new LibraryError({ kind: "validation", method: "GET", path: CONTENT_PATH, detail: "span_end must be greater than span_start" });
    }
    const requestedLen = input.span_end !== undefined ? input.span_end - start : input.max_chars;
    const window = Math.min(requestedLen, input.max_chars);
    const cappedByMaxChars = requestedLen > input.max_chars;
    // When the caller did not pin the end (or we capped it), ask for one extra
    // code point so "content continues" is detectable in a single request.
    const probe = input.span_end === undefined || cappedByMaxChars ? 1 : 0;
    const raw = await library.getEditionContent(editionId, { start, end: start + window + probe });
    const rawLength = codePointLength(raw);
    const { text } = truncateCodePoints(raw, window);
    const end = start + codePointLength(text);
    const truncated = probe === 1 && rawLength > window;
    const reached_end = rawLength < window + probe;

    if (!textId) {
      try {
        textId = (await library.getEdition(editionId)).text_id;
      } catch {
        textId = null;
      }
    }

    return {
      edition_id: editionId,
      text_id: textId,
      span: { start, end },
      content: text,
      truncated,
      reached_end,
      next_span_start: truncated ? end : null,
      hint: truncated
        ? `Content continues. Call read_edition again with span_start=${end}.`
        : reached_end
          ? "This is the end of the edition."
          : null,
    };
  },
});
