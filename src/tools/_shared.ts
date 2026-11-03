import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import type { ToolConfig } from "../config.js";
import type { LibraryClient } from "../library/client.js";
import { isLibraryError, isNotFound, type LibraryError } from "../library/errors.js";
import type { Contribution, EditionOutput, EditionType, LocalizedString, TextOutput } from "../library/schemas.js";
import { pickLocalized } from "../domain/localized.js";
import { log } from "../log.js";

export interface ToolDeps {
  library: LibraryClient;
  config: ToolConfig;
}

export interface ToolDef<S extends z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  inputSchema: S;
  handler: (deps: ToolDeps, input: z.infer<z.ZodObject<S>>) => Promise<unknown>;
}

/** Identity helper that pins the generic so handlers get typed input. */
export function defineTool<S extends z.ZodRawShape>(def: ToolDef<S>): ToolDef<S> {
  return def;
}

export function jsonResult(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 1) }] };
}

export function errorResult(text: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text }] };
}

/** Human-facing text for a LibraryError. Contains no header or key material by construction. */
export function describeLibraryError(e: LibraryError, entity?: { kind: string; id: string }): string {
  switch (e.kind) {
    case "unauthorized":
      return "The library rejected this server's API key. This is a server configuration problem (LIBRARY_API_KEY); it cannot be fixed by changing tool arguments.";
    case "not_found":
      return entity
        ? `No ${entity.kind} with id '${entity.id}'. Check that the id came from a previous search_texts / get_text / list_segments result.`
        : `Not found: GET ${e.path}.`;
    case "validation":
      return `The library rejected the request parameters${e.detail ? `: ${e.detail}` : ""}. Adjust the arguments and retry.`;
    case "rate_limited":
      return "The library rate-limited this request (HTTP 429) even after one retry. Wait a few seconds and try again.";
    case "upstream":
      return `The library returned HTTP ${e.status ?? "5xx"} for GET ${e.path}. This is usually transient; retry once.`;
    case "network":
      return `Could not reach the library (${e.detail ?? "network error"}). Retry; if it persists, LIBRARY_API_URL may be wrong or the service is down.`;
    case "bad_response":
      return `The library returned an unexpected response shape for GET ${e.path}${e.detail ? ` (${e.detail})` : ""}. This MCP server needs a schema update.`;
  }
}

/**
 * Wraps a tool handler: LibraryError -> isError result with actionable text;
 * anything else -> generic isError result (logged to stderr, never thrown to the client).
 */
export function runTool<S extends z.ZodRawShape>(
  def: ToolDef<S>,
  deps: ToolDeps,
  input: z.infer<z.ZodObject<S>>,
): Promise<CallToolResult> {
  return def
    .handler(deps, input)
    .then(jsonResult)
    .catch((err: unknown) => {
      if (isLibraryError(err)) {
        const entity = entityFromInput(input);
        log.warn(`tool ${def.name} failed`, { kind: err.kind, status: err.status, path: err.path });
        return errorResult(describeLibraryError(err, err.kind === "not_found" ? entity : undefined));
      }
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      log.error(`tool ${def.name} crashed`, { error: msg });
      return errorResult(`Internal error in tool ${def.name}: ${msg}`);
    });
}

const ID_FIELDS: Array<[string, string]> = [
  ["text_id", "text"],
  ["edition_id", "edition"],
  ["source_edition_id", "edition"],
  ["target_edition_id", "edition"],
  ["segment_id", "segment"],
  ["person_id", "person"],
  ["category_id", "category"],
  ["recording_id", "recording"],
];

function entityFromInput(input: unknown): { kind: string; id: string } | undefined {
  if (!input || typeof input !== "object") return undefined;
  for (const [field, kind] of ID_FIELDS) {
    const v = (input as Record<string, unknown>)[field];
    if (typeof v === "string" && v) return { kind, id: v };
  }
  return undefined;
}

/** For optional sub-resources where the API answers 404 meaning "none". */
export async function emptyOnNotFound<T>(promise: Promise<T>, empty: T): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    if (isNotFound(e)) return empty;
    throw e;
  }
}

/* ---------- compact projections shared by several tools ---------- */

export interface Localized {
  value: string | null;
  lang: string | null;
}

export function loc(ls: LocalizedString | null | undefined, preferred: string[]): Localized {
  const p = pickLocalized(ls, preferred);
  return { value: p?.value ?? null, lang: p?.lang ?? null };
}

export function projectTextSummary(t: TextOutput, preferred: string[]) {
  const title = pickLocalized(t.title, preferred);
  return {
    id: t.id,
    title: title?.value ?? null,
    title_lang: title?.lang ?? null,
    language: t.language,
    category_id: t.category_id,
    tag_ids: t.tag_ids,
    translation_of: t.translation_of ?? null,
    commentary_of: t.commentary_of ?? null,
    edition_count: t.editions.length,
    translation_count: t.translations.length,
    commentary_count: t.commentaries.length,
  };
}

export function projectEditionSummary(e: EditionOutput, preferred: string[]) {
  return {
    id: e.id,
    text_id: e.text_id,
    type: e.type,
    source: e.source ?? null,
    incipit_title: pickLocalized(e.incipit_title, preferred)?.value ?? null,
  };
}

export function projectContributors(contributions: Contribution[], preferred: string[]) {
  return contributions.map((c) =>
    c.type === "person"
      ? {
          type: "person" as const,
          role: c.role,
          person_id: c.id ?? null,
          bdrc_id: c.bdrc_id ?? null,
          name: pickLocalized(c.name, preferred)?.value ?? null,
        }
      : { type: "ai" as const, role: c.role, id: c.id },
  );
}

const EDITION_PREFERENCE: EditionType[] = ["critical", "diplomatic", "collated"];

/** Picks the edition to read when the caller only knows a text id. */
export function pickEdition(editions: EditionOutput[], wanted?: EditionType): EditionOutput | undefined {
  if (wanted) return editions.find((e) => e.type === wanted);
  for (const type of EDITION_PREFERENCE) {
    const hit = editions.find((e) => e.type === type);
    if (hit) return hit;
  }
  return editions[0];
}

export const pageInput = {
  limit: (max: number, def: number) => `Page size, 1-${max} (default ${def}).`,
  offset: "Number of items to skip (default 0). Use next_offset from the previous page.",
};
