import { count, eq } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import { devices, screens } from '@/lib/db/schema';
import { publish } from '@/lib/events/bus';
import { createScreen } from '@/lib/screens/service';

import { BUILTIN_SCREENS } from './screens';

/**
 * Brings existing built-in screen rows in line with the shipped templates: updates name, description,
 * html and refresh interval when they differ, and tells devices showing a changed screen to reload.
 * Built-ins are read-only (the API refuses edits), so no owner changes are lost. Built-ins the owner
 * deleted are not re-created, and rows with another source are left alone. Returns the ids updated.
 */
export function syncBuiltinScreens(): string[] {
  const db = getDb();
  const updated: string[] = [];
  const reload: string[] = [];
  db.transaction((tx) => {
    for (const row of tx.select().from(screens).where(eq(screens.source, 'builtin')).all()) {
      const shipped = BUILTIN_SCREENS.find((s) => s.id === row.id);
      if (!shipped) continue;
      if (
        row.name === shipped.name &&
        row.description === shipped.description &&
        row.html === shipped.html &&
        row.dataRefreshSeconds === shipped.dataRefreshSeconds
      ) {
        continue;
      }
      tx.update(screens)
        .set({
          name: shipped.name,
          description: shipped.description,
          html: shipped.html,
          dataRefreshSeconds: shipped.dataRefreshSeconds,
        })
        .where(eq(screens.id, row.id))
        .run();
      const showing = tx
        .select({ id: devices.id })
        .from(devices)
        .where(eq(devices.currentScreenId, row.id))
        .all();
      reload.push(...showing.map((d) => d.id));
      updated.push(row.id);
    }
  });
  // Published after the commit. Usually nobody is subscribed yet at startup (devices reconnect and
  // load the fresh page); this covers calling it on a running server.
  for (const id of reload) publish(id, { type: 'reload' });
  return updated;
}

/**
 * Inserts the built-in screens when the screens table is empty (first boot); otherwise syncs the
 * existing built-in rows to the shipped templates. Returns the ids inserted.
 * They stay read-only (source 'builtin'); the owner duplicates one to get an editable copy.
 */
export function seedBuiltinScreens(): string[] {
  const db = getDb();
  const existing = db.select({ n: count() }).from(screens).get()?.n ?? 0;
  if (existing > 0) {
    syncBuiltinScreens();
    return [];
  }
  for (const screen of BUILTIN_SCREENS) createScreen({ ...screen, source: 'builtin' });
  return BUILTIN_SCREENS.map((s) => s.id);
}
