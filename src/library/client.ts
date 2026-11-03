/**
 * LibraryClient is the one seam in this codebase: the port through which every
 * tool talks to the library API. Two adapters exist: createHttpLibraryClient
 * (production) and createFakeLibraryClient (tests). Tools never import either.
 *
 * Every method rejects with LibraryError (see errors.ts) and nothing else.
 * 404 is reported faithfully as kind "not_found"; callers decide whether that
 * means "missing" or "none" (e.g. an edition with no table of contents).
 */
import type {
  BibliographicMetadataOutput,
  CategoryOutput,
  ContentSearchResult,
  EditionAlignmentOutput,
  EditionAlignmentPairOutput,
  EditionOutput,
  EditionType,
  LanguageResponse,
  MarkOutput,
  NoteOutput,
  Paginated,
  PaginationOutput,
  PersonOutput,
  PresignedUrlResponse,
  RecordingOutput,
  SegmentOutput,
  SegmentWithContextOutput,
  SegmentationOutput,
  Span,
  TableOfContentsOutput,
  TagOutput,
  TextOutput,
} from "./schemas.js";

export interface PageQuery {
  limit?: number;
  offset?: number;
}

export interface ListTextsQuery extends PageQuery {
  language?: string;
  title?: string;
  category_id?: string;
  tag_ids?: string[];
  tag_id_match?: "all" | "any";
  author_id?: string;
  bdrc?: string;
  wiki?: string;
}

export interface ListPersonsQuery extends PageQuery {
  name?: string;
  bdrc?: string;
  wiki?: string;
}

export interface ContentSearchQuery {
  query: string;
  search_type?: "exact" | "similar";
  limit?: number;
  text_id?: string;
  edition_id?: string;
}

export interface RelatedSegmentsQuery extends PageQuery {
  text_id?: string;
  edition_id?: string;
  language?: string;
}

export interface LibraryClient {
  health(): Promise<Record<string, unknown>>;

  // Texts
  listTexts(query: ListTextsQuery): Promise<Paginated<TextOutput>>;
  getText(textId: string): Promise<TextOutput>;
  listTextEditions(textId: string, editionType?: EditionType): Promise<EditionOutput[]>;

  // Editions
  getEdition(editionId: string): Promise<EditionOutput>;
  /** Returns the content of [span.start, span.end) in Unicode code points. Always pass a span. */
  getEditionContent(editionId: string, span: Span): Promise<string>;
  getEditionContentUrl(editionId: string): Promise<PresignedUrlResponse>;
  getEditionSegmentation(editionId: string): Promise<SegmentationOutput>;
  listEditionSegments(editionId: string, page: PageQuery): Promise<Paginated<SegmentOutput>>;
  listEditionAlignments(editionId: string): Promise<EditionAlignmentOutput[]>;
  listAlignedSegmentPairs(
    sourceEditionId: string,
    targetEditionId: string,
    page: PageQuery,
  ): Promise<Paginated<EditionAlignmentPairOutput>>;
  getEditionPagination(editionId: string): Promise<PaginationOutput | null>;
  listEditionTableOfContents(editionId: string): Promise<TableOfContentsOutput[]>;
  listEditionBibliographic(editionId: string): Promise<BibliographicMetadataOutput[]>;
  listEditionDurchens(editionId: string): Promise<NoteOutput[]>;
  listEditionYigchungs(editionId: string): Promise<MarkOutput[]>;
  listEditionRecordings(editionId: string): Promise<RecordingOutput[]>;
  listRelatedEditions(editionId: string): Promise<EditionOutput[]>;

  // Segments
  getSegment(segmentId: string): Promise<SegmentWithContextOutput>;
  getSegmentContent(segmentId: string): Promise<string>;
  listRelatedSegments(segmentId: string, query: RelatedSegmentsQuery): Promise<Paginated<SegmentWithContextOutput>>;

  // Search
  searchContent(query: ContentSearchQuery): Promise<ContentSearchResult[]>;

  // Persons
  listPersons(query: ListPersonsQuery): Promise<Paginated<PersonOutput>>;
  getPerson(personId: string): Promise<PersonOutput>;

  // Reference data
  listCategories(parentId?: string): Promise<CategoryOutput[]>;
  getCategory(categoryId: string): Promise<CategoryOutput>;
  listTags(): Promise<TagOutput[]>;
  listLanguages(): Promise<LanguageResponse[]>;

  // Recordings
  getRecording(recordingId: string): Promise<RecordingOutput>;
  /** Resolves the presigned audio URL from the 307 redirect, without downloading audio. */
  getRecordingAudioUrl(recordingId: string): Promise<string | null>;
}
