---
name: cite-buddhist-text
description: Quote a passage from a Buddhist text verbatim with an exact library citation (text, edition, segment reference, span). Use when the user asks to quote, cite, source, verify, locate or check the wording of a line, verse, mantra or passage from a sutra, tantra, commentary, prayer or chant, in Tibetan, English or another language, or asks "where does it say" / "what is the exact wording".
license: MIT
metadata:
  tools: search_texts, search_content, get_text, get_segment, read_edition, get_full_content
  version: "0.2.0"
---

# Cite a Buddhist text

Quote exactly what the WeBuddhist Library holds and say precisely where it comes from. Never quote from memory: every quotation must come from a tool result in this conversation.

## How the library is organised

- A **text** is a work (`text_id`). A **translation** is a separate text whose `translation_of` points at the original; a **commentary** has `commentary_of`.
- An **edition** (`edition_id`) is a concrete readable version of a text. Content, segments and alignments belong to editions, not texts.
- A **segment** (`segment_id`) is a verse or paragraph of an edition; it has a human `reference` such as `1-3` and a `span` in Unicode code points.
- Lists have no totals: follow `next_offset` while `has_more` is true.

## Procedure

1. **Identify the text.**
   - User names a title or author: `search_texts` with `title` (at least 2 characters) and, if known, `language` (`bo` Tibetan, `en` English, `sa` Sanskrit, `zh` Chinese). Confirm the match by title and language before going on.
   - User gives a phrase or line: `search_content` with the phrase as `query` in the script of the text. If it returns nothing, call it again with `search_type: "similar"` and tell the user the match is approximate. Each hit carries `text_id`, `edition_id`, `context` and `segment_ids`.
2. **Pin the edition.** Call `get_text` to list editions. Prefer the edition in the language the user asked for. If the user asked for the original and the matched text is a translation, follow `translation_of` with another `get_text`.
3. **Fetch the exact wording.**
   - From `search_content` hits: `get_segment` with each `segment_id` returns the segment's `content` plus its `reference` and `span`.
   - For a known position: `read_edition` with `edition_id` and `span_start` / `span_end`.
   - For a whole short text (a prayer, a dharani): `get_full_content` with `format: "segments"` so every verse keeps its reference.
4. **Quote verbatim.** Copy the tool's `content` character for character, including Tibetan punctuation (`།`) and line breaks. Do not translate inside quotation marks; give a translation separately and label it as yours. Shorten only with `[…]` outside the quoted words.
5. **Cite** in the format below, then offer the next step (the aligned translation via the compare-translations skill, or more context via `read_edition`).

## Citation format

> "<quoted content>"
>
> — *<text title>* (<language>), edition `<edition_id>` (<edition type>, <source if any>), segment <reference> (`<segment_id>`), span <start>–<end>. Text id `<text_id>`.

When several segments are quoted, cite each, or cite the range `first reference`–`last reference` with both segment ids.

## Rules

- Never invent or guess an id, reference or wording. If the library does not contain the passage, say so and offer the closest `search_content` hits.
- Say whether the quoted edition is the original or a translation (`translation_of` is set), and name the translator from `get_text` contributors when known.
- Tibetan quotations stay in Tibetan Unicode; never transliterate inside the quotation marks.
- If the user's phrase matches many texts, show the top hits with titles and ask which one, instead of quoting the first.

See [references/examples.md](references/examples.md) for worked examples.
