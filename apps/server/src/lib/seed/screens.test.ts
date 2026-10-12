import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateTemplate } from '@/lib/ai/validate';
import { THEME_COLORS, THEME_FONTS } from '@/lib/design/tokens';

import { BUILTIN_SCREENS } from './screens';

const frozen: { id: string; html: string }[] = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '__fixtures__/builtin-screens-before.json'), 'utf8'),
);

/** Finds every `var(--sr-name, fallback)` (balanced parens) and hands the pieces to `fn`. */
function mapThemeVars(html: string, fn: (name: string, fallback: string) => string): string {
  let out = '';
  let i = 0;
  const start = 'var(--sr-';
  for (;;) {
    const at = html.indexOf(start, i);
    if (at < 0) return out + html.slice(i);
    out += html.slice(i, at);
    let depth = 0;
    let end = at + 3;
    for (; end < html.length; end++) {
      if (html[end] === '(') depth++;
      else if (html[end] === ')' && --depth === 0) break;
    }
    const inner = html.slice(at + 4, end); // `--sr-name, fallback`
    const comma = inner.indexOf(',');
    out += fn(inner.slice(0, comma), inner.slice(comma + 1).trim());
    i = end + 1;
  }
}

/** Reverts the tokenising so the result can be compared with the frozen pre-theme HTML. */
function untokenise(html: string): string {
  // Display-font declarations were added (the originals inherited the body font); drop them first.
  const withoutDisplay = html
    .replace(/^ +font-family: var\(--sr-font-display,[^;]*\);\n/gm, '')
    .replace(/ font-family: var\(--sr-font-display,[^;]*\);/g, '');
  return mapThemeVars(withoutDisplay, (_name, fallback) => fallback);
}

/** Selectors that gained a display-font declaration (always as the rule's first declaration). */
const EXPECTED_DISPLAY_SELECTORS: Record<string, string[]> = {
  'builtin-clock': ['.ck-time'],
  'builtin-clock-weather': ['.cw-time, .cw-temp'],
  'builtin-dial': ['.temp'],
  'builtin-morning-brief': ['.mb-time', '.mb-temp'],
};

/** Selectors of the rules that open with a display-font declaration. */
function displaySelectors(html: string): string[] {
  const re = /([^{}]+)\{\s*font-family: var\(--sr-font-display,[^;]*\);/g;
  return [...html.matchAll(re)].map((m) => (m[1] ?? '').trim());
}

describe('built-in screens', () => {
  it('includes the Default, Clock, Clock & Weather and Dial screens', () => {
    expect(BUILTIN_SCREENS.map((s) => s.id).sort()).toEqual([
      'builtin-clock',
      'builtin-clock-weather',
      'builtin-dial',
      'builtin-morning-brief',
    ]);
  });

  for (const screen of BUILTIN_SCREENS) {
    describe(screen.id, () => {
      const html = screen.html;

      it('passes the template rules (fragment, no external resources, known data paths)', () => {
        expect(validateTemplate(html)).toEqual([]);
      });

      it('has metadata', () => {
        expect(screen.name.length).toBeGreaterThan(0);
        expect(screen.description.length).toBeGreaterThan(0);
        expect(screen.dataRefreshSeconds).toBeGreaterThanOrEqual(5);
      });

      it('only uses known theme tokens, with fallbacks equal to the token defaults', () => {
        const colors = new Map(THEME_COLORS.map((t) => [t.cssVar as string, t.default]));
        const fonts = new Map(THEME_FONTS.map((t) => [t.cssVar as string, t.default]));
        let seen = 0;
        mapThemeVars(html, (name, fallback) => {
          seen++;
          if (colors.has(name)) {
            const def = colors.get(name)!.toLowerCase();
            const isBlack = def === '#000000' && fallback.toLowerCase() === '#000';
            expect(isBlack || fallback.toLowerCase() === def, `${name}: ${fallback}`).toBe(true);
          } else {
            expect(fonts.has(name), `unknown token ${name}`).toBe(true);
            expect(fallback.startsWith(`"${fonts.get(name)}"`), `${name}: ${fallback}`).toBe(true);
          }
          return fallback;
        });
        expect(seen).toBeGreaterThan(0);
      });

      it('is identical to the pre-theme HTML once var() wrappers and theme-only edits are undone', () => {
        const before = frozen.find((f) => f.id === screen.id);
        expect(before).toBeDefined();
        const total = html.split('var(--sr-font-display').length - 1;
        const selectors = displaySelectors(html);
        expect(selectors).toEqual(EXPECTED_DISPLAY_SELECTORS[screen.id]);
        expect(total).toBe(selectors.length);
        const restored = untokenise(html)
          .replace(
            /Colors follow the Design theme; the fallbacks are the defaults\. Change them here/g,
            'Colors. Change them here',
          )
          .replace(
            'Weather panel color follows the Design theme; the fallback is the default. Change it here',
            'Weather panel color. Change it here',
          );
        expect(restored).toBe(before!.html);
      });
    });
  }
});
