/**
 * Hand-written seed data shaped like real API payloads. Two texts (a Tibetan
 * original and its English translation), one edition each, aligned segments,
 * one person, categories, tags, languages, one recording.
 *
 * English content is exactly 60 code points; Tibetan length is computed in tests.
 */
import type {
  CategoryOutput,
  ContentSearchResult,
  EditionAlignmentOutput,
  EditionAlignmentPairOutput,
  EditionOutput,
  LanguageResponse,
  NoteOutput,
  PersonOutput,
  RecordingOutput,
  SegmentOutput,
  SegmentWithContextOutput,
  TableOfContentsOutput,
  TagOutput,
  TextOutput,
} from "../../src/library/schemas.js";

export const BO_CONTENT = "བཅོམ་ལྡན་འདས་མ་ཤེས་རབ་ཀྱི་ཕ་རོལ་ཏུ་ཕྱིན་པ"; // 30 code points? computed in tests
export const EN_CONTENT = "Homage to the Bhagavati Prajnaparamita. Thus have I heard.Om"; // exactly 60 code points

export const texts: TextOutput[] = [
  {
    id: "T1",
    title: { bo: "ཤེས་རབ་སྙིང་པོ", en: "Heart Sutra" },
    alt_titles: null,
    language: "bo",
    category_id: "C2",
    tag_ids: ["TAG1"],
    commentary_of: null,
    translation_of: null,
    commentaries: [],
    translations: ["T2"],
    editions: ["E1"],
    contributions: [{ type: "person", id: "P1", bdrc_id: "P0001", role: "author", name: { en: "Nagarjuna" } }],
    bdrc: "W0001",
    wiki: null,
    date: null,
    license: "public",
  },
  {
    id: "T2",
    title: { en: "The Heart of the Perfection of Wisdom" },
    alt_titles: null,
    language: "en",
    category_id: "C2",
    tag_ids: [],
    commentary_of: null,
    translation_of: "T1",
    commentaries: [],
    translations: [],
    editions: ["E2"],
    contributions: [{ type: "ai", id: "AI1", role: "translator" }],
    bdrc: null,
    wiki: null,
    date: "2024",
    license: "cc-by",
  },
];

export const editions: EditionOutput[] = [
  { id: "E1", text_id: "T1", type: "diplomatic", source: "Derge", colophon: null, incipit_title: null, alt_incipit_titles: null, bdrc: null, wiki: null },
  { id: "E2", text_id: "T2", type: "critical", source: "84000", colophon: null, incipit_title: { en: "Heart Sutra" }, alt_incipit_titles: null, bdrc: null, wiki: null },
];

export const contents: Record<string, string> = { E1: BO_CONTENT, E2: EN_CONTENT };

export const segments: Record<string, SegmentOutput[]> = {
  E1: [
    { id: "S1", lines: [{ start: 0, end: 12 }], type: "verse", reference: "1" },
    { id: "S2", lines: [{ start: 12, end: 30 }], type: "verse", reference: "2" },
  ],
  E2: [
    { id: "S3", lines: [{ start: 0, end: 40 }], type: "paragraph", reference: "1" },
    { id: "S4", lines: [{ start: 40, end: 60 }], type: "paragraph", reference: "2" },
  ],
};

function withContext(editionId: string, s: SegmentOutput): SegmentWithContextOutput {
  const edition = editions.find((e) => e.id === editionId)!;
  return { ...s, segmentation_id: `SEG-${editionId}`, edition_id: editionId, text_id: edition.text_id, tag_ids: [] };
}

export const segmentsById: Record<string, SegmentWithContextOutput> = Object.fromEntries(
  Object.entries(segments).flatMap(([eid, list]) => list.map((s) => [s.id, withContext(eid, s)])),
);

export const alignments: Record<string, EditionAlignmentOutput[]> = {
  E1: [{ aligned_edition_id: "E1", aligned_text_id: "T1", target_edition_id: "E2", target_text_id: "T2" }],
  E2: [{ aligned_edition_id: "E1", aligned_text_id: "T1", target_edition_id: "E2", target_text_id: "T2" }],
};

/** Stored only in the E1 -> E2 direction. */
export const alignmentPairs: Record<string, EditionAlignmentPairOutput[]> = {
  "E1|E2": [
    { source_segment: segmentsById.S1!, target_segment: segmentsById.S3! },
    { source_segment: segmentsById.S2!, target_segment: segmentsById.S4! },
  ],
};

export const relatedSegments: Record<string, SegmentWithContextOutput[]> = { S1: [segmentsById.S3!], S3: [segmentsById.S1!] };

export const persons: PersonOutput[] = [{ id: "P1", name: { en: "Nagarjuna", bo: "ཀླུ་སྒྲུབ" }, alt_names: null, bdrc: "P0001", wiki: null }];

export const categories: CategoryOutput[] = [
  { id: "C1", title: { en: "Sutra" }, description: null, parent_id: null, children: ["C2"] },
  { id: "C2", title: { en: "Prajnaparamita" }, description: { en: "Perfection of wisdom" }, parent_id: "C1", children: [] },
];

export const tags: TagOutput[] = [{ id: "TAG1", title: { en: "Chant" }, description: null }];
export const languages: LanguageResponse[] = [
  { code: "bo", name: "Tibetan" },
  { code: "en", name: "English" },
];

export const recordings: RecordingOutput[] = [
  {
    id: "R1",
    edition_id: "E1",
    text_id: "T1",
    format: "mp3",
    size_bytes: 1024,
    duration_ms: 60000,
    title: { en: "Recitation" },
    language: "bo",
    license: "public",
    date: null,
    contributions: [{ type: "person", id: "P1", bdrc_id: null, role: "reciter", name: { en: "Nagarjuna" } }],
  },
];
export const audioUrls: Record<string, string> = { R1: "https://signed.example/audio.mp3?sig=abc" };

export const toc: Record<string, TableOfContentsOutput[]> = {
  E1: [
    {
      id: "TOC1",
      edition_id: "E1",
      text_id: "T1",
      sections: [{ id: "SEC1", title: { en: "Opening" }, span: { start: 0, end: 12 }, subsections: [{ id: "SEC1a", title: { en: "Homage" }, span: { start: 0, end: 6 } }] }],
      metadata: null,
    },
  ],
};

export const durchens: Record<string, NoteOutput[]> = {
  E1: [{ id: "N1", edition_id: "E1", text_id: "T1", span: { start: 3, end: 5 }, text: "variant reading", metadata: null }],
};

export const searchResults: ContentSearchResult[] = [
  { text_id: "T2", edition_id: "E2", segment_ids: ["S3"], context_span: { start: 0, end: 40 }, match_span: { start: 10, end: 20 }, score: 0.9, context: "Homage to the Bhagavati..." },
];
