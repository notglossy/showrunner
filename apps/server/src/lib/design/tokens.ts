/**
 * Theme tokens screens can reference as CSS custom properties (`var(--sr-accent, #6136f5)`).
 * Client-safe (no server imports): the dashboard and the in-browser preview use it too.
 * Defaults are the palette and fonts the built-in screens shipped with, so the default theme changes nothing.
 * Keep docs/screen-authoring.md §2 "Theme" in sync.
 */

export type ThemeColorKey =
  'bg' | 'surface' | 'border' | 'text' | 'textMuted' | 'textFaint' | 'accent' | 'accentText';

export type ThemeFontKey = 'display' | 'body' | 'mono';

export type ThemeGroup = 'background' | 'text' | 'accent';

export interface ThemeColorToken {
  key: ThemeColorKey;
  cssVar: `--sr-${string}`;
  label: string;
  group: ThemeGroup;
  default: string;
  use: string;
}

export interface ThemeFontToken {
  key: ThemeFontKey;
  cssVar: `--sr-${string}`;
  label: string;
  default: string;
  /** Appended after the chosen family so text still renders if the font is missing. */
  generic: string;
  use: string;
}

export const THEME_COLORS: readonly ThemeColorToken[] = [
  {
    key: 'bg',
    cssVar: '--sr-bg',
    label: 'Background',
    group: 'background',
    default: '#000000',
    use: 'Page background',
  },
  {
    key: 'surface',
    cssVar: '--sr-surface',
    label: 'Surface',
    group: 'background',
    default: '#1b1b1b',
    use: 'Panels, tracks, raised areas',
  },
  {
    key: 'border',
    cssVar: '--sr-border',
    label: 'Border',
    group: 'background',
    default: '#2a2a2a',
    use: 'Dividers and outlines',
  },
  {
    key: 'text',
    cssVar: '--sr-text',
    label: 'Text',
    group: 'text',
    default: '#f2f2f2',
    use: 'Main text',
  },
  {
    key: 'textMuted',
    cssVar: '--sr-text-muted',
    label: 'Muted text',
    group: 'text',
    default: '#c9ced8',
    use: 'Secondary text',
  },
  {
    key: 'textFaint',
    cssVar: '--sr-text-faint',
    label: 'Faint text',
    group: 'text',
    default: '#8b8b8b',
    use: 'Labels and low-priority readouts',
  },
  {
    key: 'accent',
    cssVar: '--sr-accent',
    label: 'Accent',
    group: 'accent',
    default: '#6136f5',
    use: 'Accent fills (bars, panels)',
  },
  {
    key: 'accentText',
    cssVar: '--sr-accent-text',
    label: 'Accent text',
    group: 'accent',
    default: '#a995ff',
    use: 'Accent on the background: text, icons, hands',
  },
];

export const THEME_FONTS: readonly ThemeFontToken[] = [
  {
    key: 'display',
    cssVar: '--sr-font-display',
    label: 'Display',
    default: 'Space Grotesk',
    generic: 'system-ui, sans-serif',
    use: 'Big numbers and headings',
  },
  {
    key: 'body',
    cssVar: '--sr-font-body',
    label: 'Body',
    default: 'Space Grotesk',
    generic: 'system-ui, sans-serif',
    use: 'Everything else',
  },
  {
    key: 'mono',
    cssVar: '--sr-font-mono',
    label: 'Mono',
    default: 'JetBrains Mono',
    generic: 'monospace',
    use: 'Dates, labels, code-like readouts',
  },
];

export interface Theme {
  colors: Record<ThemeColorKey, string>;
  /** Font family names (no quotes, no fallbacks). */
  fonts: Record<ThemeFontKey, string>;
}

/** Only the values the owner changed. */
export interface ThemeOverrides {
  colors?: Partial<Record<ThemeColorKey, string>>;
  fonts?: Partial<Record<ThemeFontKey, string>>;
}

export const DEFAULT_THEME: Theme = {
  colors: Object.fromEntries(THEME_COLORS.map((t) => [t.key, t.default])) as Theme['colors'],
  fonts: Object.fromEntries(THEME_FONTS.map((t) => [t.key, t.default])) as Theme['fonts'],
};

/** What GET/PATCH/DELETE /api/design/theme return. */
export interface ThemeState {
  effective: Theme;
  defaults: Theme;
  overrides: ThemeOverrides;
  /** Font families the theme may use: bundled plus downloaded. */
  availableFonts: string[];
}

/** A Google Font downloaded to this server (Latin subset, normal style). */
export interface CustomFont {
  family: string;
  /** One entry per @font-face: file name under FONTS_DIR and its CSS font-weight descriptor. */
  files: { file: string; weight: string }[];
  /** Total size of the files in bytes. */
  bytes: number;
  /** ISO timestamp. */
  addedAt: string;
}

/** What GET /api/design/instructions and its PUT/DELETE return. */
export interface InstructionsState {
  /** The text the AI gets: the owner's version, or the authoring doc. */
  text: string;
  /** The authoring doc (docs/screen-authoring.md). */
  defaultText: string;
  customised: boolean;
  /** Customised, and the authoring doc changed since the owner last saved. */
  defaultChanged: boolean;
}
