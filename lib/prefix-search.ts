export interface Indexed<T> {
  key: string;
  item: T;
}

/** Sort once by lowercase key. Rebuild only when the list is (re)fetched. */
export function buildIndex<T>(items: T[], getKey: (t: T) => string): Indexed<T>[] {
  return items
    .map((item) => ({ key: getKey(item).toLowerCase(), item }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

// First index whose key >= q
function lowerBound<T>(arr: Indexed<T>[], q: string) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid].key < q) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Prefix matches first (binary search, O(log n)), then "contains" matches. */
export function searchIndex<T>(index: Indexed<T>[], query: string, limit = 20): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return index.slice(0, limit).map((e) => e.item);

  const hits: Indexed<T>[] = [];
  const seen = new Set<Indexed<T>>();

  // Prefix matches form one contiguous block in a sorted array
  for (let i = lowerBound(index, q); i < index.length && index[i].key.startsWith(q) && hits.length < limit; i++) {
    hits.push(index[i]);
    seen.add(index[i]);
  }

  // Remaining "contains" matches, linear (fine for a few hundred rows)
  for (const e of index) {
    if (hits.length >= limit) break;
    if (!seen.has(e) && e.key.includes(q)) hits.push(e);
  }

  return hits.map((e) => e.item);
}