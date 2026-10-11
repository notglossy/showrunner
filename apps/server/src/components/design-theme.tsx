'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { UpdateThemeRequest } from '@/lib/api/types';
import { api, ApiClientError } from '@/lib/client/api';
import {
  type Theme,
  THEME_COLORS,
  THEME_FONTS,
  type ThemeColorKey,
  type ThemeFontKey,
  type ThemeGroup,
  type ThemeState,
} from '@/lib/design/tokens';

import { Button, Card, ErrorText, inputBase } from './ui';

const HEX = /^#[0-9a-f]{6}$/i;
const GROUPS: { id: ThemeGroup; title: string }[] = [
  { id: 'background', title: 'Background' },
  { id: 'text', title: 'Text' },
  { id: 'accent', title: 'Accent' },
];

const stack = (family: string, generic: string) => `"${family}", ${generic}`;

function ChangedMarker() {
  return <span className="label-mono text-signal text-xs">changed</span>;
}

export function DesignTheme({ state }: { state: ThemeState }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Theme>(state.effective);
  const [colors, setColors] = useState<Record<ThemeColorKey, string>>(state.effective.colors);
  const [fonts, setFonts] = useState<Record<ThemeFontKey, string>>(state.effective.fonts);
  // Last valid hex per color, so the swatch holds still while the text box is mid-edit.
  const [lastValid, setLastValid] = useState<Record<ThemeColorKey, string>>(state.effective.colors);
  const [fontList, setFontList] = useState<string[]>(state.availableFonts);
  const [pending, setPending] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const valid = THEME_COLORS.every((t) => HEX.test(colors[t.key]));
  const dirty =
    THEME_COLORS.some((t) => colors[t.key].toLowerCase() !== saved.colors[t.key]) ||
    THEME_FONTS.some((t) => fonts[t.key] !== saved.fonts[t.key]);

  const touch = () => {
    setNotice(null);
    setConfirmReset(false);
  };

  function adopt(next: ThemeState) {
    setSaved(next.effective);
    setColors(next.effective.colors);
    setLastValid(next.effective.colors);
    setFonts(next.effective.fonts);
    setFontList(next.availableFonts);
  }

  async function save() {
    const body: UpdateThemeRequest = { colors: {}, fonts: {} };
    for (const t of THEME_COLORS) {
      const value = colors[t.key].toLowerCase();
      if (value === saved.colors[t.key]) continue;
      body.colors![t.key] = value === t.default ? null : value;
    }
    for (const t of THEME_FONTS) {
      if (fonts[t.key] === saved.fonts[t.key]) continue;
      body.fonts![t.key] = fonts[t.key] === t.default ? null : fonts[t.key];
    }
    setPending(true);
    setError(null);
    try {
      adopt(await api<ThemeState>('/api/design/theme', { method: 'PATCH', body }));
      setNotice('Saved. Connected displays are reloading.');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    } finally {
      setPending(false);
    }
  }

  async function reset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setPending(true);
    setError(null);
    try {
      adopt(await api<ThemeState>('/api/design/theme', { method: 'DELETE' }));
      setConfirmReset(false);
      setNotice('Back to the defaults. Connected displays are reloading.');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    } finally {
      setPending(false);
    }
  }

  const c = colors;
  const sampleOk = valid;
  const bg = sampleOk ? c.bg : saved.colors.bg;

  return (
    <Card title="Theme">
      <div className="flex flex-col gap-6">
        <p className="text-subtle text-sm">
          Colors and fonts screens can use as CSS variables (var(--sr-accent) and friends). The
          built-in screens follow them; your own screens follow them when they use the variables.
        </p>

        <div className="grid gap-6 lg:grid-cols-3">
          {GROUPS.map((group) => (
            <div key={group.id} className="flex flex-col gap-4">
              <h3 className="label-mono text-ink">{group.title}</h3>
              {THEME_COLORS.filter((t) => t.group === group.id).map((t) => {
                const value = colors[t.key];
                const ok = HEX.test(value);
                const changed = ok && value.toLowerCase() !== t.default;
                return (
                  <div key={t.key} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-ink text-sm">{t.label}</span>
                      {changed && <ChangedMarker />}
                    </div>
                    <span className="text-subtle text-xs">{t.use}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label={`${t.label} color`}
                        className="border-ink h-10 w-12 shrink-0 cursor-pointer rounded border bg-white p-1"
                        value={(ok ? value : lastValid[t.key]).toLowerCase()}
                        disabled={pending}
                        onChange={(e) => {
                          setColors((p) => ({ ...p, [t.key]: e.target.value }));
                          setLastValid((p) => ({ ...p, [t.key]: e.target.value }));
                          touch();
                        }}
                      />
                      <input
                        type="text"
                        aria-label={`${t.label} hex`}
                        aria-invalid={!ok}
                        aria-describedby={ok ? undefined : `hex-hint-${t.key}`}
                        spellCheck={false}
                        maxLength={7}
                        className={`${inputBase} min-w-0 flex-1 font-mono ${ok ? '' : 'border-danger'}`}
                        value={value}
                        disabled={pending}
                        onChange={(e) => {
                          const next = e.target.value.trim();
                          setColors((p) => ({ ...p, [t.key]: next }));
                          if (HEX.test(next)) setLastValid((p) => ({ ...p, [t.key]: next }));
                          touch();
                        }}
                      />
                    </div>
                    {!ok && (
                      <span id={`hex-hint-${t.key}`} className="text-danger text-xs">
                        Use #rrggbb
                      </span>
                    )}
                    <code className="text-subtle font-mono text-xs">{t.cssVar}</code>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="label-mono text-ink">Fonts</h3>
          <div className="grid gap-6 lg:grid-cols-3">
            {THEME_FONTS.map((t) => {
              const changed = fonts[t.key] !== t.default;
              const options = fontList.includes(fonts[t.key])
                ? fontList
                : [fonts[t.key], ...fontList];
              return (
                <div key={t.key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor={`font-${t.key}`} className="text-ink text-sm">
                      {t.label}
                    </label>
                    {changed && <ChangedMarker />}
                  </div>
                  <span className="text-subtle text-xs">{t.use}</span>
                  <select
                    id={`font-${t.key}`}
                    className={`${inputBase} w-full`}
                    style={{ fontFamily: stack(fonts[t.key], t.generic) }}
                    value={fonts[t.key]}
                    disabled={pending}
                    onChange={(e) => {
                      setFonts((p) => ({ ...p, [t.key]: e.target.value }));
                      touch();
                    }}
                  >
                    {options.map((family) => (
                      <option
                        key={family}
                        value={family}
                        style={{ fontFamily: stack(family, t.generic) }}
                      >
                        {family}
                      </option>
                    ))}
                  </select>
                  <p
                    className="text-ink text-lg"
                    style={{ fontFamily: stack(fonts[t.key], t.generic) }}
                  >
                    Quick brown fox 0123456789
                  </p>
                  <code className="text-subtle font-mono text-xs">{t.cssVar}</code>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="label-mono text-ink">Preview</h3>
          <div
            className="flex flex-col gap-3 rounded border p-5"
            style={{
              background: bg,
              borderColor: sampleOk ? c.border : saved.colors.border,
              fontFamily: stack(fonts.body, 'system-ui, sans-serif'),
            }}
          >
            <div
              className="text-6xl leading-none"
              style={{ color: '#fff', fontFamily: stack(fonts.display, 'system-ui, sans-serif') }}
            >
              12:34
            </div>
            <p style={{ color: sampleOk ? c.text : saved.colors.text }}>
              Body text in the main text color.
            </p>
            <p style={{ color: sampleOk ? c.textMuted : saved.colors.textMuted }}>
              Muted text for secondary lines.
            </p>
            <p style={{ color: sampleOk ? c.textFaint : saved.colors.textFaint }}>
              Faint text for labels and readouts.
            </p>
            <div
              className="flex flex-col gap-2 rounded border p-3"
              style={{
                background: sampleOk ? c.surface : saved.colors.surface,
                borderColor: sampleOk ? c.border : saved.colors.border,
              }}
            >
              <div
                className="h-2 rounded"
                style={{ background: sampleOk ? c.accent : saved.colors.accent }}
              />
              <span
                className="text-sm"
                style={{
                  color: sampleOk ? c.accentText : saved.colors.accentText,
                  fontFamily: stack(fonts.mono, 'monospace'),
                }}
              >
                SAT 11 OCT
              </span>
            </div>
          </div>
        </div>

        {error && <ErrorText>{error}</ErrorText>}
        {notice && <p className="text-subtle text-sm">{notice}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={save} disabled={pending || !valid || !dirty}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
          <Button
            variant={confirmReset ? 'danger' : 'secondary'}
            onClick={reset}
            disabled={pending}
          >
            {confirmReset ? 'Click again to reset' : 'Reset to defaults'}
          </Button>
          <span className="text-subtle text-xs">Connected displays reload when you save.</span>
        </div>
      </div>
    </Card>
  );
}
