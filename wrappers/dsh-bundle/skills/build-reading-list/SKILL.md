---
name: build-reading-list
description: Build a curated, cited reading list from the WeBuddhist Library for a topic, category, tag, author or language (for example "Prajnaparamita texts with English translations" or "chants by Nagarjuna"). Use when the user asks what to read, for recommendations, a syllabus, a study plan, a bibliography, or an overview of which texts exist on a subject.
license: MIT
metadata:
  tools: browse_categories, list_tags, list_languages, search_texts, get_text, search_persons, get_person
  version: "0.2.0"
---

# Build a reading list

Produce a ranked list of texts that exist in the library, each with a reason to read it and a citation, drawn only from tool results.

## Procedure

1. **Clarify scope (once).** Topic or category, language(s) the reader can read, length (default 5–10 texts), and whether translations are required.
2. **Map the scope to library filters.**
   - Subject: `browse_categories` with no arguments lists root categories; call it again with a `category_id` to descend. Note the id of the narrowest matching category.
   - Genre or practice (chant, liturgy, prayer): `list_tags` and pick tag ids.
   - Language codes: `list_languages` if unsure (`bo`, `en`, `sa`, `zh`, …).
   - Author or translator: `search_persons` with `name` (at least 2 characters), then `get_person` with `include_texts: true` for their texts.
3. **Collect candidates** with `search_texts` using `category_id`, `tag_ids`, `language`, `author_id` or `title`. Page with `next_offset` while `has_more` is true, up to about 100 candidates. Each item reports `translation_count`, `commentary_count` and `edition_count`.
4. **Enrich the shortlist** with `get_text` (default `include_related: true`) for each kept text: titles in every language, contributors, editions, translations and commentaries. This is where you learn whether an English translation exists.
5. **Rank** by fit to the request, then by availability in the reader's language, then by having commentaries (useful for study). Say what the ranking criteria were.
6. **Present** the list in the format below. Group by category or by original/translation when it helps.

## Output format

1. **<Title>** (<language>; translation of *<original title>* when applicable) — <one-sentence reason it belongs here>. Editions: <count>; translations: <languages>. Contributors: <names from get_text>. Text id `<text_id>`, read with edition `<edition_id>`.

End with "Not found in the library:" for anything the user asked about that no search returned, so gaps are explicit.

## Rules

- Every entry must come from a `search_texts`, `get_text` or `get_person` result in this conversation; never add texts from memory.
- Prefer breadth of real holdings over long descriptions; one reason per entry.
- If a filter returns nothing, loosen it (broader category, drop the tag, any language) and tell the user which filter was loosened.
- Offer follow-ups: quote a passage (cite-buddhist-text) or compare an original with its translation (compare-translations).
