import { describe, expect, it } from "vitest";
import { pickLocalized } from "../../src/domain/localized.js";
import { pageOf } from "../../src/domain/pagination.js";
import { resolveMany } from "../../src/domain/resolve.js";

describe("pickLocalized", () => {
  it("prefers in order, then variants, then first", () => {
    expect(pickLocalized({ bo: "ཀ", en: "A" }, ["en", "bo"])).toEqual({ value: "A", lang: "en" });
    expect(pickLocalized({ "bo-x-ewts": "ka", zh: "甲" }, ["en", "bo"])).toEqual({ value: "ka", lang: "bo-x-ewts" });
    expect(pickLocalized({ zh: "甲" }, ["en"])).toEqual({ value: "甲", lang: "zh" });
    expect(pickLocalized(null, ["en"])).toBeNull();
    expect(pickLocalized({}, ["en"])).toBeNull();
  });
});

describe("pageOf", () => {
  it("computes next_offset from the requested offset", () => {
    expect(pageOf([1, 2, 3], 10, true)).toEqual({ items: [1, 2, 3], has_more: true, next_offset: 13 });
    expect(pageOf([1], 10, false).next_offset).toBeNull();
  });
});

describe("resolveMany", () => {
  it("caps, dedupes, drops failures, bounds concurrency", async () => {
    let inFlight = 0;
    let peak = 0;
    const seen: string[] = [];
    const result = await resolveMany(
      ["a", "b", "a", "c", "d", "e"],
      async (k) => {
        seen.push(k);
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 2));
        inFlight--;
        if (k === "c") throw new Error("boom");
        return k.toUpperCase();
      },
      { cap: 4, concurrency: 2 },
    );
    expect([...result.entries()]).toEqual([["a", "A"], ["b", "B"], ["d", "D"]]);
    expect(seen).toEqual(["a", "b", "c", "d"]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
