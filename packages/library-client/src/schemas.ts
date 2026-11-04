/**
 * zod schemas for the OpenPecha API v2 payloads this server consumes.
 * Hand-written from https://library-prod.webuddhist.com/openapi.json (v2.12.0).
 * Objects strip unknown keys, so additive upstream changes do not break us;
 * removed/renamed required fields surface as LibraryError kind "bad_response".
 */
import { z } from "zod";

export const LocalizedStringSchema = z.record(z.string(), z.string());
export type LocalizedString = z.infer<typeof LocalizedStringSchema>;

/** Half-open range in Unicode code points: [start, end). */
export const SpanSchema = z.object({ start: z.number().int().min(0), end: z.number().int().min(0) });
export type Span = z.infer<typeof SpanSchema>;

export const EditionTypeSchema = z.enum(["diplomatic", "critical", "collated"]);
export type EditionType = z.infer<typeof EditionTypeSchema>;

export const SegmentTypeSchema = z.enum(["paragraph", "verse", "title", "back_matter", "front_matter", "top_segment"]);

export const ContributionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("person"),
    id: z.string().nullish(),
    bdrc_id: z.string().nullish(),
    role: z.string(),
    name: LocalizedStringSchema.nullish(),
  }),
  z.object({ type: z.literal("ai"), id: z.string(), role: z.string() }),
]);
export type Contribution = z.infer<typeof ContributionSchema>;

export const TextOutputSchema = z.object({
  id: z.string(),
  title: LocalizedStringSchema,
  alt_titles: z.array(LocalizedStringSchema).nullish(),
  language: z.string(),
  category_id: z.string(),
  tag_ids: z.array(z.string()).default([]),
  commentary_of: z.string().nullish(),
  translation_of: z.string().nullish(),
  commentaries: z.array(z.string()).default([]),
  translations: z.array(z.string()).default([]),
  editions: z.array(z.string()).default([]),
  contributions: z.array(ContributionSchema).default([]),
  bdrc: z.string().nullish(),
  wiki: z.string().nullish(),
  date: z.string().nullish(),
  license: z.string().default("public"),
});
export type TextOutput = z.infer<typeof TextOutputSchema>;

export const EditionOutputSchema = z.object({
  id: z.string(),
  text_id: z.string(),
  type: EditionTypeSchema,
  source: z.string().nullish(),
  colophon: z.string().nullish(),
  incipit_title: LocalizedStringSchema.nullish(),
  alt_incipit_titles: z.array(LocalizedStringSchema).nullish(),
  bdrc: z.string().nullish(),
  wiki: z.string().nullish(),
});
export type EditionOutput = z.infer<typeof EditionOutputSchema>;

export const SegmentOutputSchema = z.object({
  id: z.string(),
  lines: z.array(SpanSchema),
  type: SegmentTypeSchema.default("paragraph"),
  reference: z.string().nullish(),
});
export type SegmentOutput = z.infer<typeof SegmentOutputSchema>;

export const SegmentWithContextOutputSchema = SegmentOutputSchema.extend({
  segmentation_id: z.string(),
  edition_id: z.string(),
  text_id: z.string(),
  tag_ids: z.array(z.string()).nullish(),
});
export type SegmentWithContextOutput = z.infer<typeof SegmentWithContextOutputSchema>;

export const EditionAlignmentOutputSchema = z.object({
  aligned_edition_id: z.string(),
  aligned_text_id: z.string(),
  target_edition_id: z.string(),
  target_text_id: z.string(),
});
export type EditionAlignmentOutput = z.infer<typeof EditionAlignmentOutputSchema>;

export const EditionAlignmentPairOutputSchema = z.object({
  source_segment: SegmentWithContextOutputSchema,
  target_segment: SegmentWithContextOutputSchema,
});
export type EditionAlignmentPairOutput = z.infer<typeof EditionAlignmentPairOutputSchema>;

const AnnotationMetadataSchema = z.object({ name: z.string().nullish() }).nullish();

export const SegmentationOutputSchema = z.object({
  id: z.string(),
  edition_id: z.string(),
  text_id: z.string(),
  metadata: AnnotationMetadataSchema,
});
export type SegmentationOutput = z.infer<typeof SegmentationOutputSchema>;

export interface TableOfContentsSection {
  id: string;
  title: LocalizedString;
  summary?: LocalizedString | null;
  span: Span;
  subsections?: TableOfContentsSection[];
}
export const TableOfContentsSectionSchema: z.ZodType<TableOfContentsSection> = z.lazy(() =>
  z.object({
    id: z.string(),
    title: LocalizedStringSchema,
    summary: LocalizedStringSchema.nullish(),
    span: SpanSchema,
    subsections: z.array(TableOfContentsSectionSchema).optional(),
  }),
);

