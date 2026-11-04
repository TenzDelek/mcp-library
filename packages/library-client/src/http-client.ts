/**
 * HTTP adapter for the LibraryClient seam.
 * Owns: base URL, X-API-Key, X-Application, timeouts, one retry on 429/503,
 * response validation, redirect capture for audio, and LibraryError mapping.
 * Nothing outside this file touches the API key.
 */
import type { z } from "zod";
import type {
  ContentSearchQuery,
  LibraryClient,
  ListPersonsQuery,
  ListTextsQuery,
  PageQuery,
  RelatedSegmentsQuery,
} from "./client.js";
import { LibraryError, libraryErrorFromStatus } from "./errors.js";
import {
  BibliographicMetadataOutputSchema,
  CategoryOutputSchema,
  ContentSearchResultSchema,
  ContentStringSchema,
  EditionAlignmentOutputSchema,
  EditionAlignmentPairOutputSchema,
  EditionOutputSchema,
  HealthSchema,
  LanguageResponseSchema,
  MarkOutputSchema,
  NoteOutputSchema,
  PaginationOutputSchema,
  PersonOutputSchema,
  PresignedUrlResponseSchema,
  RecordingOutputSchema,
  SegmentOutputSchema,
  SegmentWithContextOutputSchema,
  SegmentationOutputSchema,
  TableOfContentsOutputSchema,
  TagOutputSchema,
  TextOutputSchema,
  paginatedSchema,
  type EditionType,
  type Span,
} from "./schemas.js";
import { z as zod } from "zod";

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Everything the HTTP adapter needs. The API key is only ever read here. */
export interface HttpLibraryClientOptions {
  /** Base URL of the library API, without trailing slash. */
  baseUrl: string;
  apiKey: string;
  /** Sent as X-Application on every request. */
  appName: string;
  timeoutMs: number;
}

type QueryValue = string | number | boolean | string[] | undefined | null;
type Query = Record<string, QueryValue>;

interface RequestOptions<T> {
  query?: Query;
  schema: z.ZodType<T>;
  /** Per-request timeout override (content endpoints get longer). */
  timeoutMs?: number;
}

const RETRY_STATUSES = new Set([429, 503]);
const MAX_RETRY_AFTER_MS = 5_000;

function retryDelayMs(res: Response): number {
  const header = res.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.min(Math.max(date - Date.now(), 0), MAX_RETRY_AFTER_MS);
  }
  return 1_000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Short, header-free description of a fetch failure. */
function describeNetworkError(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as { cause?: { code?: unknown } }).cause?.code;
    if (err.name === "TimeoutError" || err.name === "AbortError") return "timeout";
    return typeof code === "string" ? `${err.name} ${code}` : err.name;
  }
  return "unknown error";
}

