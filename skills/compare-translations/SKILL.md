---
name: compare-translations
description: Show a Buddhist text and its translation side by side, segment by segment, using the library's alignments (for example Tibetan original beside the English translation). Use when the user asks to compare translations, see the original next to a translation, check how a line was translated, or find the Tibetan for an English passage (or vice versa).
license: MIT
metadata:
  tools: search_texts, search_content, get_text, get_aligned_segments, get_segment, list_segments
  version: "0.2.0"
---

# Compare translations

Present the source edition and a translation edition as aligned pairs, quoting both verbatim from tool results.

## Ids you will handle

- `text_id`: a work. A translation is its own text with `translation_of` set to the original's id.
- `edition_id`: a readable version of a text; alignments connect two editions.
- `segment_id` and `reference`: a verse or paragraph inside an edition.

## Procedure

1. **Find the family.** `search_texts` by title (at least 2 characters), then `get_text` with `include_family: true`. The result lists the root original and every translation with its language and id, plus each text's editions.
2. **Choose the two editions.** Pick the source edition (usually the original, language `bo`) and the target edition in the language the user wants. If a text has several editions, prefer `critical`, then `diplomatic`.
3. **List alignment targets.** Call `get_aligned_segments` with only `source_edition_id`. The `available_targets` list shows which editions are aligned, with titles and languages. If the wanted edition is not listed, go to step 6.
4. **Fetch pairs.** Call `get_aligned_segments` with `source_edition_id` and `target_edition_id`. Each item has `source` and `target` with `segment_id`, `reference` and `content`. Page with `next_offset` while `has_more` is true; stop when the user's passage is covered. `direction_swapped: true` only means the library stores the alignment the other way round; the output is already oriented source → target.
5. **Present** a table or paired blocks: reference, source content, target content. Quote both verbatim. Then note differences the user asked about (omissions, added glosses, word choice), clearly marked as your observation.
6. **No alignment available.** Use `get_segment` on a source segment with `related_language` set to the target language; it returns related segments with their text. If that is empty too, use `list_segments` on both editions and pair by `reference`, and say that the pairing is by reference, not by a stored alignment.

## Output format

| Ref | Source (<language>) | Translation (<language>) |
|---|---|---|
| 1-1 | "<source content>" | "<target content>" |

Follow the table with one citation line per edition: *Title* (language), edition `<edition_id>`, text `<text_id>`, translator from `get_text` contributors when known.

## Rules

- Never fill a missing side from memory; show "(no aligned segment)" instead.
- Keep Tibetan in Tibetan Unicode. Do not retranslate the translation.
- If the user gives an English line and wants the Tibetan, first locate the English segment (`search_content` via the cite-buddhist-text skill, or `list_segments`), then use `get_segment` with `related_language: "bo"`.
