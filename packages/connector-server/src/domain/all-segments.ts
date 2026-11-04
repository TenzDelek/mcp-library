import type { LibraryClient, SegmentOutput } from "@webuddhist/library-client";

export const SEGMENT_PAGE_SIZE = 500;
/** 200 pages x 500 = 100k segments; stops runaway loops if the API misbehaves. */
export const MAX_SEGMENT_PAGES = 200;

export interface AllSegments {
  segments: SegmentOutput[];
  /** True when MAX_SEGMENT_PAGES was hit before has_more turned false. */
  incomplete: boolean;
}

/**
 * Pages through every segment of an edition. Stops when has_more is false,
 * on an empty page, on a page with nothing new, or at MAX_SEGMENT_PAGES.
 */
export async function fetchAllSegments(library: LibraryClient, editionId: string): Promise<AllSegments> {
  const segments: SegmentOutput[] = [];
  const seen = new Set<string>();
  let offset = 0;
  for (let page = 0; page < MAX_SEGMENT_PAGES; page++) {
    const res = await library.listEditionSegments(editionId, { limit: SEGMENT_PAGE_SIZE, offset });
    const fresh = res.items.filter((s) => !seen.has(s.id));
    if (fresh.length === 0) return { segments, incomplete: false };
    for (const s of fresh) {
      seen.add(s.id);
      segments.push(s);
    }
    if (!res.has_more) return { segments, incomplete: false };
    offset += res.items.length;
  }
  return { segments, incomplete: true };
}
