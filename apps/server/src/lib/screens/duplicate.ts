import { SCREEN_NAME_MAX } from '@/lib/api/schemas';
import type { CreateScreenRequest } from '@/lib/api/types';
import type { Screen } from '@/lib/db/schema';

/** Draft fields needed to build a screen copy. */
export interface ScreenCopySource {
  name: string;
  description: string;
  html: string;
  dataRefreshSeconds: number;
  source: Screen['source'];
  generationPrompt: string | null;
}

/** Suffix appended to the copied screen's name. */
export const COPY_SUFFIX = ' (Copy)';

/** Builds the POST /api/screens body duplicating a screen draft as "<name> (Copy)". */
export function buildDuplicateScreenInput(
  draft: ScreenCopySource,
  opts: { savedName: string; aiPrompt: string | null },
): CreateScreenRequest {
  const base = (draft.name.trim() || opts.savedName).trimEnd();
  const name =
    base.length + COPY_SUFFIX.length > SCREEN_NAME_MAX
      ? `${base.slice(0, SCREEN_NAME_MAX - COPY_SUFFIX.length).trimEnd()}${COPY_SUFFIX}`
      : `${base}${COPY_SUFFIX}`;
  const prompt = opts.aiPrompt ?? draft.generationPrompt;
  return {
    name,
    description: draft.description,
    html: draft.html,
    dataRefreshSeconds: draft.dataRefreshSeconds,
    // The create schema rejects "builtin", so builtin originals copy as "user".
    source: opts.aiPrompt ? 'ai' : draft.source === 'builtin' ? 'user' : draft.source,
    ...(prompt ? { generationPrompt: prompt } : {}),
  };
}
