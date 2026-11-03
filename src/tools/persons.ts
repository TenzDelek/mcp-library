import { z } from "zod";
import { pickLocalized } from "../domain/localized.js";
import { pageOf } from "../domain/pagination.js";
import { defineTool, pageInput, projectTextSummary } from "./_shared.js";

export const searchPersons = defineTool({
  name: "search_persons",
  title: "Search persons",
  description: "Find people (authors, translators, teachers) by name or BDRC/Wikidata id. Paginated. Use get_person for details and their texts.",
  inputSchema: {
    name: z.string().min(2).optional().describe("Name search, at least 2 characters, any language."),
    bdrc: z.string().optional().describe("BDRC person id."),
    wiki: z.string().optional().describe("Wikidata id."),
    limit: z.number().int().min(1).max(100).default(20).describe(pageInput.limit(100, 20)),
    offset: z.number().int().min(0).default(0).describe(pageInput.offset),
  },
  async handler({ library, config }, input) {
    const page = await library.listPersons({ name: input.name, bdrc: input.bdrc, wiki: input.wiki, limit: input.limit, offset: input.offset });
    return pageOf(
      page.items.map((p) => ({
        id: p.id,
        name: pickLocalized(p.name, config.preferredLanguages)?.value ?? null,
        names: p.name,
        bdrc: p.bdrc ?? null,
        wiki: p.wiki ?? null,
      })),
      input.offset,
      page.has_more,
    );
  },
});

export const getPerson = defineTool({
  name: "get_person",
  title: "Get person",
  description: "One person's record (all name forms, BDRC/Wikidata ids) and the first page of texts they contributed to.",
  inputSchema: {
    person_id: z.string().describe("Person id (from search_persons or get_text.contributors)."),
    include_texts: z.boolean().default(true).describe("Include texts where this person is a contributor."),
    texts_limit: z.number().int().min(1).max(100).default(20).describe("How many texts to include (default 20)."),
    texts_offset: z.number().int().min(0).default(0).describe("Offset into the person's texts."),
  },
  async handler({ library, config }, input) {
    const [person, texts] = await Promise.all([
      library.getPerson(input.person_id),
      input.include_texts ? library.listTexts({ author_id: input.person_id, limit: input.texts_limit, offset: input.texts_offset }) : null,
    ]);
    return {
      id: person.id,
      name: pickLocalized(person.name, config.preferredLanguages)?.value ?? null,
      names: person.name,
      alt_names: person.alt_names ?? [],
      bdrc: person.bdrc ?? null,
      wiki: person.wiki ?? null,
      ...(texts && { texts: pageOf(texts.items.map((t) => projectTextSummary(t, config.preferredLanguages)), input.texts_offset, texts.has_more) }),
    };
  },
});
