import { createHash } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { AGENT_INSTRUCTIONS_KEY, authoringDoc } from '@/lib/ai/prompt';
import { getDb } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';

import type { InstructionsState } from './tokens';

interface StoredInstructions {
  text: string;
  baseHash: string;
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const normalise = (text: string) => text.replaceAll('\r\n', '\n');

function stored(): StoredInstructions | undefined {
  const row = getDb().select().from(settings).where(eq(settings.key, AGENT_INSTRUCTIONS_KEY)).get();
  return row?.value as StoredInstructions | undefined;
}

/** The AI's authoring guide: the owner's version, or docs/screen-authoring.md. */
export function getInstructions(): InstructionsState {
  const defaultText = authoringDoc();
  const row = stored();
  return {
    text: row?.text ?? defaultText,
    defaultText,
    customised: row !== undefined,
    defaultChanged: row !== undefined && row.baseHash !== sha256(defaultText),
  };
}

/** Stores the owner's version of the guide (identical to the authoring doc means not customised). */
export function updateInstructions(text: string): InstructionsState {
  const doc = authoringDoc();
  const normalised = normalise(text);
  if (normalised === normalise(doc)) return resetInstructions();
  const value: StoredInstructions = { text: normalised, baseHash: sha256(doc) };
  getDb()
    .insert(settings)
    .values({ key: AGENT_INSTRUCTIONS_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
    .run();
  return getInstructions();
}

/** Drops the owner's version (back to the authoring doc). */
export function resetInstructions(): InstructionsState {
  getDb().delete(settings).where(eq(settings.key, AGENT_INSTRUCTIONS_KEY)).run();
  return getInstructions();
}
