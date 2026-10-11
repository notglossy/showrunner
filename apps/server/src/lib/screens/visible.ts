import type { Screen } from '@/lib/db/schema';

/**
 * Screens to list in the dashboard. With `hideBuiltin`, built-in screens are dropped except ids in `keep`
 * (a picker's current selection), so hiding never blanks out an existing assignment or playlist item.
 */
export function visibleScreens<T extends Pick<Screen, 'id' | 'source'>>(
  screens: T[],
  hideBuiltin: boolean,
  keep: Iterable<string> = [],
): T[] {
  if (!hideBuiltin) return screens;
  const kept = new Set(keep);
  return screens.filter((s) => s.source !== 'builtin' || kept.has(s.id));
}
