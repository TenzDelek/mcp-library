import { z } from "zod";
import { pageOf } from "../domain/pagination.js";
import { defineTool, pageInput, projectTextSummary } from "./_shared.js";

export const searchTexts = defineTool({
  name: "search_texts",
  title: "Search texts",
  description:
    "Find texts (works) in the library by title and/or filters. A text has one or more editions (actual readable versions); use get_text to see them, then read_edition to read. Translations and commentaries are separate texts linked by translation_of / commentary_of. Results are paginated: follow next_offset while has_more is true. Totals are not available.",
  inputSchema: {
    title: z.string().min(2).optional().describe("Title search, at least 2 characters. Matches any language of the title."),
    language: z.string().optional().describe("Language code of the text, e.g. 'bo' (Tibetan), 'en', 'zh', 'sa'. See list_languages."),
    category_id: z.string().optional().describe("Restrict to a category (see browse_categories)."),
    tag_ids: z.array(z.string()).optional().describe("Restrict to texts carrying these tag ids (see list_tags)."),
    tag_match: z.enum(["all", "any"]).optional().describe("Whether a text must have all of tag_ids or any of them (default all)."),
    author_id: z.string().optional().describe("Person id of an author/contributor (see search_persons)."),
    bdrc: z.string().optional().describe("BDRC identifier of the text."),
    wiki: z.string().optional().describe("Wikidata identifier of the text."),
    limit: z.number().int().min(1).max(100).default(20).describe(pageInput.limit(100, 20)),
    offset: z.number().int().min(0).default(0).describe(pageInput.offset),
    preferred_language: z.string().optional().describe("Language to prefer when flattening titles (default from server config, e.g. en then bo)."),
  },
  async handler({ library, config }, input) {
    const preferred = input.preferred_language ? [input.preferred_language, ...config.preferredLanguages] : config.preferredLanguages;
    const page = await library.listTexts({
      title: input.title,
      language: input.language,
      category_id: input.category_id,
      tag_ids: input.tag_ids,
      tag_id_match: input.tag_match,
      author_id: input.author_id,
      bdrc: input.bdrc,
      wiki: input.wiki,
      limit: input.limit,
      offset: input.offset,
    });
    return pageOf(page.items.map((t) => projectTextSummary(t, preferred)), input.offset, page.has_more);
  },
});
