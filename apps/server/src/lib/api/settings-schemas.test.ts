import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import * as S from './schemas';
import type * as T from './types';

type Extends<A, B> = [A] extends [B] ? true : false;
type InSync<Schema extends z.ZodType, I> =
  Extends<z.output<Schema>, I> extends true
    ? Extends<I, z.input<Schema>> extends true
      ? true
      : false
    : false;
const ok = <X extends true>(): X | void => undefined;
ok<InSync<typeof S.UpdateSettingsRequestSchema, T.UpdateSettingsRequest>>();
ok<InSync<typeof S.GeocodeQuerySchema, T.GeocodeQuery>>();

const pass = (v: unknown) => expect(S.UpdateSettingsRequestSchema.safeParse(v).success).toBe(true);
const fail = (v: unknown) => expect(S.UpdateSettingsRequestSchema.safeParse(v).success).toBe(false);

describe('settings schemas', () => {
  it('accepts partial updates and null to clear', () => {
    pass({ weatherLatitude: 51.5, weatherLongitude: -0.12 });
    pass({ weatherUnits: 'metric' });
    pass({ timezone: 'Europe/London' });
    pass({ hideBuiltinScreens: true });
    pass({ hideBuiltinScreens: false });
    pass({
      weatherLatitude: null,
      weatherLongitude: null,
      weatherUnits: null,
      weatherLocationName: null,
      timezone: null,
    });
    expect(S.UpdateSettingsRequestSchema.parse({ weatherLocationName: '  London  ' })).toEqual({
      weatherLocationName: 'London',
    });
    expect(S.UpdateSettingsRequestSchema.parse({ weatherUnits: 'metric' })).toEqual({
      weatherUnits: 'metric',
    });
  });
  it('rejects out-of-range, bad enums, bad timezones, empty updates', () => {
    fail({});
    fail({ weatherLatitude: 91 });
    fail({ weatherLongitude: -181 });
    fail({ weatherLatitude: '34' });
    fail({ weatherUnits: 'kelvin' });
    fail({ timezone: 'Mars/Olympus_Mons' });
    fail({ timezone: '' });
    fail({ weatherLocationName: '   ' });
    fail({ weatherLocationName: 'x'.repeat(101) });
    fail({ hideBuiltinScreens: 'true' });
    fail({ hideBuiltinScreens: null });
  });
  it('geocode query', () => {
    expect(S.GeocodeQuerySchema.parse({ q: '  Paris ' })).toEqual({ q: 'Paris' });
    expect(S.GeocodeQuerySchema.safeParse({ q: 'P' }).success).toBe(false);
    expect(S.GeocodeQuerySchema.safeParse({}).success).toBe(false);
  });
});
