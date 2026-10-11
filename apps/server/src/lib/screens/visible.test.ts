import { describe, expect, it } from 'vitest';

import { visibleScreens } from './visible';

type Row = { id: string; source: 'builtin' | 'user' | 'ai' };

const rows: Row[] = [
  { id: 'b1', source: 'builtin' },
  { id: 'u1', source: 'user' },
  { id: 'b2', source: 'builtin' },
  { id: 'a1', source: 'ai' },
  { id: 'b3', source: 'builtin' },
];

const ids = (list: Row[]) => list.map((r) => r.id);

describe('visibleScreens', () => {
  it('returns every row in order when not hiding built-ins', () => {
    expect(ids(visibleScreens(rows, false))).toEqual(['b1', 'u1', 'b2', 'a1', 'b3']);
  });

  it('drops every built-in and keeps user and ai rows in order', () => {
    expect(ids(visibleScreens(rows, true))).toEqual(['u1', 'a1']);
  });

  it('retains a kept built-in in its original position', () => {
    expect(ids(visibleScreens(rows, true, ['b2']))).toEqual(['u1', 'b2', 'a1']);
  });

  it('ignores keep entries that are not built-in or unknown, without duplicating', () => {
    expect(ids(visibleScreens(rows, true, ['u1', 'a1', 'nope']))).toEqual(['u1', 'a1']);
    expect(ids(visibleScreens(rows, false, ['b1', 'u1', 'nope']))).toEqual(ids(rows));
  });

  it('accepts any iterable for keep', () => {
    expect(ids(visibleScreens(rows, true, new Set(['b1', 'b3'])))).toEqual([
      'b1',
      'u1',
      'a1',
      'b3',
    ]);
    expect(ids(visibleScreens(rows, true, ['b1', 'b3']))).toEqual(['b1', 'u1', 'a1', 'b3']);
  });
});
