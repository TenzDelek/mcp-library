export interface Page<T> {
  items: T[];
  has_more: boolean;
  /** Offset to pass to get the next page, or null when there is no next page. */
  next_offset: number | null;
}

/**
 * Builds the page envelope tools return. `next_offset` is computed from the
 * offset we asked for plus the number of items received: the API's echoed
 * offset is not relied upon.
 */
export function pageOf<T>(items: T[], requestedOffset: number, hasMore: boolean): Page<T> {
  return { items, has_more: hasMore, next_offset: hasMore ? requestedOffset + items.length : null };
}
