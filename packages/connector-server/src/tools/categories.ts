import { z } from "zod";
import { pickLocalized } from "../domain/localized.js";
import type { CategoryOutput } from "@webuddhist/library-client";
import { defineTool } from "./_shared.js";

function project(c: CategoryOutput, preferred: string[]) {
  return {
    id: c.id,
    title: pickLocalized(c.title, preferred)?.value ?? null,
    description: pickLocalized(c.description, preferred)?.value ?? null,
    parent_id: c.parent_id ?? null,
    child_count: c.children.length,
  };
}

export const browseCategories = defineTool({
  name: "browse_categories",
  title: "Browse categories",
  description:
    "Navigate the category tree used to classify texts. Without category_id returns the root categories; with category_id returns that category and its children. Pass a category id to search_texts to list its texts.",
  inputSchema: {
    category_id: z.string().optional().describe("Category to show. Omit for the roots."),
    preferred_language: z.string().optional().describe("Language to prefer for titles."),
  },
  async handler({ library, config }, input) {
    const preferred = input.preferred_language ? [input.preferred_language, ...config.preferredLanguages] : config.preferredLanguages;
    if (!input.category_id) {
      const roots = await library.listCategories();
      return { category: null, children: roots.map((c) => project(c, preferred)) };
    }
    const [category, children] = await Promise.all([library.getCategory(input.category_id), library.listCategories(input.category_id)]);
    return { category: { ...project(category, preferred), titles: category.title }, children: children.map((c) => project(c, preferred)) };
  },
});
