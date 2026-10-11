import fs from 'node:fs';
import path from 'node:path';

import { eq } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { listCustomFonts } from '@/lib/design/fonts';
import { getTheme } from '@/lib/design/theme';
import { type CustomFont, type Theme, THEME_COLORS, THEME_FONTS } from '@/lib/design/tokens';
import { env } from '@/lib/env';

import type { ChatMessage } from './client';

const RESPONSE_FORMAT = `

---

## Response format (for generated screens)

Reply with exactly one fenced code block with the language \`html\` containing the complete screen fragment
(the <style>, the markup, and the optional trailing <script>). Do not write anything before or after the code block.
When you are given an existing template, return the whole updated fragment, not a diff or excerpt.`;

let cachedDoc: { path: string; mtimeMs: number; text: string } | undefined;

/** docs/screen-authoring.md, re-read when the file changes. */
export function authoringDoc(): string {
  const file =
    env().AUTHORING_DOC_PATH ?? path.resolve(process.cwd(), '../../docs/screen-authoring.md');
  // Runtime path (the Docker image copies the doc and sets AUTHORING_DOC_PATH): keep it out of build tracing.
  const { mtimeMs } = fs.statSync(/*turbopackIgnore: true*/ file);
  if (!cachedDoc || cachedDoc.path !== file || cachedDoc.mtimeMs !== mtimeMs) {
    cachedDoc = {
      path: file,
      mtimeMs,
      text: fs.readFileSync(/*turbopackIgnore: true*/ file, 'utf8'),
    };
  }
  return cachedDoc.text;
}

/** Settings row holding the owner's edited guide (`{ text, baseHash }`); managed by lib/design/instructions. */
export const AGENT_INSTRUCTIONS_KEY = 'agentInstructions';

// Read here rather than via lib/design/instructions, which imports authoringDoc from this file.
function storedInstructionsText(): string | undefined {
  const row = getDb().select().from(settings).where(eq(settings.key, AGENT_INSTRUCTIONS_KEY)).get();
  const text = (row?.value as { text?: unknown } | undefined)?.text;
  return typeof text === 'string' ? text : undefined;
}

const cell = (value: string) => value.replaceAll('|', '\\|');

function formatWeights(font: CustomFont): string {
  const weights = [...new Set(font.files.map((f) => f.weight.trim()))];
  weights.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  return weights.map((w) => w.replace(/^(\d+)\s+(\d+)$/, '$1\u2013$2')).join(', ');
}

/** Markdown listing the theme variables (with current values as fallbacks) and any downloaded fonts. Pure. */
export function designAppendix(theme: Theme, fonts: CustomFont[]): string {
  const rows = [
    ...THEME_COLORS.map((t) => `| \`${t.cssVar}\` | \`${theme.colors[t.key]}\` | ${cell(t.use)} |`),
    ...THEME_FONTS.map(
      (t) =>
        `| \`${t.cssVar}\` | \`"${cell(theme.fonts[t.key])}", ${t.generic}\` | ${cell(t.use)} |`,
    ),
  ];
  let out = `

---

## This installation's theme and fonts

The owner's theme is available as CSS custom properties on :root. Prefer them over hardcoded colors and fonts so the screen follows the theme, always with the listed value as the fallback, e.g. \`color: var(--sr-text-muted, ${theme.colors.textMuted});\`.

| Variable | Current value | Use |
|---|---|---|
${rows.join('\n')}`;
  if (fonts.length > 0) {
    out += `

### Extra fonts downloaded by the owner

| font-family | Weights |
|---|---|
${fonts.map((f) => `| \`"${cell(f.family)}"\` | ${cell(formatWeights(f))} |`).join('\n')}

Declared with @font-face on every screen like the fonts in section 2; end the font-family list with a generic family.`;
  }
  return out;
}

/**
 * System prompt: the instructions (an explicit `doc`, else the owner's edited guide, else the authoring
 * guide), the generated theme/fonts appendix, then the one-`html`-block reply contract.
 */
export function systemPrompt(doc?: string): string {
  const instructions = doc ?? storedInstructionsText() ?? authoringDoc();
  return instructions + designAppendix(getTheme().effective, listCustomFonts()) + RESPONSE_FORMAT;
}

/** Chat history for a new screen or an edit of `currentHtml`, with preview errors folded in. */
export function buildMessages({
  instruction,
  currentHtml,
  previewErrors,
  doc,
}: {
  instruction: string;
  currentHtml?: string | null;
  previewErrors?: string[];
  doc?: string;
}): ChatMessage[] {
  const system: ChatMessage = { role: 'system', content: systemPrompt(doc) };
  if (!currentHtml?.trim()) {
    return [system, { role: 'user', content: `Create a new screen.\n\n${instruction}` }];
  }
  const errors = previewErrors?.length
    ? `\nWhen previewed, it reported these JavaScript errors:\n${previewErrors.map((e) => `- ${e}`).join('\n')}\n`
    : '';
  return [
    system,
    {
      role: 'user',
      content: `Here is the current screen template:\n\n\`\`\`html\n${currentHtml}\n\`\`\`\n${errors}\nChange it as follows:\n\n${instruction}`,
    },
  ];
}

/** Follow-up asking the model to fix the listed guide violations. */
export function repairMessage(problems: string[]): ChatMessage {
  return {
    role: 'user',
    content: `That screen breaks these rules from the guide:\n${problems.map((p) => `- ${p}`).join('\n')}\n\nReturn the corrected complete fragment in one \`\`\`html code block.`,
  };
}
