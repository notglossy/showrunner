import type { UpdateThemeRequest } from '@/lib/api/types';

import { DEFAULT_THEME, type Theme, type ThemeState } from './tokens';

// TODO: Piece B (theme) implements this file. Signatures are the contract; keep them.

/** Effective theme (defaults + stored overrides), the defaults, the overrides, and the fonts it may use. */
export function getTheme(): ThemeState {
  return { effective: DEFAULT_THEME, defaults: DEFAULT_THEME, overrides: {}, availableFonts: [] };
}

/** Applies a patch (null clears one value), validates font names, reloads every device. */
export function updateTheme(_patch: UpdateThemeRequest): ThemeState {
  return getTheme();
}

/** Drops every override (back to the defaults) and reloads every device. */
export function resetTheme(): ThemeState {
  return getTheme();
}

/** `:root{--sr-*:...}` for the kiosk document shell. Pure; font values get quotes and the generic fallback. */
export function themeCss(_theme: Theme): string {
  return '';
}
