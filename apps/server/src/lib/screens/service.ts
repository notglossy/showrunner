import { randomUUID } from 'node:crypto';

import { asc, eq } from 'drizzle-orm';

import { ApiError, conflict, notFound } from '@/lib/api/http';
import type { CreateScreenRequest, UpdateScreenRequest } from '@/lib/api/types';
import { getDb } from '@/lib/db/client';
import { devices, playlistItems, playlists, type Screen, screens } from '@/lib/db/schema';
import { publish } from '@/lib/events/bus';

import { isReadOnlyScreen } from './read-only';

export type ScreenSummary = Omit<Screen, 'html'> & { htmlBytes: number };

/** Collapses a screen row to its summary with the template size in bytes. */
export function toScreenSummary({ html, ...rest }: Screen): ScreenSummary {
  return { ...rest, htmlBytes: Buffer.byteLength(html) };
}

/** Lists screen summaries ordered by name for the dashboard. */
export function listScreens(): ScreenSummary[] {
  return getDb().select().from(screens).orderBy(asc(screens.name)).all().map(toScreenSummary);
}

/** Finds a screen by id, or undefined when it does not exist. */
export function findScreen(id: string): Screen | undefined {
  return getDb().select().from(screens).where(eq(screens.id, id)).get();
}

/** Returns a screen by id, throwing 404 when it does not exist. */
export function getScreenOr404(id: string): Screen {
  const screen = findScreen(id);
  if (!screen) throw notFound('Screen');
  return screen;
}

// Built-ins ship with the dashboard and stay pristine; owners edit a duplicate instead.
function getEditableScreenOr404(id: string): Screen {
  const screen = getScreenOr404(id);
  if (isReadOnlyScreen(screen)) {
    throw new ApiError(
      403,
      'forbidden',
      'Built-in screens are read-only. Duplicate it to make an editable copy.',
    );
  }
  return screen;
}

/** Inserts a screen row with generated id and defaults for optional fields. */
export function createScreen(
  input: Omit<CreateScreenRequest, 'source'> & { id?: string; source?: Screen['source'] },
): Screen {
  return getDb()
    .insert(screens)
    .values({
      id: input.id ?? randomUUID(),
      name: input.name,
      description: input.description ?? '',
      html: input.html,
      dataRefreshSeconds: input.dataRefreshSeconds ?? 60,
      source: input.source ?? 'user',
      generationPrompt: input.generationPrompt ?? null,
    })
    .returning()
    .get();
}

/** Updates a screen and reloads every device currently showing it; 403 for built-in screens. */
export function updateScreen(id: string, input: UpdateScreenRequest): Screen {
  getEditableScreenOr404(id);
  const screen = getDb().update(screens).set(input).where(eq(screens.id, id)).returning().get();
  const showing = getDb()
    .select({ id: devices.id })
    .from(devices)
    .where(eq(devices.currentScreenId, id))
    .all();
  for (const d of showing) publish(d.id, { type: 'reload' });
  return screen;
}

/** Devices assigned this screen directly, and playlists that include it. */
export function screenUsage(id: string) {
  const db = getDb();
  const assigned = db
    .select({ id: devices.id, name: devices.name })
    .from(devices)
    .where(eq(devices.screenId, id))
    .all();
  const inPlaylists = db
    .selectDistinct({ id: playlists.id, name: playlists.name })
    .from(playlistItems)
    .innerJoin(playlists, eq(playlists.id, playlistItems.playlistId))
    .where(eq(playlistItems.screenId, id))
    .all();
  return { devices: assigned, playlists: inPlaylists };
}

/**
 * Deletes a screen. Refuses built-in screens (403) and, otherwise, refuses (409) while the
 * screen is assigned to a device or used by a playlist.
 */
export function deleteScreen(id: string): void {
  const db = getDb();
  getEditableScreenOr404(id);
  const { devices: assigned, playlists: inPlaylists } = screenUsage(id);
  if (assigned.length || inPlaylists.length) {
    const parts = [
      ...assigned.map((d) => `device "${d.name ?? d.id}"`),
      ...inPlaylists.map((p) => `playlist "${p.name}"`),
    ];
    throw conflict(`Screen is in use by ${parts.join(', ')}`);
  }
  db.delete(screens).where(eq(screens.id, id)).run();
}
