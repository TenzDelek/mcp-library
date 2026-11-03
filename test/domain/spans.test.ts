import { describe, expect, it } from "vitest";
import { codePointLength, coveringSpan, linesText, sliceCodePoints, sliceWithin, truncateCodePoints } from "../../src/domain/spans.js";

describe("spans (code points, not UTF-16)", () => {
  const astral = "a😀b😀c"; // 5 code points, 7 UTF-16 units
  it("counts code points", () => {
    expect(codePointLength(astral)).toBe(5);
    expect(codePointLength("བཅོམ")).toBe(4);
  });
  it("slices by code point and clamps", () => {
    expect(sliceCodePoints(astral, 1, 3)).toBe("😀b");
    expect(sliceCodePoints(astral, 3)).toBe("😀c");
    expect(sliceCodePoints(astral, 4, 99)).toBe("c");
  });
  it("covering span", () => {
    expect(coveringSpan([{ start: 5, end: 9 }, { start: 2, end: 3 }])).toEqual({ start: 2, end: 9 });
    expect(coveringSpan([])).toBeNull();
  });
  it("truncates", () => {
    expect(truncateCodePoints(astral, 2)).toEqual({ text: "a😀", truncated: true });
    expect(truncateCodePoints(astral, 5)).toEqual({ text: astral, truncated: false });
  });
  it("slices within a fetched window using absolute spans", () => {
    const fetched = { start: 10, end: 15 };
    expect(sliceWithin(astral, fetched, { start: 11, end: 13 })).toBe("😀b");
    expect(sliceWithin(astral, fetched, { start: 9, end: 12 })).toBeNull();
    expect(linesText(astral, fetched, [{ start: 10, end: 11 }, { start: 14, end: 15 }])).toBe("a\nc");
  });
});
