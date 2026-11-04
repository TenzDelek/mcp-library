import type { LocalizedString } from "@webuddhist/library-client";

export interface Picked {
  value: string;
  lang: string;
}

/**
 * Picks one string from a LocalizedString: first match in `preferred` order,
 * otherwise the first entry. Returns null for empty/missing maps.
 */
export function pickLocalized(ls: LocalizedString | null | undefined, preferred: string[]): Picked | null {
  if (!ls) return null;
  for (const lang of preferred) {
    const v = ls[lang];
    if (v) return { value: v, lang };
  }
  // Also accept language variants such as "bo-x-ewts" when "bo" is preferred.
  for (const lang of preferred) {
    const key = Object.keys(ls).find((k) => k.startsWith(lang + "-") && ls[k]);
    if (key) return { value: ls[key]!, lang: key };
  }
  const first = Object.entries(ls).find(([, v]) => Boolean(v));
  return first ? { value: first[1], lang: first[0] } : null;
}

export function pickValue(ls: LocalizedString | null | undefined, preferred: string[]): string | null {
  return pickLocalized(ls, preferred)?.value ?? null;
}
