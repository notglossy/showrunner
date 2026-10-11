import type { CustomFont } from './tokens';

// TODO: Piece A (fonts) implements this file. Signatures are the contract; keep them.

/** Downloaded fonts, oldest first. */
export function listCustomFonts(): CustomFont[] {
  return [];
}

/** Bundled plus downloaded family names, for the theme's font pickers and validation. */
export function availableFontFamilies(): string[] {
  return [];
}

/** Downloads a family from Google Fonts (Latin subset, normal style), stores it, and reloads every device. */
export async function addGoogleFont(
  _family: string,
  _deps: { fetch?: typeof fetch } = {},
): Promise<CustomFont> {
  throw new Error('not implemented');
}

/** Deletes a downloaded family and its files; refuses (409) while the theme uses it. */
export function deleteCustomFont(_family: string): void {}

/** One `@font-face` rule per downloaded file, pointing at /kiosk/custom-fonts/<file>. Pure. */
export function customFontFaceCss(_fonts: CustomFont[]): string {
  return '';
}
