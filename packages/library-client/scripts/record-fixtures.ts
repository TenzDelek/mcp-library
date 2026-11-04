/**
 * Records one real response per endpoint into test/fixtures/recorded/*.json.
 * Run by the owner with a real key:  LIBRARY_API_KEY=... npm run record-fixtures
 * The contract test then validates every recorded file against our zod schemas.
 * Bodies contain no secrets; headers are never written.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createHttpLibraryClient } from "../src/http-client.js";

const OUT = new URL("../test/fixtures/recorded/", import.meta.url);

async function save(name: string, value: unknown): Promise<void> {
  await writeFile(new URL(`${name}.json`, OUT), JSON.stringify(value, null, 2));
  console.error(`recorded ${name}`);
}

async function main(): Promise<void> {
  const apiKey = process.env.LIBRARY_API_KEY;
  if (!apiKey) throw new Error("LIBRARY_API_KEY is required");
  const lib = createHttpLibraryClient({
    baseUrl: (process.env.LIBRARY_API_URL ?? "https://library-prod.webuddhist.com").replace(/\/+$/, ""),
    apiKey,
    appName: process.env.LIBRARY_APP_NAME ?? "webuddhist",
    timeoutMs: 30_000,
  });
  await mkdir(OUT, { recursive: true });

  await save("health", await lib.health());
  await save("languages", await lib.listLanguages());
  await save("tags", await lib.listTags());
  const categories = await lib.listCategories();
  await save("categories", categories);
  if (categories[0]) await save("category", await lib.getCategory(categories[0].id));

  const texts = await lib.listTexts({ limit: 3 });
  await save("texts", texts);
  const text = texts.items[0];
  if (!text) return;
  await save("text", await lib.getText(text.id));
  const editions = await lib.listTextEditions(text.id);
  await save("text-editions", editions);
  const edition = editions[0];
  if (edition) {
    await save("edition", await lib.getEdition(edition.id));
    await save("edition-content", await lib.getEditionContent(edition.id, { start: 0, end: 200 }));
    await save("edition-content-url", { ...(await lib.getEditionContentUrl(edition.id)), url: "https://redacted.example/edition-content?sig=REDACTED" });
    const segments = await lib.listEditionSegments(edition.id, { limit: 3, offset: 0 });
    await save("edition-segments", segments);
    const seg = segments.items[0];
    if (seg) {
      await save("segment", await lib.getSegment(seg.id));
      await save("segment-content", await lib.getSegmentContent(seg.id));
      await save("segment-related", await lib.listRelatedSegments(seg.id, { limit: 3 }));
    }
    const alignments = await lib.listEditionAlignments(edition.id).catch(() => []);
    await save("edition-alignments", alignments);
    const a = alignments[0];
    if (a) {
      const other = a.aligned_edition_id === edition.id ? a.target_edition_id : a.aligned_edition_id;
      await save("edition-alignment-pairs", await lib.listAlignedSegmentPairs(edition.id, other, { limit: 3 }).catch(() => null));
    }
    await save("edition-toc", await lib.listEditionTableOfContents(edition.id).catch(() => []));
    await save("edition-pagination", await lib.getEditionPagination(edition.id).catch(() => null));
    await save("edition-bibliographic", await lib.listEditionBibliographic(edition.id).catch(() => []));
    await save("edition-durchens", await lib.listEditionDurchens(edition.id).catch(() => []));
    await save("edition-yigchungs", await lib.listEditionYigchungs(edition.id).catch(() => []));
    const recordings = await lib.listEditionRecordings(edition.id).catch(() => []);
    await save("edition-recordings", recordings);
    if (recordings[0]) await save("recording", await lib.getRecording(recordings[0].id));
    await save("edition-related", await lib.listRelatedEditions(edition.id).catch(() => []));
  }
  const persons = await lib.listPersons({ limit: 3 });
  await save("persons", persons);
  if (persons.items[0]) await save("person", await lib.getPerson(persons.items[0].id));
  await save("content-search", await lib.searchContent({ query: "བཅོམ་ལྡན་འདས", limit: 3 }).catch(() => []));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
  process.exit(1);
});
