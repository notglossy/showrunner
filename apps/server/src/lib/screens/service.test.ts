import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/http';

import { createScreen, deleteScreen, findScreen, updateScreen } from './service';

const forbidden = expect.objectContaining({ status: 403, code: 'forbidden' });

describe('built-in screens are read-only', () => {
  it('refuses to update a built-in screen and leaves the row unchanged', () => {
    const screen = createScreen({ name: 'Builtin Update', html: '<p>a</p>', source: 'builtin' });
    expect(() => updateScreen(screen.id, { name: 'Changed', html: '<p>b</p>' })).toThrowError(
      forbidden,
    );
    expect(() => updateScreen(screen.id, { name: 'Changed' })).toThrow(ApiError);
    expect(findScreen(screen.id)).toMatchObject({ name: 'Builtin Update', html: '<p>a</p>' });
  });

  it('refuses to delete an unused built-in screen and keeps the row', () => {
    const screen = createScreen({ name: 'Builtin Delete', html: '<p>a</p>', source: 'builtin' });
    expect(() => deleteScreen(screen.id)).toThrowError(forbidden);
    expect(findScreen(screen.id)).toBeDefined();
  });
});

describe('user screens stay editable', () => {
  it('updates and deletes a user screen', () => {
    const screen = createScreen({ name: 'User Screen', html: '<p>a</p>', source: 'user' });
    expect(updateScreen(screen.id, { html: '<p>b</p>' }).html).toBe('<p>b</p>');
    deleteScreen(screen.id);
    expect(findScreen(screen.id)).toBeUndefined();
  });
});
