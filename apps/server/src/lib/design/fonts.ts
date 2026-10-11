import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { eq } from 'drizzle-orm';

import { ApiError, conflict, notFound } from '@/lib/api/http';
import { getDb } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { env } from '@/lib/env';
import { KIOSK_FONTS } from '@/lib/render/fonts';

import { reloadAllDevices } from './css';
import { getTheme } from './theme';
import type { CustomFont } from './tokens';

const SETTINGS_KEY = 'customFonts';
const CSS_ENDPOINT = 'https://fonts.googleapis.com/css2';
const FONT_HOST = 'fonts.gstatic.com';
const MAX_FILE_BYTES = 1.5 * 1024 * 1024;
const MAX_FAMILY_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const TOTAL_TIMEOUT_MS = 60_000;
const MAX_CSS_BYTES = 256 * 1024;
// Google serves woff2 only to browsers it recognises.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';

/** Folder the downloaded font files live in: FONTS_DIR, or `fonts/` next to the database. */
function fontsDir(): string {
  const e = env();
  // Runtime data directory (FONTS_DIR or next to the database): keep it out of build tracing.
  return path.resolve(
    /*turbopackIgnore: true*/ e.FONTS_DIR ??
      path.join(path.dirname(path.resolve(e.DATABASE_PATH)), 'fonts'),
  );
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Downloaded fonts, oldest first. */
export function listCustomFonts(): CustomFont[] {
  const row = getDb().select().from(settings).where(eq(settings.key, SETTINGS_KEY)).get();
  return (row?.value as CustomFont[] | undefined) ?? [];
}

function saveCustomFonts(fonts: CustomFont[]) {
  getDb()
    .insert(settings)
    .values({ key: SETTINGS_KEY, value: fonts })
    .onConflictDoUpdate({ target: settings.key, set: { value: fonts, updatedAt: new Date() } })
    .run();
}

/** Bundled plus downloaded family names, for the theme's font pickers and validation. */
export function availableFontFamilies(): string[] {
  return [...KIOSK_FONTS.map((f) => f.family), ...listCustomFonts().map((f) => f.family)];
}

const upstream = (message: string) => new ApiError(502, 'upstream_failed', message);

/** One stylesheet request. `axis` is e.g. `wght@400..700`, or null for the plain family. Null result = HTTP 400. */
async function fetchCss(
  fetchFn: typeof fetch,
  family: string,
  axis: string | null,
  deadline: AbortSignal,
): Promise<string | null> {
  const name = family.replace(/ /g, '+');
  const url = `${CSS_ENDPOINT}?family=${name}${axis ? `:${axis}` : ''}&display=block`;
  try {
    const res = await fetchFn(url, {
      headers: { 'user-agent': USER_AGENT },
      redirect: 'error',
      signal: AbortSignal.any([deadline, AbortSignal.timeout(TIMEOUT_MS)]),
    });
    if (res.status === 400) {
      await res.body?.cancel().catch(() => undefined);
      return null;
    }
    if (!res.ok) throw upstream(`Google Fonts answered HTTP ${res.status}`);
    const buf = await readCapped(res, MAX_CSS_BYTES);
    if (!buf) throw upstream('Google Fonts returned an unexpectedly large stylesheet');
    return buf.toString('utf8');
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw upstream('Could not reach Google Fonts');
  }
}

const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/**
 * Finds the stylesheet with every weight of a family, or null if Google does not know the name.
 * Google answers 400 for any axis range the family lacks and never says what the range is, so on
 * a 400 we probe each weight, then ask for the variable range (lo..hi) and, failing that, the list.
 */
async function discoverCss(
  fetchFn: typeof fetch,
  family: string,
  deadline: AbortSignal,
): Promise<string | null> {
  const full = await fetchCss(fetchFn, family, 'wght@100..900', deadline);
  if (full !== null) return full;
  // Cheap existence check so unknown names cost two requests, not ten.
  const plain = await fetchCss(fetchFn, family, null, deadline);
  if (plain === null) return null;
  const probes = await Promise.all(
    WEIGHTS.map(async (w) => ({ w, css: await fetchCss(fetchFn, family, `wght@${w}`, deadline) })),
  );
  const ok = probes.filter((p): p is { w: number; css: string } => p.css !== null);
  const first = ok[0];
  if (!first) return plain;
  if (ok.length === 1) return first.css;
  const lo = first.w;
  const hi = ok[ok.length - 1]!.w;
  const ranged = await fetchCss(fetchFn, family, `wght@${lo}..${hi}`, deadline);
  if (ranged !== null) return ranged;
  return fetchCss(fetchFn, family, `wght@${ok.map((p) => p.w).join(';')}`, deadline);
}

/** Reads a response body, or returns null as soon as it exceeds `max` bytes. */
async function readCapped(res: Response, max: number): Promise<Buffer | null> {
  const declared = Number(res.headers.get('content-length') ?? '0');
  if (!res.body) return Buffer.alloc(0);
  if (declared > max) {
    await res.body.cancel().catch(() => undefined);
    return null;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

interface FaceRef {
  family: string | undefined;
  weight: string;
  url: string;
}

/** Latin, normal-style @font-face blocks from Google's CSS (each is preceded by a subset comment). */
function parseLatinFaces(css: string): FaceRef[] {
  const faces: FaceRef[] = [];
  for (const m of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
    if (m[1] !== 'latin') continue;
    const body = m[2] ?? '';
    const style = /font-style:\s*([^;]+);/.exec(body)?.[1]?.trim();
    const weight = /font-weight:\s*([^;]+);/.exec(body)?.[1]?.trim();
    const family = /font-family:\s*['"]?([^;'"]+?)['"]?\s*;/.exec(body)?.[1]?.trim();
    const url = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/.exec(body)?.[1];
    if (style !== 'normal' || !weight || !url) continue;
    if (!/^\d{3}( \d{3})?$/.test(weight)) continue;
    faces.push({ family, weight, url });
  }
  return faces;
}

async function downloadFile(
  fetchFn: typeof fetch,
  rawUrl: string,
  deadline: AbortSignal,
): Promise<Buffer> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw upstream('Google Fonts returned an invalid font URL');
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== FONT_HOST ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== ''
  )
    throw upstream('Google Fonts returned a font URL outside fonts.gstatic.com');
  let buf: Buffer | null;
  try {
    const res = await fetchFn(url.href, {
      redirect: 'error',
      signal: AbortSignal.any([deadline, AbortSignal.timeout(TIMEOUT_MS)]),
    });
    if (!res.ok || !res.body) throw upstream(`Font download answered HTTP ${res.status}`);
    buf = await readCapped(res, MAX_FILE_BYTES);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw upstream('Could not download the font file');
  }
  if (!buf) throw upstream('A font file is larger than the 1.5 MB limit');
  if (buf.subarray(0, 4).toString('latin1') !== 'wOF2')
    throw upstream('Google Fonts returned a file that is not woff2');
  return buf;
}

/** Downloads a family from Google Fonts (Latin subset, normal style), stores it, and reloads every device. */
export async function addGoogleFont(
  family: string,
  deps: { fetch?: typeof fetch } = {},
): Promise<CustomFont> {
  const fetchFn = deps.fetch ?? fetch;
  if (KIOSK_FONTS.some((f) => same(f.family, family)))
    throw new ApiError(400, 'bad_request', `${family} is already bundled with ShowRunner`);
  if (listCustomFonts().some((f) => same(f.family, family)))
    throw conflict(`${family} is already downloaded`);

  const deadline = AbortSignal.timeout(TOTAL_TIMEOUT_MS);
  let css = await discoverCss(fetchFn, family, deadline);
  if (css === null) {
    // Google family names are case-sensitive; people type "roboto slab".
    const titled = family.replace(/\b[a-z]/g, (c) => c.toUpperCase());
    if (titled !== family) css = await discoverCss(fetchFn, titled, deadline);
  }
  if (css === null)
    throw new ApiError(
      404,
      'not_found',
      `No Google Font named "${family}". Use the exact name and capitalisation shown on fonts.google.com.`,
    );

  const faces = parseLatinFaces(css);
  if (faces.length === 0) throw upstream(`Google Fonts has no Latin files for ${family}`);
  // Google reports the canonical casing ("Roboto Slab" for "roboto slab").
  const canonical = faces.find((f) => f.family && same(f.family, family))?.family ?? family;

  const files: CustomFont['files'] = [];
  const buffers = new Map<string, Buffer>();
  let bytes = 0;
  for (const face of faces) {
    const buf = await downloadFile(fetchFn, face.url, deadline);
    bytes += buf.length;
    if (bytes > MAX_FAMILY_BYTES) throw upstream('The family is larger than the 5 MB limit');
    const file = `${createHash('sha256').update(buf).digest('hex').slice(0, 32)}.woff2`;
    buffers.set(file, buf);
    files.push({ file, weight: face.weight });
  }

  // Another request may have added it while we were downloading.
  const current = listCustomFonts();
  if (current.some((f) => same(f.family, canonical)))
    throw conflict(`${canonical} is already downloaded`);

  const dir = fontsDir();
  fs.mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  let saved = false;
  try {
    for (const [file, buf] of buffers) {
      // Write then rename so a crash never leaves a truncated file under its final name.
      const tmp = path.join(dir, `${file}.tmp-${randomBytes(6).toString('hex')}`);
      try {
        fs.writeFileSync(tmp, buf);
        fs.renameSync(tmp, path.join(dir, file));
      } catch (err) {
        fs.rmSync(tmp, { force: true });
        throw err;
      }
      written.push(file);
    }
    const font: CustomFont = {
      family: canonical,
      files,
      bytes,
      addedAt: new Date().toISOString(),
    };
    saveCustomFonts([...current, font]);
    saved = true;
    reloadAllDevices();
    return font;
  } catch (err) {
    if (saved) throw err;
    const used = new Set(current.flatMap((f) => f.files.map((x) => x.file)));
    for (const file of written)
      if (!used.has(file)) fs.rmSync(path.join(dir, file), { force: true });
    throw err;
  }
}

/** Deletes a downloaded family and its files; refuses (409) while the theme uses it. */
export function deleteCustomFont(family: string): void {
  const all = listCustomFonts();
  const font = all.find((f) => f.family === family);
  if (!font) throw notFound(`Font ${family}`);
  if (Object.values(getTheme().effective.fonts).includes(font.family))
    throw conflict(`The theme uses ${font.family}; pick another font first`);

  const rest = all.filter((f) => f !== font);
  const stillUsed = new Set(rest.flatMap((f) => f.files.map((x) => x.file)));
  saveCustomFonts(rest);
  const dir = fontsDir();
  for (const { file } of font.files)
    if (!stillUsed.has(file)) fs.rmSync(path.join(dir, file), { force: true });
  reloadAllDevices();
}

/** One `@font-face` rule per downloaded file, pointing at /kiosk/custom-fonts/<file>. Pure. */
export function customFontFaceCss(fonts: CustomFont[]): string {
  return fonts
    .flatMap((f) =>
      f.files.map(
        (x) =>
          `@font-face{font-family:"${f.family}";src:url("/kiosk/custom-fonts/${x.file}") format("woff2");font-weight:${x.weight};font-style:normal;font-display:block}`,
      ),
    )
    .join('\n');
}

/** Absolute path of a stored font file, or null if the name is not a strict hash filename. */
export function customFontPath(file: string): string | null {
  return /^[0-9a-f]{32}\.woff2$/.test(file) ? path.join(fontsDir(), file) : null;
}
