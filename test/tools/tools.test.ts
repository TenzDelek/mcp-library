import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LibraryError } from "../../src/library/errors.js";
import { TOOLS } from "../../src/tools/index.js";
import { BO_CONTENT, EN_CONTENT } from "../fakes/seed.js";
import { createHarness, type Harness } from "../harness.js";

let h: Harness;
beforeEach(async () => {
  h = await createHarness();
});
afterEach(async () => {
  await h.close();
});

describe("tool catalogue", () => {
  it("lists all 15 tools with read-only annotations", async () => {
    const { tools } = await h.client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(TOOLS.map((t) => t.name).sort());
    expect(tools).toHaveLength(15);
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint).toBe(true);
      expect(t.description?.length ?? 0).toBeGreaterThan(40);
    }
  });
});

describe("search_texts", () => {
  it("projects compact items and pagination", async () => {
    const r = await h.call("search_texts", { title: "heart", limit: 1 });
    expect(r.items).toEqual([
      expect.objectContaining({ id: "T1", title: "Heart Sutra", title_lang: "en", language: "bo", edition_count: 1, translation_count: 1 }),
    ]);
    expect(r.has_more).toBe(true);
    expect(r.next_offset).toBe(1);
    const page2 = await h.call("search_texts", { title: "heart", limit: 1, offset: 1 });
    expect((page2.items as unknown[]).length).toBe(1);
    expect(page2.has_more).toBe(false);
    expect(page2.next_offset).toBeNull();
  });
  it("passes filters through to the client", async () => {
    await h.call("search_texts", { tag_ids: ["TAG1"], tag_match: "any", language: "bo" });
    expect(h.fake.callsTo("listTexts")[0]![0]).toMatchObject({ tag_ids: ["TAG1"], tag_id_match: "any", language: "bo" });
  });
  it("rejects a 1-character title at the schema layer", async () => {
    const text = await h.callError("search_texts", { title: "h" });
    expect(text).toMatch(/title|Invalid|too small|>=2/i);
    expect(h.fake.callsTo("listTexts")).toHaveLength(0);
  });
});

describe("get_text", () => {
  it("composes text, editions, contributors and related titles", async () => {
    const r = await h.call("get_text", { text_id: "T1" });
    expect(r.title).toBe("Heart Sutra");
    expect(r.editions).toEqual([expect.objectContaining({ id: "E1", type: "diplomatic" })]);
    expect(r.contributors).toEqual([expect.objectContaining({ person_id: "P1", name: "Nagarjuna", role: "author" })]);
    expect(r.translations).toEqual([{ id: "T2", title: "The Heart of the Perfection of Wisdom", language: "en" }]);
    expect(r.family).toBeUndefined();
  });
  it("walks to the family root from a translation", async () => {
    const r = (await h.call("get_text", { text_id: "T2", include_family: true })) as { family: { root: { id: string }; translations: Array<{ id: string }> } };
    expect(r.family.root.id).toBe("T1");
    expect(r.family.translations.map((t) => t.id)).toEqual(["T2"]);
  });
  it("reports not found with the id", async () => {
    const text = await h.callError("get_text", { text_id: "NOPE" });
    expect(text).toContain("No text with id 'NOPE'");
  });
});

describe("read_edition", () => {
  const boLen = Array.from(BO_CONTENT).length;
  it("reads a window and flags truncation with next_span_start", async () => {
    const r = await h.call("read_edition", { edition_id: "E1", max_chars: 100 });
    // Fake has a 30-ish code point edition; window larger than content => not truncated, reached end.
    expect(r.content).toBe(BO_CONTENT);
    expect(r.truncated).toBe(false);
    expect(r.reached_end).toBe(true);
    expect(r.span).toEqual({ start: 0, end: boLen });
    expect(r.text_id).toBe("T1");

    const small = await h.call("read_edition", { edition_id: "E1", max_chars: 100, span_end: 10 });
    expect(Array.from(small.content as string).length).toBe(10);
    expect(small.truncated).toBe(false);
  });
  it("detects truncation in one call by asking for max_chars + 1", async () => {
    const r = await h.call("read_edition", { edition_id: "E2", max_chars: 100 }).catch(() => null);
    // max_chars min is 100 so use a long seed via override
    expect(r).not.toBeNull();
    await h.close();
    h = await createHarness({ contents: { E1: BO_CONTENT, E2: "x".repeat(250) } });
    const t = await h.call("read_edition", { edition_id: "E2", max_chars: 100 });
    expect((t.content as string).length).toBe(100);
    expect(t.truncated).toBe(true);
    expect(t.next_span_start).toBe(100);
    expect(t.hint).toContain("span_start=100");
    expect(h.fake.callsTo("getEditionContent")[0]).toEqual(["E2", { start: 0, end: 101 }]);
    const t2 = await h.call("read_edition", { edition_id: "E2", span_start: 200, max_chars: 100 });
    expect((t2.content as string).length).toBe(50);
    expect(t2.truncated).toBe(false);
    expect(t2.reached_end).toBe(true);
  });
  it("resolves an edition from text_id using the preference order", async () => {
    const r = await h.call("read_edition", { text_id: "T2" });
    expect(r.edition_id).toBe("E2");
    expect(r.content).toBe(EN_CONTENT);
    const err = await h.callError("read_edition", { text_id: "T2", edition_type: "collated" });
    expect(err).toMatch(/no collated edition|No text with id/);
  });
  it("requires edition_id or text_id", async () => {
    expect(await h.callError("read_edition", {})).toContain("provide edition_id or text_id");
  });
});

