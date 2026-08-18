const STORAGE_KEY = 'smart_tka_bookmarks';

export function getBookmarkKey(studentId?: string): string {
  return studentId ? `${STORAGE_KEY}_${studentId}` : STORAGE_KEY;
}

export function getBookmarks(studentId?: string): string[] {
  const raw = localStorage.getItem(getBookmarkKey(studentId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function toggleBookmark(studentId: string | undefined, itemId: string): boolean {
  const cur = getBookmarks(studentId);
  const next = cur.includes(itemId) ? cur.filter((x) => x !== itemId) : [...cur, itemId];
  localStorage.setItem(getBookmarkKey(studentId), JSON.stringify(next));
  return next.includes(itemId);
}

export function isBookmarked(studentId: string | undefined, itemId: string): boolean {
  return getBookmarks(studentId).includes(itemId);
}
