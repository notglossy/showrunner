import type { Screen } from '@/lib/db/schema';

/**
 * Screens that ship with ShowRunner (seeded with source "builtin") are read-only: the API refuses to
 * update or delete them, and the editor offers Duplicate to make an editable copy instead.
 */
export function isReadOnlyScreen(screen: Pick<Screen, 'source'>): boolean {
  return screen.source === 'builtin';
}
