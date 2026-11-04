import { z } from "zod";
import { pickLocalized } from "../domain/localized.js";
import { resolveMany } from "../domain/resolve.js";
import { getTextFamily } from "../domain/text-family.js";
import { defineTool, projectContributors, projectEditionSummary } from "./_shared.js";

export const getText = defineTool({
  name: "get_text",
  title: "Get text",
  description:
    "Full record for one text: all titles, language, category, contributors (authors, translators), its editions (pass an edition id to read_edition / list_segments), and the titles of its translations and commentaries. Set include_family to also see the original this text translates and all sibling translations.",
  inputSchema: {
    text_id: z.string().describe("Text id, e.g. from search_texts or search_content."),
    include_related: z.boolean().default(true).describe("Resolve titles of translations and commentaries (up to 10 lookups)."),
    include_family: z.boolean().default(false).describe("Walk translation_of to the original and list all translations of it."),
    preferred_language: z.string().optional().describe("Language to prefer when flattening titles."),
  },
  async handler({ library, config }, input) {
    const preferred = input.preferred_language ? [input.preferred_language, ...config.preferredLanguages] : config.preferredLanguages;
    const [text, editions] = await Promise.all([library.getText(input.text_id), library.listTextEditions(input.text_id)]);

    const relatedIds = input.include_related ? [...text.translations, ...text.commentaries] : [];
    const related = await resolveMany(relatedIds, (id) => library.getText(id), { cap: 10 });
    const summarize = (id: string) => {
      const t = related.get(id);
      return t
        ? { id, title: pickLocalized(t.title, preferred)?.value ?? null, language: t.language }
        : { id, title: null, language: null };
    };

    const family = input.include_family ? await getTextFamily((id) => library.getText(id), text) : undefined;

    return {
      id: text.id,
      title: pickLocalized(text.title, preferred)?.value ?? null,
      titles: text.title,
      alt_titles: text.alt_titles ?? [],
      language: text.language,
      category_id: text.category_id,
      tag_ids: text.tag_ids,
      date: text.date ?? null,
      license: text.license,
      bdrc: text.bdrc ?? null,
      wiki: text.wiki ?? null,
      translation_of: text.translation_of ?? null,
      commentary_of: text.commentary_of ?? null,
      contributors: projectContributors(text.contributions, preferred),
      editions: editions.map((e) => ({ ...projectEditionSummary(e, preferred), colophon: e.colophon ?? null })),
      translations: text.translations.map(summarize),
      commentaries: text.commentaries.map(summarize),
      ...(family && {
        family: {
          root: { id: family.root.id, title: pickLocalized(family.root.title, preferred)?.value ?? null, language: family.root.language },
          translations: family.translations.map((t) => ({
            id: t.id,
            title: pickLocalized(t.title, preferred)?.value ?? null,
            language: t.language,
          })),
          unresolved_translation_ids: family.unresolved_translation_ids,
        },
      }),
    };
  },
});