describe("get_full_content", () => {
  it("pages all segments, fetches one covering span, restores breaks", async () => {
    const r = await h.call("get_full_content", { text_id: "T2" });
    expect(r.edition_id).toBe("E2");
    expect(r.segment_count).toBe(2);
    expect(r.span).toEqual({ start: 0, end: 60 });
    expect(r.content).toBe(EN_CONTENT.slice(0, 40) + "\n\n" + EN_CONTENT.slice(40, 60));
    expect(r.truncated).toBe(false);
    expect(h.fake.callsTo("getEditionContent")).toEqual([["E2", { start: 0, end: 60 }]]);
    expect(h.fake.callsTo("listEditionSegments")).toEqual([["E2", { limit: 500, offset: 0 }]]);
  });
  it("supports segments and raw formats", async () => {
    const seg = (await h.call("get_full_content", { edition_id: "E2", format: "segments" })) as { segments: Array<{ reference: string; content: string }> };
    expect(seg.segments.map((s) => s.reference)).toEqual(["1", "2"]);
    const raw = await h.call("get_full_content", { edition_id: "E2", format: "raw" });
    expect(raw.content).toBe(EN_CONTENT);
    expect(raw.text_id).toBe("T2");
  });
  it("follows has_more across pages and caps at max_chars", async () => {
    const n = 1200;
    const big = Array.from({ length: n }, (_, i) => ({ id: `B${i}`, lines: [{ start: i * 2, end: i * 2 + 2 }], type: "verse" as const, reference: String(i) }));
    await h.close();
    h = await createHarness({ contents: { E1: BO_CONTENT, E2: "ab".repeat(n) }, segments: { E1: [], E2: big } });
    const r = (await h.call("get_full_content", { edition_id: "E2", max_chars: 1000 })) as Record<string, unknown>;
    expect(h.fake.callsTo("listEditionSegments").map((a) => (a[1] as { offset: number }).offset)).toEqual([0, 500, 1000]);
    expect(r.segment_count).toBe(n);
    expect(r.truncated).toBe(true);
    expect(r.span).toEqual({ start: 0, end: 1000 });
    expect(r.next_span_start).toBe(1000);
    expect((r.content as string).split("\n\n")).toHaveLength(500);
  });
});

describe("search_content", () => {
  it("resolves titles for hits", async () => {
    const r = (await h.call("search_content", { query: "Homage" })) as { results: Array<Record<string, unknown>> };
    expect(r.results[0]).toMatchObject({ text_id: "T2", text_title: "The Heart of the Perfection of Wisdom", segment_ids: ["S3"] });
  });
});

describe("get_segment", () => {
  it("returns content and related segments in another language with their text", async () => {
    const r = (await h.call("get_segment", { segment_id: "S1", related_language: "en" })) as { content: string; related: { items: Array<{ segment_id: string; content: string }> } };
    expect(r.content).toBe(Array.from(BO_CONTENT).slice(0, 12).join(""));
    expect(r.related.items).toEqual([expect.objectContaining({ segment_id: "S3", content: EN_CONTENT.slice(0, 40) })]);
  });
  it("omits related when not asked", async () => {
    const r = await h.call("get_segment", { segment_id: "S1" });
    expect(r.related).toBeUndefined();
    expect(h.fake.callsTo("listRelatedSegments")).toHaveLength(0);
  });
});

describe("list_segments", () => {
  it("fetches one covering content window and slices per segment", async () => {
    const r = (await h.call("list_segments", { edition_id: "E2", limit: 2 })) as { items: Array<{ id: string; content: string }>; has_more: boolean };
    expect(r.items.map((i) => i.content)).toEqual([EN_CONTENT.slice(0, 40), EN_CONTENT.slice(40, 60)]);
    expect(h.fake.callsTo("getEditionContent")).toEqual([["E2", { start: 0, end: 60 }]]);
    expect(r.has_more).toBe(false);
  });
  it("skips content when with_content is false", async () => {
    const r = (await h.call("list_segments", { edition_id: "E2", with_content: false })) as { items: Array<Record<string, unknown>> };
    expect(r.items[0]).not.toHaveProperty("content");
    expect(h.fake.callsTo("getEditionContent")).toHaveLength(0);
  });
});

