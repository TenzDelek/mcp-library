/**
 * Opt-in live smoke test against the real library. Needs LIBRARY_API_KEY.
 *   LIBRARY_API_KEY=... npm run test:live
 */
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config.js";
import { createHttpLibraryClient } from "../../src/library/http-client.js";
import { readEdition } from "../../src/tools/read-edition.js";
import { searchTexts } from "../../src/tools/search-texts.js";

const hasKey = Boolean(process.env.LIBRARY_API_KEY);

describe.skipIf(!hasKey)("live library", () => {
  const config = hasKey ? loadConfig() : null;
  const library = config ? createHttpLibraryClient(config) : null;
  const deps = { library: library!, config: { preferredLanguages: config?.preferredLanguages ?? ["en"] } };

  it("health + key accepted", async () => {
    expect(await library!.health()).toBeTypeOf("object");
    expect((await library!.listLanguages()).length).toBeGreaterThan(0);
  });

  it("search_texts -> read_edition round trip", async () => {
    const page = (await searchTexts.handler(deps, { limit: 3, offset: 0 } as never)) as { items: Array<{ id: string }> };
    expect(page.items.length).toBeGreaterThan(0);
    const read = (await readEdition.handler(deps, { text_id: page.items[0]!.id, span_start: 0, max_chars: 300 } as never)) as {
      content: string;
      edition_id: string;
    };
    expect(read.edition_id).toBeTruthy();
    expect(read.content.length).toBeGreaterThan(0);
  });

  it("categories and tags accept X-Application", async () => {
    expect(Array.isArray(await library!.listCategories())).toBe(true);
    expect(Array.isArray(await library!.listTags())).toBe(true);
  });
});