export function createHttpLibraryClient(config: HttpLibraryClientOptions, fetchImpl: FetchLike = globalThis.fetch): LibraryClient {
  const headers: Record<string, string> = {
    "X-API-Key": config.apiKey,
    "X-Application": config.appName,
    Accept: "application/json",
  };

  function buildUrl(path: string, query?: Query): string {
    const url = new URL(config.baseUrl + path);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) {
          if (value.length) url.searchParams.set(key, value.join(","));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  async function rawFetch(path: string, query: Query | undefined, timeoutMs: number, redirect: RequestInit["redirect"]): Promise<Response> {
    const url = buildUrl(path, query);
    let attempt = 0;
    for (;;) {
      let res: Response;
      try {
        res = await fetchImpl(url, { method: "GET", headers, redirect, signal: AbortSignal.timeout(timeoutMs) });
      } catch (err) {
        throw new LibraryError({ kind: "network", method: "GET", path, detail: describeNetworkError(err) });
      }
      if (RETRY_STATUSES.has(res.status) && attempt === 0) {
        attempt++;
        await sleep(retryDelayMs(res));
        continue;
      }
      return res;
    }
  }

  async function request<T>(path: string, opts: RequestOptions<T>): Promise<T> {
    const res = await rawFetch(path, opts.query, opts.timeoutMs ?? config.timeoutMs, "follow");
    const bodyText = await res.text();
    if (!res.ok) throw libraryErrorFromStatus(res.status, "GET", path, bodyText);
    let json: unknown;
    try {
      json = bodyText === "" ? null : JSON.parse(bodyText);
    } catch {
      throw new LibraryError({ kind: "bad_response", method: "GET", path, status: res.status, detail: "body is not JSON" });
    }
    const parsed = opts.schema.safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".") || "$"}: ${i.message}`)
        .join("; ");
      throw new LibraryError({ kind: "bad_response", method: "GET", path, status: res.status, detail: issues });
    }
    return parsed.data;
  }

  const enc = encodeURIComponent;
  const contentTimeout = Math.max(config.timeoutMs, 60_000);

  return {
    health: () => request("/__/health", { schema: HealthSchema }),

    listTexts: (q: ListTextsQuery) =>
      request("/v2/texts", {
        schema: paginatedSchema(TextOutputSchema),
        query: {
          language: q.language,
          title: q.title,
          category_id: q.category_id,
          tag_id: q.tag_ids,
          tag_id_match: q.tag_id_match,
          author_id: q.author_id,
          bdrc: q.bdrc,
          wiki: q.wiki,
          limit: q.limit,
          offset: q.offset,
        },
      }),
    getText: (id) => request(`/v2/texts/${enc(id)}`, { schema: TextOutputSchema }),
    listTextEditions: (id, editionType?: EditionType) =>
      request(`/v2/texts/${enc(id)}/editions`, { schema: zod.array(EditionOutputSchema), query: { edition_type: editionType } }),

    getEdition: (id) => request(`/v2/editions/${enc(id)}`, { schema: EditionOutputSchema }),
    getEditionContent: (id, span: Span) =>
      request(`/v2/editions/${enc(id)}/content`, {
        schema: ContentStringSchema,
        query: { span_start: span.start, span_end: span.end },
        timeoutMs: contentTimeout,
      }),
    getEditionContentUrl: (id) => request(`/v2/editions/${enc(id)}/content/url`, { schema: PresignedUrlResponseSchema }),
    getEditionSegmentation: (id) => request(`/v2/editions/${enc(id)}/segmentation`, { schema: SegmentationOutputSchema }),
    listEditionSegments: (id, page: PageQuery) =>
      request(`/v2/editions/${enc(id)}/segmentation/segments`, {
        schema: paginatedSchema(SegmentOutputSchema),
        query: { limit: page.limit, offset: page.offset },
      }),
    listEditionAlignments: (id) =>
      request(`/v2/editions/${enc(id)}/alignments`, { schema: zod.array(EditionAlignmentOutputSchema) }),
    listAlignedSegmentPairs: (src, tgt, page: PageQuery) =>
      request(`/v2/editions/${enc(src)}/alignments/${enc(tgt)}`, {
        schema: paginatedSchema(EditionAlignmentPairOutputSchema),
        query: { limit: page.limit, offset: page.offset },
      }),
    getEditionPagination: (id) =>
      request(`/v2/editions/${enc(id)}/pagination`, { schema: PaginationOutputSchema.nullable() }),
    listEditionTableOfContents: (id) =>
      request(`/v2/editions/${enc(id)}/table-of-contents`, { schema: zod.array(TableOfContentsOutputSchema) }),
    listEditionBibliographic: (id) =>
      request(`/v2/editions/${enc(id)}/bibliographic`, { schema: zod.array(BibliographicMetadataOutputSchema) }),
    listEditionDurchens: (id) => request(`/v2/editions/${enc(id)}/durchens`, { schema: zod.array(NoteOutputSchema) }),
    listEditionYigchungs: (id) => request(`/v2/editions/${enc(id)}/yigchungs`, { schema: zod.array(MarkOutputSchema) }),
    listEditionRecordings: (id) => request(`/v2/editions/${enc(id)}/recordings`, { schema: zod.array(RecordingOutputSchema) }),
    listRelatedEditions: (id) => request(`/v2/editions/${enc(id)}/related`, { schema: zod.array(EditionOutputSchema) }),

    getSegment: (id) => request(`/v2/segments/${enc(id)}`, { schema: SegmentWithContextOutputSchema }),
    getSegmentContent: (id) => request(`/v2/segments/${enc(id)}/content`, { schema: ContentStringSchema }),
    listRelatedSegments: (id, q: RelatedSegmentsQuery) =>
      request(`/v2/segments/${enc(id)}/related`, {
        schema: paginatedSchema(SegmentWithContextOutputSchema),
        query: { text_id: q.text_id, edition_id: q.edition_id, language: q.language, limit: q.limit, offset: q.offset },
      }),

    searchContent: (q: ContentSearchQuery) =>
      request("/v2/content-search", {
        schema: zod.array(ContentSearchResultSchema),
        query: { query: q.query, search_type: q.search_type, limit: q.limit, text_id: q.text_id, edition_id: q.edition_id },
      }),

    listPersons: (q: ListPersonsQuery) =>
      request("/v2/persons", {
        schema: paginatedSchema(PersonOutputSchema),
        query: { name: q.name, bdrc: q.bdrc, wiki: q.wiki, limit: q.limit, offset: q.offset },
      }),
    getPerson: (id) => request(`/v2/persons/${enc(id)}`, { schema: PersonOutputSchema }),

    listCategories: (parentId?: string) =>
      request("/v2/categories", { schema: zod.array(CategoryOutputSchema), query: { parent_id: parentId } }),
    getCategory: (id) => request(`/v2/categories/${enc(id)}`, { schema: CategoryOutputSchema }),
    listTags: () => request("/v2/tags", { schema: zod.array(TagOutputSchema) }),
    listLanguages: () => request("/v2/languages", { schema: zod.array(LanguageResponseSchema) }),

    getRecording: (id) => request(`/v2/recordings/${enc(id)}`, { schema: RecordingOutputSchema }),
    getRecordingAudioUrl: async (id) => {
      const path = `/v2/recordings/${enc(id)}/audio`;
      const res = await rawFetch(path, undefined, config.timeoutMs, "manual");
      if (res.status >= 300 && res.status < 400) {
        return res.headers.get("location");
      }
      if (!res.ok) throw libraryErrorFromStatus(res.status, "GET", path, await res.text());
      // Some fetch implementations expose a manual redirect as an opaque response.
      if (res.type === "opaqueredirect") return null;
      return null;
    },
  };
}
