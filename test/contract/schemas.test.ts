/**
 * Validates recorded real responses (test/fixtures/recorded/*.json, produced by
 * `npm run record-fixtures`) against our zod schemas. Skips files that are absent.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as S from "../../src/library/schemas.js";

const DIR = new URL("../fixtures/recorded/", import.meta.url);

const SCHEMAS: Record<string, z.ZodTypeAny> = {
  health: S.HealthSchema,
  languages: z.array(S.LanguageResponseSchema),
  tags: z.array(S.TagOutputSchema),
  categories: z.array(S.CategoryOutputSchema),
  category: S.CategoryOutputSchema,
  texts: S.paginatedSchema(S.TextOutputSchema),
  text: S.TextOutputSchema,
  "text-editions": z.array(S.EditionOutputSchema),
  edition: S.EditionOutputSchema,
  "edition-content": S.ContentStringSchema,
  "edition-content-url": S.PresignedUrlResponseSchema,
  "edition-segments": S.paginatedSchema(S.SegmentOutputSchema),
  segment: S.SegmentWithContextOutputSchema,
  "segment-content": S.ContentStringSchema,
  "segment-related": S.paginatedSchema(S.SegmentWithContextOutputSchema),
  "edition-alignments": z.array(S.EditionAlignmentOutputSchema),
  "edition-alignment-pairs": S.paginatedSchema(S.EditionAlignmentPairOutputSchema).nullable(),
  "edition-toc": z.array(S.TableOfContentsOutputSchema),
  "edition-pagination": S.PaginationOutputSchema.nullable(),
  "edition-bibliographic": z.array(S.BibliographicMetadataOutputSchema),
  "edition-durchens": z.array(S.NoteOutputSchema),
  "edition-yigchungs": z.array(S.MarkOutputSchema),
  "edition-recordings": z.array(S.RecordingOutputSchema),
  recording: S.RecordingOutputSchema,
  "edition-related": z.array(S.EditionOutputSchema),
  persons: S.paginatedSchema(S.PersonOutputSchema),
  person: S.PersonOutputSchema,
  "content-search": z.array(S.ContentSearchResultSchema),
};

const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".json")) : [];

describe("recorded fixtures match schemas", () => {
  if (files.length === 0) {
    it.skip("no recorded fixtures (run `npm run record-fixtures` with LIBRARY_API_KEY)", () => {});
    return;
  }
  for (const file of files) {
    const name = file.replace(/\.json$/, "");
    const schema = SCHEMAS[name];
    it(name, () => {
      expect(schema, `no schema registered for fixture ${name}`).toBeDefined();
      const data = JSON.parse(readFileSync(new URL(file, DIR), "utf8"));
      const result = schema!.safeParse(data);
      expect(result.success, result.success ? "" : JSON.stringify(result.error.issues.slice(0, 5), null, 1)).toBe(true);
    });
  }
});
