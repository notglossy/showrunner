import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { registerDevice } from '@/lib/devices/service';
import { type KioskEvent, subscribe } from '@/lib/events/bus';

import {
  defaultSettings,
  effectiveConfig,
  getHideBuiltinScreens,
  getSettings,
  updateSettings,
} from './service';

describe('settings', () => {
  it('defaults to env values with no overrides', () => {
    const { effective, defaults, overrides } = getSettings();
    expect(overrides).toEqual({});
    expect(effective).toEqual(defaults);
    expect(defaults).toEqual(defaultSettings());
    expect(effective.timezone).toBe('America/Los_Angeles');
  });

  it('applies overrides to provider config, clears them with null, and refreshes devices', () => {
    const { device } = registerDevice(
      {
        deviceId: randomUUID(),
        model: 'm',
        androidVersion: '11',
        appVersion: '1',
        screenWidth: 1280,
        screenHeight: 800,
      },
      null,
    );
    const events: KioskEvent[] = [];
    const off = subscribe(device.id, 'device', (e) => events.push(e));

    updateSettings({
      weatherLatitude: 51.5072,
      weatherLongitude: -0.1276,
      weatherLocationName: 'London',
      timezone: 'Europe/London',
      weatherUnits: 'metric',
    });
    expect(effectiveConfig()).toMatchObject({
      WEATHER_LAT: 51.5072,
      WEATHER_LON: -0.1276,
      WEATHER_UNITS: 'metric',
      KIOSK_TIMEZONE: 'Europe/London',
      WEATHER_LOCATION_NAME: 'London',
    });
    expect(events).toContainEqual({ type: 'refreshData' });

    const cleared = updateSettings({ timezone: null, weatherUnits: null });
    expect(cleared.overrides).toEqual({
      weatherLatitude: 51.5072,
      weatherLongitude: -0.1276,
      weatherLocationName: 'London',
    });
    expect(cleared.effective.timezone).toBe('America/Los_Angeles');
    expect(cleared.effective.weatherUnits).toBe('imperial');
    off();
  });

  it('stores hideBuiltinScreens separately from env overrides', () => {
    const before = getSettings();
    expect(before.hideBuiltinScreens).toBe(false);

    const hidden = updateSettings({ hideBuiltinScreens: true });
    expect(hidden.hideBuiltinScreens).toBe(true);
    expect(getSettings().hideBuiltinScreens).toBe(true);
    expect(hidden.overrides).toEqual(before.overrides);
    expect(hidden.overrides).not.toHaveProperty('hideBuiltinScreens');
    expect(hidden.effective).not.toHaveProperty('hideBuiltinScreens');

    expect(updateSettings({ hideBuiltinScreens: false }).hideBuiltinScreens).toBe(false);
    expect(getHideBuiltinScreens()).toBe(false);
  });
});
