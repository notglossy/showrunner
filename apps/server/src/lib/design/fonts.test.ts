import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/http';
import { getDb } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { resetEnv } from '@/lib/env';

import {
  addGoogleFont,
  availableFontFamilies,
  customFontFaceCss,
  customFontPath,
  deleteCustomFont,
  listCustomFonts,
} from './fonts';
import { getTheme } from './theme';
import { DEFAULT_THEME } from './tokens';

vi.mock('./theme', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./theme')>()),
  getTheme: vi.fn(),
}));

const woff2 = (tag: string) => Buffer.concat([Buffer.from('wOF2'), Buffer.from(tag)]);

const face = (subset: string, weight: string, url: string, style = 'normal') =>
  `/* ${subset} */\n@font-face {\n  font-family: 'Roboto Slab';\n  font-style: ${style};\n  font-weight: ${weight};\n  font-display: block;\n  src: url(${url}) format('woff2');\n}\n`;

const GSTATIC = 'https://fonts.gstatic.com/s/robotoslab/v1/';

interface Route {
  status?: number;
  body?: BodyInit;
  headers?: Record<string, string>;
}

/** Fake fetch answering by exact URL; records every requested URL. */
function fakeFetch(routes: Record<string, Route>) {
  const calls: string[] = [];
  const fn = (async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    const r = routes[url];
    if (!r) return new Response('missing', { status: 404 });
    return new Response(r.body ?? '', { status: r.status ?? 200, headers: r.headers });
  }) as typeof fetch;
  return { fn, calls };
}

const cssUrl = (name: string, axis: boolean) =>
  `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}${axis ? ':wght@100..900' : ''}&display=block`;

let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-fonts-'));
  process.env.FONTS_DIR = path.join(dir, 'fonts');
  resetEnv();
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.FONTS_DIR;
  resetEnv();
});

beforeEach(() => {
  getDb().delete(settings).where(eq(settings.key, 'customFonts')).run();
  fs.rmSync(process.env.FONTS_DIR!, { recursive: true, force: true });
  vi.mocked(getTheme).mockReturnValue({
    effective: DEFAULT_THEME,
    defaults: DEFAULT_THEME,
    overrides: {},
    availableFonts: [],
  });
});

const rejects = async (p: Promise<unknown>, status: number, message?: RegExp) => {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).status).toBe(status);
  if (message) expect((err as ApiError).message).toMatch(message);
};

describe('addGoogleFont', () => {
  it('stores a variable-range family and keeps only latin normal blocks', async () => {
    const latin = woff2('latin');
    const css = [
      face('cyrillic', '100 900', `${GSTATIC}cyr.woff2`),
      face('latin-ext', '100 900', `${GSTATIC}ext.woff2`),
      face('latin', '100 900', `${GSTATIC}latin.woff2`),
      face('latin', '100 900', `${GSTATIC}italic.woff2`, 'italic'),
    ].join('\n');
    const { fn, calls } = fakeFetch({
      [cssUrl('Roboto Slab', true)]: { body: css },
      [`${GSTATIC}latin.woff2`]: { body: latin },
    });
    const font = await addGoogleFont('Roboto Slab', { fetch: fn });
    expect(font.family).toBe('Roboto Slab');
    expect(font.files).toHaveLength(1);
    expect(font.files[0]!.weight).toBe('100 900');
    expect(font.files[0]!.file).toMatch(/^[0-9a-f]{32}\.woff2$/);
    expect(font.bytes).toBe(latin.length);
    expect(calls).toEqual([cssUrl('Roboto Slab', true), `${GSTATIC}latin.woff2`]);
    expect(listCustomFonts()).toEqual([font]);
    expect(availableFontFamilies()).toContain('Roboto Slab');
    expect(fs.readFileSync(path.join(process.env.FONTS_DIR!, font.files[0]!.file))).toEqual(latin);
    expect(customFontPath(font.files[0]!.file)).toBe(
      path.join(path.resolve(process.env.FONTS_DIR!), font.files[0]!.file),
    );
  });

  it('falls back to the plain URL when the weight range is rejected', async () => {
    const { fn, calls } = fakeFetch({
      [cssUrl('Bungee', true)]: { status: 400 },
      [cssUrl('Bungee', false)]: { body: face('latin', '400', `${GSTATIC}b.woff2`) },
      [`${GSTATIC}b.woff2`]: { body: woff2('b') },
    });
    const font = await addGoogleFont('Bungee', { fetch: fn });
    expect(font.files[0]!.weight).toBe('400');
    expect(calls[0]).toBe(cssUrl('Bungee', true));
    expect(calls[1]).toBe(cssUrl('Bungee', false));
  });

  it('404s for a name Google does not know', async () => {
    const { fn } = fakeFetch({
      [cssUrl('Nope Font', true)]: { status: 400 },
      [cssUrl('Nope Font', false)]: { status: 400 },
    });
    await rejects(addGoogleFont('Nope Font', { fetch: fn }), 404, /No Google Font named Nope Font/);
  });

  it('502s on other upstream failures', async () => {
    const { fn } = fakeFetch({ [cssUrl('Boom', true)]: { status: 500 } });
    await rejects(addGoogleFont('Boom', { fetch: fn }), 502);
    const failing = (async () => {
      throw new Error('network down');
    }) as typeof fetch;
    await rejects(addGoogleFont('Boom', { fetch: failing }), 502, /reach Google Fonts/);
  });

  it('502s when there is no latin block', async () => {
    const { fn } = fakeFetch({
      [cssUrl('Roboto Slab', true)]: { body: face('cyrillic', '400', `${GSTATIC}c.woff2`) },
    });
    await rejects(addGoogleFont('Roboto Slab', { fetch: fn }), 502, /no Latin/);
  });

  it('rejects bundled families (400) and downloaded ones (409), case-insensitively', async () => {
    const { fn, calls } = fakeFetch({
      [cssUrl('Roboto Slab', true)]: { body: face('latin', '400', `${GSTATIC}a.woff2`) },
      [`${GSTATIC}a.woff2`]: { body: woff2('a') },
    });
    await rejects(addGoogleFont('inter', { fetch: fn }), 400, /bundled/);
    await rejects(addGoogleFont('SPACE GROTESK', { fetch: fn }), 400);
    expect(calls).toEqual([]);
    await addGoogleFont('Roboto Slab', { fetch: fn });
    await rejects(addGoogleFont('roboto slab', { fetch: fn }), 409, /already downloaded/);
  });

  it('rejects a font URL outside fonts.gstatic.com', async () => {
    for (const url of [
      'https://evil.example.com/a.woff2',
      'http://fonts.gstatic.com/a.woff2',
      'https://fonts.gstatic.com.evil.example/a.woff2',
    ]) {
      const { fn, calls } = fakeFetch({
        [cssUrl('Roboto Slab', true)]: { body: face('latin', '400', url) },
      });
      await rejects(
        addGoogleFont('Roboto Slab', { fetch: fn }),
        502,
        /outside fonts\.gstatic\.com/,
      );
      expect(calls).toHaveLength(1);
    }
  });

  it('rejects an oversize file by content-length and by streamed size', async () => {
    const css = face('latin', '400', `${GSTATIC}big.woff2`);
    const big = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(1.5 * 1024 * 1024)]);
    const declared = fakeFetch({
      [cssUrl('Roboto Slab', true)]: { body: css },
      [`${GSTATIC}big.woff2`]: { body: 'x', headers: { 'content-length': String(big.length) } },
    });
    await rejects(addGoogleFont('Roboto Slab', { fetch: declared.fn }), 502, /1\.5 MB/);
    const streamed = fakeFetch({
      [cssUrl('Roboto Slab', true)]: { body: css },
      [`${GSTATIC}big.woff2`]: { body: big },
    });
    await rejects(addGoogleFont('Roboto Slab', { fetch: streamed.fn }), 502, /1\.5 MB/);
    expect(listCustomFonts()).toEqual([]);
  });

  it('rejects a file without the woff2 magic bytes', async () => {
    const { fn } = fakeFetch({
      [cssUrl('Roboto Slab', true)]: { body: face('latin', '400', `${GSTATIC}a.woff2`) },
      [`${GSTATIC}a.woff2`]: { body: Buffer.from('<html>nope</html>') },
    });
    await rejects(addGoogleFont('Roboto Slab', { fetch: fn }), 502, /not woff2/);
    expect(listCustomFonts()).toEqual([]);
  });
});

