import { describe, expect, it } from 'vitest';

import { CreateScreenRequestSchema, SCREEN_NAME_MAX } from '@/lib/api/schemas';

import { buildDuplicateScreenInput, COPY_SUFFIX, type ScreenCopySource } from './duplicate';

const base: ScreenCopySource = {
  name: 'Cool Screen',
  description: 'desc',
  html: '<p>hi</p>',
  dataRefreshSeconds: 60,
  source: 'user',
  generationPrompt: null,
};

describe('buildDuplicateScreenInput', () => {
  it('appends (Copy) and copies every field', () => {
    const out = CreateScreenRequestSchema.parse(
      buildDuplicateScreenInput(
        { ...base, source: 'ai', generationPrompt: 'make it blue' },
        { savedName: 'Cool Screen', aiPrompt: null },
      ),
    );
    expect(out).toEqual({
      name: 'Cool Screen (Copy)',
      description: 'desc',
      html: '<p>hi</p>',
      dataRefreshSeconds: 60,
      source: 'ai',
      generationPrompt: 'make it blue',
    });
  });

  it('truncates long names so the suffixed name passes the schema', () => {
    const long = 'x'.repeat(SCREEN_NAME_MAX);
    const out = CreateScreenRequestSchema.parse(
      buildDuplicateScreenInput({ ...base, name: long }, { savedName: long, aiPrompt: null }),
    );
    expect(out.name).toBe(`${'x'.repeat(SCREEN_NAME_MAX - COPY_SUFFIX.length)}${COPY_SUFFIX}`);
    expect(out.name.length).toBe(SCREEN_NAME_MAX);
  });

  it('falls back to the saved name when the draft name is blank', () => {
    const out = CreateScreenRequestSchema.parse(
      buildDuplicateScreenInput(
        { ...base, name: '   ' },
        { savedName: 'Cool Screen', aiPrompt: null },
      ),
    );
    expect(out.name).toBe('Cool Screen (Copy)');
  });

  it('copies builtin originals as user since create rejects builtin', () => {
    const out = CreateScreenRequestSchema.parse(
      buildDuplicateScreenInput({ ...base, source: 'builtin' }, { savedName: 'B', aiPrompt: null }),
    );
    expect(out.source).toBe('user');
    expect(out.generationPrompt).toBeUndefined();
  });

  it('prefers an unapplied AI prompt over the stored one and marks the copy ai', () => {
    const out = CreateScreenRequestSchema.parse(
      buildDuplicateScreenInput(
        { ...base, source: 'user', generationPrompt: 'old' },
        { savedName: 'Cool Screen', aiPrompt: 'new' },
      ),
    );
    expect(out.source).toBe('ai');
    expect(out.generationPrompt).toBe('new');
  });
});
