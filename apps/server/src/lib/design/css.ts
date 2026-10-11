import { getDb } from '@/lib/db/client';
import { devices } from '@/lib/db/schema';
import { publish } from '@/lib/events/bus';

import { customFontFaceCss, listCustomFonts } from './fonts';
import { getTheme, themeCss } from './theme';

/** Downloaded-font @font-face rules plus the theme's custom properties, added to every kiosk document. */
export function designCss(): string {
  return [customFontFaceCss(listCustomFonts()), themeCss(getTheme().effective)]
    .filter(Boolean)
    .join('\n');
}

/** Reloads every device so a theme or font change shows up (the design CSS is in the document head). */
export function reloadAllDevices(): void {
  for (const d of getDb().select({ id: devices.id }).from(devices).all())
    publish(d.id, { type: 'reload' });
}
