import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { systemPrompt } from '@/lib/ai/prompt';
import { resetEnv } from '@/lib/env';

import { getInstructions, resetInstructions, updateInstructions } from './instructions';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-instr-'));
const file = path.join(dir, 'doc.md');
let tick = 1_000_000;

function writeDoc(text: string) {
  fs.writeFileSync(file, text);
  // authoringDoc caches on mtime; bump it explicitly so same-millisecond writes are seen.
  tick += 10_000;
  fs.utimesSync(file, tick / 1000, tick / 1000);
}

const original = process.env.AUTHORING_DOC_PATH;

beforeEach(() => {
  process.env.AUTHORING_DOC_PATH = file;
  resetEnv();
  writeDoc('# Guide v1\n');
  resetInstructions();
});

afterAll(() => {
  if (original === undefined) delete process.env.AUTHORING_DOC_PATH;
  else process.env.AUTHORING_DOC_PATH = original;
  resetEnv();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('instructions', () => {
  it('defaults to the authoring doc', () => {
    expect(getInstructions()).toEqual({
      text: '# Guide v1\n',
      defaultText: '# Guide v1\n',
      customised: false,
      defaultChanged: false,
    });
  });

  it('saves the owner version and feeds it to the system prompt', () => {
    const state = updateInstructions('# Mine\r\nbe brief');
    expect(state.customised).toBe(true);
    expect(state.text).toBe('# Mine\nbe brief');
    expect(state.defaultText).toBe('# Guide v1\n');
    expect(state.defaultChanged).toBe(false);
    expect(systemPrompt().startsWith('# Mine\nbe brief')).toBe(true);
  });

  it('removes the row when saved text equals the doc', () => {
    updateInstructions('x');
    const state = updateInstructions('# Guide v1\r\n');
    expect(state.customised).toBe(false);
    expect(state.text).toBe('# Guide v1\n');
  });

  it('resets to the doc', () => {
    updateInstructions('x');
    expect(resetInstructions()).toMatchObject({ customised: false, text: '# Guide v1\n' });
  });

  it('flags defaultChanged after the doc changes, and clears it on re-save', () => {
    updateInstructions('mine');
    writeDoc('# Guide v2\n');
    expect(getInstructions()).toMatchObject({
      text: 'mine',
      defaultText: '# Guide v2\n',
      customised: true,
      defaultChanged: true,
    });
    expect(updateInstructions('mine again').defaultChanged).toBe(false);
  });
});
