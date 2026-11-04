# Worked examples

## 1. "Quote the opening of the Heart Sutra in Tibetan"

1. `search_texts` `{ "title": "heart sutra", "language": "bo" }` → pick the Tibetan text (its `translation_of` is null).
2. `get_text` `{ "text_id": "<id>" }` → editions; choose the one whose `type` is `critical` if present, else the first.
3. `get_full_content` `{ "edition_id": "<edition>", "format": "segments" }` (the sutra is short) → first segment.
4. Quote the first segment's `content` verbatim and cite it with reference and ids.

## 2. "Where does it say 'form is emptiness'?"

1. `search_content` `{ "query": "form is emptiness", "limit": 5 }` → hits with `text_title`, `edition_id`, `segment_ids`.
2. If more than one text matches, list them and ask; otherwise `get_segment` for each `segment_id`.
3. Quote the segment(s) verbatim, cite, and mention that this is an English translation (`translation_of` set) with the translator from `get_text`.

## 3. Nothing found

`search_content` returns `[]` for the exact query → retry with `"search_type": "similar"`. If still empty, answer: "The library has no passage matching …" and suggest `search_texts` by title.
