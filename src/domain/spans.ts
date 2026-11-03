/**
 * Span arithmetic in Unicode code points. The library counts positions in code
 * points, end-exclusive. Never index strings by UTF-16 offset here: Tibetan
 * stays in the BMP, but mixed content (emoji, rare CJK) does not.
 */
import type { Span } from "../library/schemas.js";

export function codePointLength(s: string): number {
  // UTF-16 length minus the number of surrogate pairs.
  const pairs = s.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g);
  return s.length - (pairs?.length ?? 0);
}

/** Slice by code point indices, [start, end). Out-of-range indices are clamped. */
export function sliceCodePoints(s: string, start: number, end?: number): string {
  const cps = Array.from(s);
  return cps.slice(Math.max(0, start), end === undefined ? undefined : Math.max(0, end)).join("");
}

/** Smallest span covering all given spans, or null when none. */
export function coveringSpan(spans: Iterable<Span>): Span | null {
  let start = Infinity;
  let end = -Infinity;
  for (const sp of spans) {
    if (sp.start < start) start = sp.start;
    if (sp.end > end) end = sp.end;
  }
  return start === Infinity ? null : { start, end };
}

export interface Truncated {
  text: string;
  truncated: boolean;
}

/** Keeps at most `max` code points. */
export function truncateCodePoints(s: string, max: number): Truncated {
  const cps = Array.from(s);
  if (cps.length <= max) return { text: s, truncated: false };
  return { text: cps.slice(0, max).join(""), truncated: true };
}

/**
 * Given content fetched for `fetched` (absolute span) returns the text of an
 * absolute `target` span inside it, or null if target is not fully covered.
 */
export function sliceWithin(content: string, fetched: Span, target: Span): string | null {
  if (target.start < fetched.start || target.end > fetched.end) return null;
  return sliceCodePoints(content, target.start - fetched.start, target.end - fetched.start);
}

/** Joins the text of each line span (relative to `fetched`) with newlines. */
export function linesText(content: string, fetched: Span, lines: Span[]): string | null {
  const parts: string[] = [];
  for (const line of lines) {
    const t = sliceWithin(content, fetched, line);
    if (t === null) return null;
    parts.push(t);
  }
  return parts.join("\n");
}
