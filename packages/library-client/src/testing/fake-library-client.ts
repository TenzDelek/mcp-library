/**
 * In-memory adapter for the LibraryClient seam. Seeded from ./seed.ts by
 * default; every method records its call so tests can assert composition.
 */
import type { LibraryClient } from "../client.js";
import { LibraryError } from "../errors.js";
import type { Paginated } from "../schemas.js";
import * as seed from "./seed.js";

export type Seed = typeof seed;

export interface FakeLibraryClient extends LibraryClient {
  calls: Array<{ method: keyof LibraryClient; args: unknown[] }>;
  callsTo(method: keyof LibraryClient): unknown[][];
  /** Make the next call(s) to `method` reject with this error. */
  failNext(method: keyof LibraryClient, error: Error, times?: number): void;
}

function notFound(path: string): LibraryError {
  return new LibraryError({ kind: "not_found", method: "GET", path, status: 404 });
}

function page<T>(all: T[], q: { limit?: number; offset?: number }): Paginated<T> {
  const offset = q.offset ?? 0;
  const limit = q.limit ?? 20;
  const items = all.slice(offset, offset + limit);
  return { items, has_more: offset + items.length < all.length, offset, limit };
}

function sliceCp(s: string, start: number, end: number): string {
  return Array.from(s).slice(start, end).join("");
}

export function createFakeLibraryClient(overrides: Partial<Seed> = {}): FakeLibraryClient {
  const d: Seed = { ...seed, ...overrides };
  const calls: FakeLibraryClient["calls"] = [];
  const failures = new Map<keyof LibraryClient, { error: Error; times: number }>();

  const impl: LibraryClient = {
    health: async () => ({ status: "ok" }),

    listTexts: async (q) => {
      let all = d.texts;
      if (q.title) all = all.filter((t) => Object.values(t.title).some((v) => v.toLowerCase().includes(q.title!.toLowerCase())));
      if (q.language) all = all.filter((t) => t.language === q.language);
      if (q.category_id) all = all.filter((t) => t.category_id === q.category_id);
      if (q.author_id) all = all.filter((t) => t.contributions.some((c) => c.type === "person" && c.id === q.author_id));
      if (q.tag_ids?.length) all = all.filter((t) => q.tag_ids!.every((id) => t.tag_ids.includes(id)));
      return page(all, q);
    },
    getText: async (id) => d.texts.find((t) => t.id === id) ?? Promise.reject(notFound(`/v2/texts/${id}`)),
    listTextEditions: async (id, type) => {
      if (!d.texts.some((t) => t.id === id)) throw notFound(`/v2/texts/${id}/editions`);
      return d.editions.filter((e) => e.text_id === id && (!type || e.type === type));
    },

    getEdition: async (id) => d.editions.find((e) => e.id === id) ?? Promise.reject(notFound(`/v2/editions/${id}`)),
    getEditionContent: async (id, span) => {
      const c = d.contents[id];
      if (c === undefined) throw notFound(`/v2/editions/${id}/content`);
      return sliceCp(c, span.start, span.end);
    },
    getEditionContentUrl: async (id) => {
      if (!d.contents[id]) throw notFound(`/v2/editions/${id}/content/url`);
      return { url: `https://signed.example/${id}.txt`, expires_at: "2030-01-01T00:00:00Z" };
    },
    getEditionSegmentation: async (id) => {
      const e = d.editions.find((x) => x.id === id);
      if (!e) throw notFound(`/v2/editions/${id}/segmentation`);
      return { id: `SEG-${id}`, edition_id: id, text_id: e.text_id, metadata: null };
    },
    listEditionSegments: async (id, q) => {
      const list = d.segments[id];
      if (!list) throw notFound(`/v2/editions/${id}/segmentation/segments`);
      return page(list, q);
    },
    listEditionAlignments: async (id) => d.alignments[id] ?? Promise.reject(notFound(`/v2/editions/${id}/alignments`)),
    listAlignedSegmentPairs: async (src, tgt, q) => {
      const list = d.alignmentPairs[`${src}|${tgt}`];
      if (!list) return { items: [], has_more: false, offset: q.offset ?? 0, limit: q.limit ?? 500 };
      return page(list, q);
    },
    getEditionPagination: async (id) => {
      if (!d.editions.some((e) => e.id === id)) throw notFound(`/v2/editions/${id}/pagination`);
      return null;
    },
    listEditionTableOfContents: async (id) => d.toc[id] ?? Promise.reject(notFound(`/v2/editions/${id}/table-of-contents`)),
    listEditionBibliographic: async () => [],
    listEditionDurchens: async (id) => d.durchens[id] ?? Promise.reject(notFound(`/v2/editions/${id}/durchens`)),
    listEditionYigchungs: async (id) => Promise.reject(notFound(`/v2/editions/${id}/yigchungs`)),
    listEditionRecordings: async (id) => d.recordings.filter((r) => r.edition_id === id),
    listRelatedEditions: async () => [],

    getSegment: async (id) => d.segmentsById[id] ?? Promise.reject(notFound(`/v2/segments/${id}`)),
    getSegmentContent: async (id) => {
      const s = d.segmentsById[id];
      if (!s) throw notFound(`/v2/segments/${id}/content`);
      const content = d.contents[s.edition_id] ?? "";
      return s.lines.map((l) => sliceCp(content, l.start, l.end)).join("\n");
    },
    listRelatedSegments: async (id, q) => {
      let list = d.relatedSegments[id] ?? [];
      if (q.language) list = list.filter((s) => d.texts.find((t) => t.id === s.text_id)?.language === q.language);
      if (q.edition_id) list = list.filter((s) => s.edition_id === q.edition_id);
      if (q.text_id) list = list.filter((s) => s.text_id === q.text_id);
      return page(list, q);
    },

    searchContent: async (q) => d.searchResults.filter((r) => (!q.text_id || r.text_id === q.text_id) && (!q.edition_id || r.edition_id === q.edition_id)).slice(0, q.limit ?? 10),

    listPersons: async (q) => page(d.persons.filter((p) => !q.name || Object.values(p.name).some((v) => v.toLowerCase().includes(q.name!.toLowerCase()))), q),
    getPerson: async (id) => d.persons.find((p) => p.id === id) ?? Promise.reject(notFound(`/v2/persons/${id}`)),

    listCategories: async (parentId) => d.categories.filter((c) => (parentId ? c.parent_id === parentId : c.parent_id === null)),
    getCategory: async (id) => d.categories.find((c) => c.id === id) ?? Promise.reject(notFound(`/v2/categories/${id}`)),
    listTags: async () => d.tags,
    listLanguages: async () => d.languages,

    getRecording: async (id) => d.recordings.find((r) => r.id === id) ?? Promise.reject(notFound(`/v2/recordings/${id}`)),
    getRecordingAudioUrl: async (id) => d.audioUrls[id] ?? null,
  };

  const recorded = Object.fromEntries(
    (Object.keys(impl) as Array<keyof LibraryClient>).map((method) => [
      method,
      async (...args: unknown[]) => {
        calls.push({ method, args });
        const f = failures.get(method);
        if (f && f.times > 0) {
          f.times--;
          throw f.error;
        }
        return (impl[method] as (...a: unknown[]) => Promise<unknown>)(...args);
      },
    ]),
  ) as unknown as LibraryClient;

  return {
    ...recorded,
    calls,
    callsTo: (method) => calls.filter((c) => c.method === method).map((c) => c.args),
    failNext: (method, error, times = 1) => failures.set(method, { error, times }),
  };
}