export const TableOfContentsOutputSchema = z.object({
  id: z.string(),
  edition_id: z.string(),
  text_id: z.string(),
  sections: z.array(TableOfContentsSectionSchema),
  metadata: AnnotationMetadataSchema,
});
export type TableOfContentsOutput = z.infer<typeof TableOfContentsOutputSchema>;

export const PageSchema = z.object({ lines: z.array(SpanSchema), reference: z.string() });
export const VolumeSchema = z.object({
  index: z.number().int().nullish(),
  pages: z.array(PageSchema),
  metadata: AnnotationMetadataSchema,
});
export const PaginationOutputSchema = z.object({
  id: z.string(),
  edition_id: z.string(),
  text_id: z.string(),
  volumes: z.array(VolumeSchema),
  metadata: AnnotationMetadataSchema,
});
export type PaginationOutput = z.infer<typeof PaginationOutputSchema>;

export const BibliographicMetadataOutputSchema = z.object({
  id: z.string(),
  edition_id: z.string(),
  text_id: z.string(),
  span: SpanSchema,
  type: z.string(),
  metadata: AnnotationMetadataSchema,
});
export type BibliographicMetadataOutput = z.infer<typeof BibliographicMetadataOutputSchema>;

/** Durchen: an editorial note attached to a span. */
export const NoteOutputSchema = z.object({
  id: z.string(),
  edition_id: z.string(),
  text_id: z.string(),
  span: SpanSchema,
  text: z.string(),
  metadata: AnnotationMetadataSchema,
});
export type NoteOutput = z.infer<typeof NoteOutputSchema>;

/** Yigchung: a small-script mark over a span. */
export const MarkOutputSchema = z.object({
  id: z.string(),
  edition_id: z.string(),
  text_id: z.string(),
  span: SpanSchema,
  metadata: AnnotationMetadataSchema,
});
export type MarkOutput = z.infer<typeof MarkOutputSchema>;

export const RecordingOutputSchema = z.object({
  id: z.string(),
  edition_id: z.string(),
  text_id: z.string(),
  format: z.string(),
  size_bytes: z.number().int(),
  duration_ms: z.number().int().nullish(),
  title: LocalizedStringSchema.nullish(),
  language: z.string().nullish(),
  license: z.string().default("public"),
  date: z.string().nullish(),
  contributions: z.array(ContributionSchema).default([]),
});
export type RecordingOutput = z.infer<typeof RecordingOutputSchema>;

export const PresignedUrlResponseSchema = z.object({ url: z.string(), expires_at: z.string() });
export type PresignedUrlResponse = z.infer<typeof PresignedUrlResponseSchema>;

export const PersonOutputSchema = z.object({
  id: z.string(),
  name: LocalizedStringSchema,
  alt_names: z.array(LocalizedStringSchema).nullish(),
  bdrc: z.string().nullish(),
  wiki: z.string().nullish(),
});
export type PersonOutput = z.infer<typeof PersonOutputSchema>;

export const CategoryOutputSchema = z.object({
  id: z.string(),
  title: LocalizedStringSchema,
  description: LocalizedStringSchema.nullish(),
  parent_id: z.string().nullish(),
  children: z.array(z.string()).default([]),
});
export type CategoryOutput = z.infer<typeof CategoryOutputSchema>;

export const TagOutputSchema = z.object({
  id: z.string(),
  title: LocalizedStringSchema,
  description: LocalizedStringSchema.nullish(),
});
export type TagOutput = z.infer<typeof TagOutputSchema>;

export const LanguageResponseSchema = z.object({ code: z.string(), name: z.string() });
export type LanguageResponse = z.infer<typeof LanguageResponseSchema>;

export const ContentSearchSpanSchema = z.object({ start: z.number().int(), end: z.number().int() });
export const ContentSearchResultSchema = z.object({
  text_id: z.string(),
  edition_id: z.string(),
  segment_ids: z.array(z.string()).default([]),
  context_span: ContentSearchSpanSchema,
  match_span: ContentSearchSpanSchema.nullish(),
  score: z.number(),
  context: z.string(),
});
export type ContentSearchResult = z.infer<typeof ContentSearchResultSchema>;

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    has_more: z.boolean(),
    offset: z.number().int(),
    limit: z.number().int(),
  });
}
export interface Paginated<T> {
  items: T[];
  has_more: boolean;
  offset: number;
  limit: number;
}

/** Content endpoints return a JSON-encoded string body. */
export const ContentStringSchema = z.string();
export const HealthSchema = z.record(z.string(), z.unknown());
