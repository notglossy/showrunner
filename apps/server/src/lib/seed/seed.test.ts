import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { getDb } from '@/lib/db/client';
import { screens } from '@/lib/db/schema';
import { createScreen, findScreen } from '@/lib/screens/service';

import { BUILTIN_SCREENS } from './screens';
import { seedBuiltinScreens, syncBuiltinScreens } from './seed';

describe('syncBuiltinScreens', () => {
  type Builtin = (typeof BUILTIN_SCREENS)[number];
  const [first, second, third, fourth] = BUILTIN_SCREENS as [Builtin, Builtin, Builtin, Builtin];

  it('updates outdated built-ins, leaves other sources alone, never re-creates deleted ones', () => {
    createScreen({ ...first, source: 'builtin', html: '<p>old</p>', name: 'Old name' });
    createScreen({ ...second, source: 'builtin' });
    const user = createScreen({ name: 'Mine', html: '<p>u</p>', source: 'user' });
    // Same id as a built-in but another source: not a built-in row, so untouched.
    const ai = createScreen({ id: third.id, name: 'AI', html: '<p>ai</p>', source: 'ai' });
    // The fourth built-in is absent (deleted by the owner).

    expect(syncBuiltinScreens()).toEqual([first.id]);

    expect(findScreen(first.id)).toMatchObject({
      name: first.name,
      description: first.description,
      html: first.html,
      dataRefreshSeconds: first.dataRefreshSeconds,
    });
    expect(findScreen(user.id)?.html).toBe('<p>u</p>');
    expect(findScreen(ai.id)).toMatchObject({ source: 'ai', html: '<p>ai</p>' });
    expect(findScreen(fourth.id)).toBeUndefined();
  });

  it('is idempotent', () => {
    expect(syncBuiltinScreens()).toEqual([]);
  });

  it('seedBuiltinScreens syncs a non-empty table and reports no inserts', () => {
    getDb().update(screens).set({ html: '<p>stale</p>' }).where(eq(screens.id, first.id)).run();
    expect(seedBuiltinScreens()).toEqual([]);
    expect(findScreen(first.id)?.html).toBe(first.html);
    expect(findScreen(fourth.id)).toBeUndefined();
  });
});
