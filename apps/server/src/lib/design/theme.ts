import { eq } from 'drizzle-orm';

import { ApiError } from '@/lib/api/http';
import type { UpdateThemeRequest } from '@/lib/api/types';
import { getDb } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';

import { reloadAllDevices } from './css';
import { availableFontFamilies } from './fonts';
import {
  DEFAULT_THEME,
  type Theme,
  THEME_COLORS,
  THEME_FONTS,
  type ThemeOverrides,
  type ThemeState,
} from './tokens';

const THEME_KEY = 'theme';

function readOverrides(): ThemeOverrides {
  const row = getDb().select().from(settings).where(eq(settings.key, THEME_KEY)).get();
  return (row?.value as ThemeOverrides | undefined) ?? {};
}

function writeOverrides(overrides: ThemeOverrides) {
  const db = getDb();
  if (!Object.keys(overrides.colors ?? {}).length && !Object.keys(overrides.fonts ?? {}).length) {
    db.delete(settings).where(eq(settings.key, THEME_KEY)).run();
    return;
  }
  db.insert(settings)
    .values({ key: THEME_KEY, value: overrides })
    .onConflictDoUpdate({ target: settings.key, set: { value: overrides, updatedAt: new Date() } })
    .run();
}

/** Effective theme (defaults + stored overrides), the defaults, the overrides, and the fonts it may use. */
export function getTheme(): ThemeState {
  const overrides = readOverrides();
  const availableFonts = availableFontFamilies();
  const effective: Theme = {
    colors: { ...DEFAULT_THEME.colors },
    fonts: { ...DEFAULT_THEME.fonts },
  };
  // Invalid stored data (hand-edited row, deleted font) falls back to the default so designCss() never throws.
  for (const token of THEME_COLORS) {
    const hex = overrides.colors?.[token.key];
    if (typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex)) effective.colors[token.key] = hex;
  }
  for (const token of THEME_FONTS) {
    const family = overrides.fonts?.[token.key];
    if (typeof family === 'string' && !/["<>;{}\\]/.test(family) && availableFonts.includes(family))
      effective.fonts[token.key] = family;
  }
  return { effective, defaults: DEFAULT_THEME, overrides, availableFonts };
}

/** Applies a patch (null clears one value), validates font names, reloads every device. */
export function updateTheme(patch: UpdateThemeRequest): ThemeState {
  const available = availableFontFamilies();
  const stored = readOverrides();
  const colors: Record<string, string> = { ...stored.colors };
  const fonts: Record<string, string> = { ...stored.fonts };

  for (const token of THEME_COLORS) {
    const value = patch.colors?.[token.key];
    if (value === undefined) continue;
    const hex = value?.toLowerCase();
    if (hex == null || hex === token.default) delete colors[token.key];
    else colors[token.key] = hex;
  }
  for (const token of THEME_FONTS) {
    const value = patch.fonts?.[token.key];
    if (value === undefined) continue;
    const family = value?.trim();
    if (family != null && !available.includes(family))
      throw new ApiError(400, 'validation_failed', `Unknown font ${family}`);
    if (family == null || family === token.default) delete fonts[token.key];
    else fonts[token.key] = family;
  }

  const next: ThemeOverrides = {};
  if (Object.keys(colors).length) next.colors = colors;
  if (Object.keys(fonts).length) next.fonts = fonts;
  if (JSON.stringify(next) === JSON.stringify(stored)) return getTheme();
  writeOverrides(next);
  reloadAllDevices();
  return getTheme();
}

/** Drops every override (back to the defaults) and reloads every device. */
export function resetTheme(): ThemeState {
  writeOverrides({});
  reloadAllDevices();
  return getTheme();
}

/** `:root{--sr-*:...}` for the kiosk document shell. Pure; font values get quotes and the generic fallback. */
export function themeCss(theme: Theme): string {
  const vars: string[] = [];
  for (const token of THEME_COLORS) {
    const value = theme.colors[token.key];
    if (!/^#[0-9a-f]{6}$/i.test(value))
      throw new Error(`Invalid theme color for ${token.key}: ${value}`);
    vars.push(`${token.cssVar}:${value};`);
  }
  for (const token of THEME_FONTS) {
    const family = theme.fonts[token.key];
    if (!family || /["<>;{}\\]/.test(family))
      throw new Error(`Invalid theme font for ${token.key}: ${family}`);
    vars.push(`${token.cssVar}:"${family}", ${token.generic};`);
  }
  return `:root{${vars.join('')}}\nhtml,body{background:var(--sr-bg)}`;
}
