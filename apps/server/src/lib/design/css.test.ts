import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { resetEnv } from '@/lib/env';
import { samplePayload } from '@/lib/providers/sample';
import { deviceUrls, renderKioskDocument } from '@/lib/render/document';

// Unmocked on purpose: exercises the real theme.ts <-> css.ts import cycle and the document shell.
import { designCss } from './css';
import { addGoogleFont, deleteCustomFont, listCustomFonts } from './fonts';
import { resetTheme, themeCss, updateTheme } from './theme';
import { DEFAULT_THEME } from './tokens';

const boot = {
  deviceId: 'd',
  screenId: 's',
  viewer: 'device' as const,
  refreshSeconds: 60,
  serverTime: 0,
  urls: deviceUrls('d'),
  data: samplePayload(),
};

describe('designCss', () => {
  it('is the default theme when nothing is customised', () => {
    resetTheme();
    expect(designCss()).toBe(themeCss(DEFAULT_THEME));
    expect(designCss()).toContain('--sr-accent:#6136f5;');
  });

  it('follows theme changes and lands after the base CSS in the kiosk document', () => {
    updateTheme({ colors: { accent: '#FF0000' } });
    const css = designCss();
    expect(css).toContain('--sr-accent:#ff0000;');
    const html = renderKioskDocument({ title: 't', body: '<p></p>', boot, designCss: css });
    const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
    expect(style.indexOf('background:#000;color:#fff')).toBeGreaterThan(-1);
    expect(style.indexOf(':root{--sr-bg')).toBeGreaterThan(style.indexOf('color:#fff'));
    resetTheme();
  });
});

describe('designCss with a downloaded font', () => {
  let dir: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-design-'));
    process.env.FONTS_DIR = dir;
    resetEnv();
  });
  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.FONTS_DIR;
    resetEnv();
  });

  it('declares the font before the theme, and the theme blocks deleting it', async () => {
    const fileUrl = 'https://fonts.gstatic.com/s/lobster/v1/a.woff2';
    const fakeFetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(':wght@')) return new Response('', { status: 400 });
      if (url.startsWith('https://fonts.googleapis.com/'))
        return new Response(
          `/* latin */\n@font-face {\n  font-family: 'Lobster';\n  font-style: normal;\n  font-weight: 400;\n  src: url(${fileUrl}) format('woff2');\n}\n`,
        );
      if (url === fileUrl) return new Response(Buffer.from('wOF2lobster'));
      return new Response('', { status: 404 });
    }) as typeof fetch;

    await addGoogleFont('Lobster', { fetch: fakeFetch });
    updateTheme({ fonts: { display: 'Lobster' } });

    const css = designCss();
    expect(css).toContain('--sr-font-display:"Lobster", system-ui, sans-serif;');
    expect(css.indexOf('font-family:"Lobster"')).toBeGreaterThan(-1);
    expect(css.indexOf('@font-face')).toBeLessThan(css.indexOf(':root{'));

    expect(() => deleteCustomFont('Lobster')).toThrow(/theme uses/i);
    resetTheme();
    deleteCustomFont('Lobster');
    expect(listCustomFonts()).toEqual([]);
    expect(designCss()).toBe(themeCss(DEFAULT_THEME));
  });
});
