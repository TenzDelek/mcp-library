/**
 * Server instructions sent to MCP clients at initialize. This text is one of
 * the artefacts the optimization loop may propose changes to (via PR).
 */
export const INSTRUCTIONS = `WeBuddhist Library: Buddhist texts (Tibetan canon and more), their editions, translations, commentaries, segments, alignments, people and recordings.
Id kinds: a *text* is a work; an *edition* is a readable version of a text (read_edition, list_segments need an edition id); a *segment* is a paragraph/verse of an edition.
Typical flow: search_texts or search_content -> get_text (to see editions) -> read_edition (window) or get_full_content (whole text) or list_segments -> get_aligned_segments to compare with a translation.
Content positions are Unicode code points, end-exclusive. Lists have no totals; follow next_offset while has_more.`;