describe("get_aligned_segments", () => {
  it("lists available targets with titles when no target is given", async () => {
    const r = await h.call("get_aligned_segments", { source_edition_id: "E1" });
    expect(r.available_targets).toEqual([{ edition_id: "E2", text_id: "T2", title: "The Heart of the Perfection of Wisdom", language: "en" }]);
  });
  it("returns pairs with both texts and swaps direction when needed", async () => {
    const fwd = (await h.call("get_aligned_segments", { source_edition_id: "E1", target_edition_id: "E2" })) as {
      direction_swapped: boolean;
      items: Array<{ source: { segment_id: string; content: string }; target: { segment_id: string; content: string } }>;
    };
    expect(fwd.direction_swapped).toBe(false);
    expect(fwd.items[0]!.source).toMatchObject({ segment_id: "S1" });
    expect(fwd.items[0]!.target).toMatchObject({ segment_id: "S3", content: EN_CONTENT.slice(0, 40) });

    const rev = (await h.call("get_aligned_segments", { source_edition_id: "E2", target_edition_id: "E1" })) as typeof fwd;
    expect(rev.direction_swapped).toBe(true);
    expect(rev.items[0]!.source).toMatchObject({ segment_id: "S3", content: EN_CONTENT.slice(0, 40) });
    expect(rev.items[0]!.target).toMatchObject({ segment_id: "S1" });
  });
});

describe("get_edition", () => {
  it("treats 404 on optional sections as empty and flattens the toc", async () => {
    const r = await h.call("get_edition", { edition_id: "E1", include: ["toc", "notes", "marks", "pagination", "download_url"] });
    expect(r.aligned_editions).toEqual([{ edition_id: "E2", text_id: "T2" }]);
    expect(r.recordings).toEqual([expect.objectContaining({ id: "R1", format: "mp3" })]);
    expect(r.table_of_contents).toEqual({
      items: [
        { id: "SEC1", title: "Opening", depth: 0, span: { start: 0, end: 12 } },
        { id: "SEC1a", title: "Homage", depth: 1, span: { start: 0, end: 6 } },
      ],
      total: 2,
      truncated: false,
    });
    expect(r.notes).toMatchObject({ items: [{ id: "N1", text: "variant reading" }] });
    expect(r.marks).toEqual({ items: [], total: 0, truncated: false }); // 404 -> empty
    expect(r.pagination).toBeNull();
    expect(r.download_url).toBe("https://signed.example/E1.txt");
  });
  it("still fails on a missing edition", async () => {
    expect(await h.callError("get_edition", { edition_id: "E9" })).toContain("No edition with id 'E9'");
  });
});

describe("persons, categories, reference, recording", () => {
  it("search_persons / get_person", async () => {
    const s = await h.call("search_persons", { name: "nag" });
    expect(s.items).toEqual([expect.objectContaining({ id: "P1", name: "Nagarjuna" })]);
    const p = (await h.call("get_person", { person_id: "P1" })) as { texts: { items: Array<{ id: string }> } };
    expect(p.texts.items.map((t) => t.id)).toEqual(["T1"]);
  });
  it("browse_categories roots and node", async () => {
    const roots = await h.call("browse_categories", {});
    expect(roots.category).toBeNull();
    expect(roots.children).toEqual([expect.objectContaining({ id: "C1", title: "Sutra", child_count: 1 })]);
    const node = await h.call("browse_categories", { category_id: "C1" });
    expect(node.category).toMatchObject({ id: "C1" });
    expect(node.children).toEqual([expect.objectContaining({ id: "C2", description: "Perfection of wisdom" })]);
  });
  it("list_tags / list_languages", async () => {
    expect((await h.call("list_tags")).tags).toEqual([expect.objectContaining({ id: "TAG1", title: "Chant" })]);
    expect((await h.call("list_languages")).languages).toHaveLength(2);
  });
  it("get_recording includes the presigned URL", async () => {
    const r = await h.call("get_recording", { recording_id: "R1" });
    expect(r.audio_url).toBe("https://signed.example/audio.mp3?sig=abc");
    expect(r.contributors).toEqual([expect.objectContaining({ role: "reciter", name: "Nagarjuna" })]);
  });
});

describe("error surfacing", () => {
  it("maps unauthorized to a configuration message without leaking anything", async () => {
    h.fake.failNext("listTags", new LibraryError({ kind: "unauthorized", method: "GET", path: "/v2/tags", status: 401 }));
    const text = await h.callError("list_tags");
    expect(text).toContain("LIBRARY_API_KEY");
    expect(text).not.toContain("X-API-Key");
  });
  it("maps rate limits, upstream, network and bad_response", async () => {
    for (const [kind, needle] of [
      ["rate_limited", "429"],
      ["upstream", "HTTP 503"],
      ["network", "Could not reach"],
      ["bad_response", "schema update"],
    ] as const) {
      h.fake.failNext("listLanguages", new LibraryError({ kind, method: "GET", path: "/v2/languages", status: kind === "upstream" ? 503 : undefined, detail: "d" }));
      expect(await h.callError("list_languages")).toContain(needle);
    }
  });
  it("turns unexpected exceptions into isError results instead of protocol errors", async () => {
    h.fake.failNext("listLanguages", new RangeError("kaboom"));
    expect(await h.callError("list_languages")).toContain("RangeError: kaboom");
  });
});
