import { pickLocalized } from "../domain/localized.js";
import { defineTool } from "./_shared.js";

export const listTags = defineTool({
  name: "list_tags",
  title: "List tags",
  description: "All tags that can be applied to texts (e.g. chant, liturgy). Pass tag ids to search_texts.tag_ids.",
  inputSchema: {},
  async handler({ library, config }) {
    const tags = await library.listTags();
    return {
      tags: tags.map((t) => ({
        id: t.id,
        title: pickLocalized(t.title, config.preferredLanguages)?.value ?? null,
        titles: t.title,
        description: pickLocalized(t.description, config.preferredLanguages)?.value ?? null,
      })),
    };
  },
});

export const listLanguages = defineTool({
  name: "list_languages",
  title: "List languages",
  description: "Language codes used by the library (for search_texts.language, get_segment.related_language).",
  inputSchema: {},
  async handler({ library }) {
    return { languages: await library.listLanguages() };
  },
});
