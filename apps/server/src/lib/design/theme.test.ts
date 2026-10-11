import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/http';
import { getDb } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';

const fonts = vi.hoisted(() => ({ list: [] as string[] }));

vi.mock('./css', () => ({ reloadAllDevices: vi.fn() }));
vi.mock('./fonts', () => ({ availableFontFamilies: () => [...fonts.list] }));

import { eq } from 'drizzle-orm';

import { reloadAllDevices } from './css';
import { getTheme, resetTheme, themeCss, updateTheme } from './theme';
import { DEFAULT_THEME } from './tokens';

const storedRow = () => getDb().select().from(settings).where(eq(settings.key, 'theme')).get();

beforeEach(() => {
  fonts.list = ['Space Grotesk', 'JetBrains Mono', 'Oswald', 'Lobster'];
  getDb().delete(settings).where(eq(settings.key, 'theme')).run();
  vi.mocked(reloadAllDevices).mockClear();
});

describe('theme service', () => {
  it('returns defaults when nothing is stored', () => {
    const state = getTheme();
    expect(state.effective).toEqual(DEFAULT_THEME);
    expect(state.defaults).toEqual(DEFAULT_THEME);
    expect(state.overrides).toEqual({});
    expect(state.availableFonts).toEqual(fonts.list);
  });

  it('stores only non-default values, lowercased, and reloads devices', () => {
    const state = updateTheme({
      colors: { accent: '#FF8800', bg: '#000000' },
      fonts: { display: 'Oswald', body: 'Space Grotesk' },
    });
    expect(state.overrides).toEqual({
      colors: { accent: '#ff8800' },
      fonts: { display: 'Oswald' },
    });
    expect(state.effective.colors.accent).toBe('#ff8800');
    expect(state.effective.fonts.display).toBe('Oswald');
    expect(state.effective.fonts.body).toBe('Space Grotesk');
    expect(storedRow()?.value).toEqual(state.overrides);
    expect(reloadAllDevices).toHaveBeenCalledTimes(1);
  });

  it('clears an override with null and keeps the others', () => {
    updateTheme({ colors: { accent: '#ff8800', surface: '#101010' } });
    const state = updateTheme({ colors: { accent: null } });
    expect(state.overrides).toEqual({ colors: { surface: '#101010' } });
    expect(state.effective.colors.accent).toBe(DEFAULT_THEME.colors.accent);
  });

  it('removes a value patched back to its default and deletes the row when empty', () => {
    updateTheme({ colors: { accent: '#ff8800' }, fonts: { mono: 'Lobster' } });
    updateTheme({ colors: { accent: DEFAULT_THEME.colors.accent.toUpperCase() } });
    expect(storedRow()?.value).toEqual({ fonts: { mono: 'Lobster' } });
    const state = updateTheme({ fonts: { mono: 'JetBrains Mono' } });
    expect(state.overrides).toEqual({});
    expect(storedRow()).toBeUndefined();
  });

  it('rejects an unknown font with 400 and stores nothing', () => {
    expect.assertions(4);
    try {
      updateTheme({ colors: { accent: '#ff8800' }, fonts: { body: 'Comic Sans' } });
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(400);
      expect((err as ApiError).message).toBe('Unknown font Comic Sans');
    }
    expect(storedRow()).toBeUndefined();
  });

  it('falls back to the default in effective when a stored font was deleted', () => {
    updateTheme({ fonts: { display: 'Lobster' } });
    fonts.list = fonts.list.filter((f) => f !== 'Lobster');
    const state = getTheme();
    expect(state.effective.fonts.display).toBe(DEFAULT_THEME.fonts.display);
    expect(state.overrides.fonts).toEqual({ display: 'Lobster' });
  });

  it('ignores invalid stored data in effective so themeCss never throws', () => {
    getDb()
      .insert(settings)
      .values({
        key: 'theme',
        value: { colors: { bg: 'red;}', accent: '#ABCDEF' }, fonts: { body: 'X";}' } },
      })
      .run();
    const { effective } = getTheme();
    expect(effective.colors.bg).toBe(DEFAULT_THEME.colors.bg);
    expect(effective.colors.accent).toBe('#ABCDEF');
    expect(effective.fonts.body).toBe(DEFAULT_THEME.fonts.body);
    expect(() => themeCss(effective)).not.toThrow();
  });

  it('does not write or reload when the patch changes nothing', () => {
    updateTheme({ colors: { accent: '#ff8800' } });
    vi.mocked(reloadAllDevices).mockClear();
    updateTheme({ colors: { accent: '#FF8800', bg: null } });
    expect(reloadAllDevices).not.toHaveBeenCalled();
    expect(storedRow()?.value).toEqual({ colors: { accent: '#ff8800' } });
  });

  it('resets everything and reloads devices', () => {
    updateTheme({ colors: { accent: '#ff8800' }, fonts: { display: 'Oswald' } });
    vi.mocked(reloadAllDevices).mockClear();
    const state = resetTheme();
    expect(state.overrides).toEqual({});
    expect(state.effective).toEqual(DEFAULT_THEME);
    expect(storedRow()).toBeUndefined();
    expect(reloadAllDevices).toHaveBeenCalledTimes(1);
  });
});

describe('themeCss', () => {
  it('renders the default theme exactly', () => {
    expect(themeCss(DEFAULT_THEME)).toBe(
      ':root{--sr-bg:#000000;--sr-surface:#1b1b1b;--sr-border:#2a2a2a;--sr-text:#f2f2f2;' +
        '--sr-text-muted:#c9ced8;--sr-text-faint:#8b8b8b;--sr-accent:#6136f5;--sr-accent-text:#a995ff;' +
        '--sr-font-display:"Space Grotesk", system-ui, sans-serif;' +
        '--sr-font-body:"Space Grotesk", system-ui, sans-serif;' +
        '--sr-font-mono:"JetBrains Mono", monospace;}\n' +
        'html,body{background:var(--sr-bg)}',
    );
  });

  it('throws on a color or font that could break out of the style element', () => {
    expect(() =>
      themeCss({ ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, bg: 'red;}</style>' } }),
    ).toThrow();
    expect(() =>
      themeCss({ ...DEFAULT_THEME, fonts: { ...DEFAULT_THEME.fonts, body: 'X";}</style>' } }),
    ).toThrow();
  });
});
