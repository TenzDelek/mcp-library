import { z } from "zod";
import { pickLocalized } from "../domain/localized.js";
import type { TableOfContentsSection } from "@webuddhist/library-client";
import { defineTool, emptyOnNotFound } from "./_shared.js";

const INCLUDE = z.enum(["related", "toc", "pagination", "bibliographic", "notes", "marks", "download_url"]);
const MAX_LIST = 300;

interface FlatSection {
  id: string;
  title: string | null;
  depth: number;
  span: { start: number; end: number };
}

function flattenToc(sections: TableOfContentsSection[], preferred: string[], depth = 0, out: FlatSection[] = []): FlatSection[] {
  for (const s of sections) {
    out.push({ id: s.id, title: pickLocalized(s.title, preferred)?.value ?? null, depth, span: s.span });
    if (s.subsections?.length) flattenToc(s.subsections, preferred, depth + 1, out);
  }
  return out;
}

function capList<T>(items: T[]) {
  return { items: items.slice(0, MAX_LIST), total: items.length, truncated: items.length > MAX_LIST };
}

export const getEdition = defineTool({
  name: "get_edition",
  title: "Get edition",
  description:
    "Metadata for one edition (a concrete readable version of a text) plus which other editions it is aligned with and its audio recordings. Use include to add: 'toc' (table of contents with spans you can pass to read_edition), 'pagination' (volumes/pages of the source), 'bibliographic' (colophon/incipit spans), 'notes' (durchen editorial notes), 'marks' (yigchung small-script spans), 'related' (related editions), 'download_url' (temporary URL for the full content).",
  inputSchema: {
    edition_id: z.string().describe("Edition id."),
    include: z.array(INCLUDE).default([]).describe("Optional sections to include."),
    preferred_language: z.string().optional().describe("Language to prefer when flattening titles."),
  },
  async handler({ library, config }, input) {
    const preferred = input.preferred_language ? [input.preferred_language, ...config.preferredLanguages] : config.preferredLanguages;
    const inc = new Set(input.include);
    const id = input.edition_id;

    const [edition, alignments, recordings, related, toc, pagination, bibliographic, notes, marks, downloadUrl] = await Promise.all([
      library.getEdition(id),
      emptyOnNotFound(library.listEditionAlignments(id), []),
      emptyOnNotFound(library.listEditionRecordings(id), []),
      inc.has("related") ? emptyOnNotFound(library.listRelatedEditions(id), []) : null,
      inc.has("toc") ? emptyOnNotFound(library.listEditionTableOfContents(id), []) : null,
      inc.has("pagination") ? emptyOnNotFound(library.getEditionPagination(id), null) : null,
      inc.has("bibliographic") ? emptyOnNotFound(library.listEditionBibliographic(id), []) : null,
      inc.has("notes") ? emptyOnNotFound(library.listEditionDurchens(id), []) : null,
      inc.has("marks") ? emptyOnNotFound(library.listEditionYigchungs(id), []) : null,
      inc.has("download_url") ? library.getEditionContentUrl(id) : null,
    ]);

    return {
      id: edition.id,
      text_id: edition.text_id,
      type: edition.type,
      source: edition.source ?? null,
      colophon: edition.colophon ?? null,
      incipit_title: pickLocalized(edition.incipit_title, preferred)?.value ?? null,
      bdrc: edition.bdrc ?? null,
      wiki: edition.wiki ?? null,
      aligned_editions: alignments.map((a) =>
        a.aligned_edition_id === id
          ? { edition_id: a.target_edition_id, text_id: a.target_text_id }
          : { edition_id: a.aligned_edition_id, text_id: a.aligned_text_id },
      ),
      recordings: recordings.map((r) => ({
        id: r.id,
        format: r.format,
        duration_ms: r.duration_ms ?? null,
        language: r.language ?? null,
        title: pickLocalized(r.title, preferred)?.value ?? null,
      })),
      ...(related && { related_editions: related.map((e) => ({ id: e.id, text_id: e.text_id, type: e.type, source: e.source ?? null })) }),
      ...(toc && {
        table_of_contents: capList(flattenToc(toc.flatMap((t) => t.sections), preferred)),
      }),
      ...(inc.has("pagination") && {
        pagination: pagination
          ? {
              volumes: pagination.volumes.map((v) => ({
                index: v.index ?? null,
                page_count: v.pages.length,
                first_page: v.pages[0]?.reference ?? null,
                last_page: v.pages[v.pages.length - 1]?.reference ?? null,
                span: v.pages.length
                  ? { start: Math.min(...v.pages.flatMap((p) => p.lines.map((l) => l.start))), end: Math.max(...v.pages.flatMap((p) => p.lines.map((l) => l.end))) }
                  : null,
              })),
            }
          : null,
      }),
      ...(bibliographic && { bibliographic: capList(bibliographic.map((b) => ({ id: b.id, type: b.type, span: b.span }))) }),
      ...(notes && { notes: capList(notes.map((n) => ({ id: n.id, span: n.span, text: n.text }))) }),
      ...(marks && { marks: capList(marks.map((m) => ({ id: m.id, span: m.span }))) }),
      ...(downloadUrl && { download_url: downloadUrl.url, download_url_expires_at: downloadUrl.expires_at }),
      ...(recordings.length === 0 ? {} : { recordings_hint: "Use get_recording for a playable audio URL." }),
    };
  },
});
