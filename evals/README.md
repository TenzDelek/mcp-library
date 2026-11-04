# Evals (Phase D)

Task sets that score a skill against the live library. One JSONL file per skill under `tasks/`, one record per line:

```json
{
  "id": "cite-003",
  "skill": "cite-buddhist-text",
  "prompt": "Quote the opening line of the Heart Sutra in Tibetan with an exact citation.",
  "expected": {
    "citations": [{ "text_id": "...", "edition_id": "...", "segment_id": "..." }],
    "must_quote": ["བཅོམ་ལྡན་འདས་མ་"],
    "tool_paths_any": [["search_texts", "get_text", "get_full_content"], ["search_content", "get_segment"]]
  },
  "rubric": "Quotes verbatim; names edition and segment; distinguishes original from translation; invents no ids.",
  "weights": { "citation": 0.6, "rubric": 0.4 },
  "split": "train"
}
```

Store the text title beside each id so a task can be re-verified when the library changes. The runner (`apps/eval-runner`) and the GEPA loop (`optimization/`) arrive with Phase D; see `docs/architecture.md`.
