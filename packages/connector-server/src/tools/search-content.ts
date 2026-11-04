import { z } from "zod";
import { pickLocalized } from "../domain/localized.js";
import { resolveMany } from "../domain/resolve.js";
import { defineTool } from "./_shared.js";

export const searchContent = defineTool({
  name: "search_content",
  title: "Search inside texts",
  description:
    "Full-text search inside the content of editions (not titles; use search_texts for titles). Returns matching passages with context, the text/edition they belong to, and the segment ids covering the match (pass to get_segment). search_type 'exact' matches the literal string; 'similar' is a fuzzy/semantic match. Optionally restrict to one text or edition.",
  inputSchema: {
    query: z.string().min(1).describe("Search string, in the script of the text (e.g. Tibetan Unicode for Tibetan editions)."),
    search_type: z.enum(["exact", "similar"]).default("exact").describe("exact (default) or similar."),
    text_id: z.string().optional().describe("Restrict to this text."),
    edition_id: z.string().optional().describe("Restrict to this edition."),
    limit: z.number().int().min(1).max(100).default(10).describe("Maximum results, 1-100 (default 10)."),
    include_titles: z.boolean().default(true).describe("Resolve the title of each matched text (up to 10 lookups)."),
  },
  async handler({ library, config }, input) {
    const results = await library.searchContent({
      query: input.query,
      search_type: input.search_type,
      text_id: input.text_id,
      edition_id: input.edition_id,
      limit: input.limit,
    });
    const titles = input.include_titles
      ? await resolveMany(results.map((r) => r.text_id), (id) => library.getText(id), { cap: 10 })
      : new Map();
    return {
      query: input.query,
      search_type: input.search_type,
      results: results.map((r) => {
        const t = titles.get(r.text_id);
        return {
          text_id: r.text_id,
          text_title: t ? pickLocalized(t.title, config.preferredLanguages)?.value ?? null : null,
          text_language: t?.language ?? null,
          edition_id: r.edition_id,
          score: r.score,
          context: r.context,
          context_span: r.context_span,
          match_span: r.match_span ?? null,
          segment_ids: r.segment_ids,
        };
      }),
    };
  },
});
