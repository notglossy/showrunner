import { createHash, randomBytes } from 'node:crypto';

import { eq } from 'drizzle-orm';

import type { UpdateSettingsRequest } from '@/lib/api/types';
import { getDb } from '@/lib/db/client';
import { devices, settings } from '@/lib/db/schema';
import { type Env, env } from '@/lib/env';
import { publish } from '@/lib/events/bus';
import { clearProviderCache } from '@/lib/providers/cache';
import type { ProviderConfig } from '@/lib/providers/types';

/** Settings the owner can change in the dashboard. Env vars supply the defaults. */
export interface KioskSettings {
  weatherLatitude: number;
  weatherLongitude: number;
  weatherUnits: 'imperial' | 'metric';
  weatherLocationName: string | null;
  timezone: string;
}

export type SettingsOverrides = Partial<KioskSettings>;

const OVERRIDES_KEY = 'overrides';
const KIOSK_PIN_KEY = 'kioskExitPin';
const HIDE_BUILTIN_KEY = 'hideBuiltinScreens';

/**
 * What devices receive to check the exit-menu PIN offline: sha256(`${salt}:${pin}`) as hex.
 * A convenience lock against passers-by, not strong security (4-8 digits are easy to brute-force).
 */
export interface KioskPinHash {
  salt: string;
  sha256: string;
}

export const hashKioskPin = (pin: string, salt: string) =>
  createHash('sha256').update(`${salt}:${pin}`).digest('hex');

/** Reads the stored exit-menu PIN hash, or null when no PIN is set. */
export function getKioskPinHash(): KioskPinHash | null {
  const row = getDb().select().from(settings).where(eq(settings.key, KIOSK_PIN_KEY)).get();
  return (row?.value as KioskPinHash | undefined) ?? null;
}

function setKioskPin(pin: string | null) {
  const db = getDb();
  if (pin === null) {
    db.delete(settings).where(eq(settings.key, KIOSK_PIN_KEY)).run();
    return;
  }
  const salt = randomBytes(16).toString('hex');
  const value: KioskPinHash = { salt, sha256: hashKioskPin(pin, salt) };
  db.insert(settings)
    .values({ key: KIOSK_PIN_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
    .run();
}

/** Whether the dashboard hides built-in screens from the Screens list and screen pickers. */
export function getHideBuiltinScreens(): boolean {
  const row = getDb().select().from(settings).where(eq(settings.key, HIDE_BUILTIN_KEY)).get();
  return row?.value === true;
}

function setHideBuiltinScreens(hide: boolean) {
  const db = getDb();
  if (!hide) {
    db.delete(settings).where(eq(settings.key, HIDE_BUILTIN_KEY)).run();
    return;
  }
  db.insert(settings)
    .values({ key: HIDE_BUILTIN_KEY, value: true })
    .onConflictDoUpdate({ target: settings.key, set: { value: true, updatedAt: new Date() } })
    .run();
}

/** Derives dashboard defaults from env config before overrides apply. */
export function defaultSettings(config: Env = env()): KioskSettings {
  return {
    weatherLatitude: config.WEATHER_LAT,
    weatherLongitude: config.WEATHER_LON,
    weatherUnits: config.WEATHER_UNITS,
    weatherLocationName: null,
    timezone: config.KIOSK_TIMEZONE,
  };
}

/** Reads the dashboard overrides patch, or an empty object when none are stored. */
export function getOverrides(): SettingsOverrides {
  const row = getDb().select().from(settings).where(eq(settings.key, OVERRIDES_KEY)).get();
  return (row?.value as SettingsOverrides | undefined) ?? {};
}

/** Merges env defaults with stored overrides, whether an exit PIN is set, and the built-in screens toggle. */
export function getSettings(): {
  effective: KioskSettings;
  defaults: KioskSettings;
  overrides: SettingsOverrides;
  kioskExitPinSet: boolean;
  hideBuiltinScreens: boolean;
} {
  const defaults = defaultSettings();
  const overrides = getOverrides();
  return {
    effective: { ...defaults, ...overrides },
    defaults,
    overrides,
    kioskExitPinSet: getKioskPinHash() !== null,
    hideBuiltinScreens: getHideBuiltinScreens(),
  };
}

/** Env config with dashboard overrides applied, as seen by data providers. */
export function effectiveConfig(): ProviderConfig {
  const { effective } = getSettings();
  return {
    ...env(),
    WEATHER_LAT: effective.weatherLatitude,
    WEATHER_LON: effective.weatherLongitude,
    WEATHER_UNITS: effective.weatherUnits,
    KIOSK_TIMEZONE: effective.timezone,
    WEATHER_LOCATION_NAME: effective.weatherLocationName,
  };
}

/** Applies a patch (null clears an override), drops cached provider data, and refreshes every device. */
export function updateSettings({
  kioskExitPin,
  hideBuiltinScreens,
  ...patch
}: UpdateSettingsRequest) {
  if (kioskExitPin !== undefined) setKioskPin(kioskExitPin);
  if (hideBuiltinScreens !== undefined) setHideBuiltinScreens(hideBuiltinScreens);
  const next: Record<string, unknown> = { ...getOverrides() };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete next[key];
    else if (value !== undefined) next[key] = value;
  }
  getDb()
    .insert(settings)
    .values({ key: OVERRIDES_KEY, value: next })
    .onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt: new Date() } })
    .run();
  clearProviderCache();
  // The runtime re-derives time fields from the refreshed payload's timezone, so no reload is needed.
  for (const d of getDb().select({ id: devices.id }).from(devices).all())
    publish(d.id, { type: 'refreshData' });
  return getSettings();
}