describe('deleteCustomFont', () => {
  const install = async () => {
    const { fn } = fakeFetch({
      [cssUrl('Roboto Slab', true)]: { body: face('latin', '400', `${GSTATIC}a.woff2`) },
      [`${GSTATIC}a.woff2`]: { body: woff2('a') },
    });
    return addGoogleFont('Roboto Slab', { fetch: fn });
  };

  it('removes the files and the metadata', async () => {
    const font = await install();
    const file = path.join(process.env.FONTS_DIR!, font.files[0]!.file);
    expect(fs.existsSync(file)).toBe(true);
    deleteCustomFont('Roboto Slab');
    expect(fs.existsSync(file)).toBe(false);
    expect(listCustomFonts()).toEqual([]);
  });

  it('404s for an unknown family', () => {
    expect(() => deleteCustomFont('Nope')).toThrowError(expect.objectContaining({ status: 404 }));
  });

  it('refuses with 409 while the theme uses the family', async () => {
    await install();
    vi.mocked(getTheme).mockReturnValue({
      effective: { ...DEFAULT_THEME, fonts: { ...DEFAULT_THEME.fonts, display: 'Roboto Slab' } },
      defaults: DEFAULT_THEME,
      overrides: {},
      availableFonts: [],
    });
    expect(() => deleteCustomFont('Roboto Slab')).toThrowError(
      expect.objectContaining({ status: 409, message: expect.stringContaining('theme uses') }),
    );
    expect(listCustomFonts()).toHaveLength(1);
  });
});

describe('customFontFaceCss', () => {
  it('renders one @font-face per file', () => {
    const css = customFontFaceCss([
      {
        family: 'Roboto Slab',
        files: [
          { file: 'a'.repeat(32) + '.woff2', weight: '100 900' },
          { file: 'b'.repeat(32) + '.woff2', weight: '400' },
        ],
        bytes: 1,
        addedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    expect(css.split('\n')).toEqual([
      `@font-face{font-family:"Roboto Slab";src:url("/kiosk/custom-fonts/${'a'.repeat(32)}.woff2") format("woff2");font-weight:100 900;font-style:normal;font-display:block}`,
      `@font-face{font-family:"Roboto Slab";src:url("/kiosk/custom-fonts/${'b'.repeat(32)}.woff2") format("woff2");font-weight:400;font-style:normal;font-display:block}`,
    ]);
    expect(customFontFaceCss([])).toBe('');
  });
});

describe('customFontPath', () => {
  it('only accepts strict hash filenames', () => {
    for (const bad of ['../x.woff2', 'a.woff2', `${'A'.repeat(32)}.woff2`, `${'a'.repeat(32)}.ttf`])
      expect(customFontPath(bad)).toBeNull();
    expect(customFontPath(`${'a'.repeat(32)}.woff2`)).not.toBeNull();
  });
});
