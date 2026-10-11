/**
 * Zod schemas mirroring the request types in types.ts.
 * Keep the two files in sync: every interface/type in types.ts
 * gets one exported schema named `<TypeName>Schema`.
 */
import { z } from 'zod';

export const LoginRequestSchema = z.object({
  password: z.string().min(1).max(1024),
});

export const RegisterDeviceRequestSchema = z.object({
  deviceId: z.uuid(),
  model: z.string().min(1).max(100),
  androidVersion: z.string().min(1).max(32),
  appVersion: z.string().min(1).max(32),
  screenWidth: z.int().min(1).max(10000),
  screenHeight: z.int().min(1).max(10000),
});

export const HeartbeatRequestSchema = z.object({
  battery: z
    .object({
      level: z.int().min(0).max(100),
      charging: z.boolean(),
    })
    .nullable()
    .optional(),
  wifi: z
    .object({
      rssi: z.int().min(-127).max(0),
      ssid: z.string().max(64).nullable().optional(),
      linkSpeedMbps: z.int().min(0).max(100000).nullable().optional(),
    })
    .nullable()
    .optional(),
  currentUrl: z.string().max(2048).nullable().optional(),
  currentScreenId: z.string().max(100).nullable().optional(),
  uptimeSeconds: z.int().min(0).nullable().optional(),
  kioskMode: z.enum(['launcher', 'strict', 'immersive']).nullable().optional(),
  isDefaultHome: z.boolean().nullable().optional(),
});

export const DeviceLogRequestSchema = z.object({
  level: z.enum(['error', 'warn', 'info']).default('error'),
  message: z.string().min(1).max(4000),
  source: z.string().max(2048).nullable().optional(),
  line: z.int().min(0).nullable().optional(),
  column: z.int().min(0).nullable().optional(),
  stack: z.string().max(16000).nullable().optional(),
  url: z.string().max(2048).nullable().optional(),
  screenId: z.string().max(100).nullable().optional(),
});

export const SetRegistrationRequestSchema = z.object({
  open: z.boolean(),
});

export const ClaimDeviceRequestSchema = z.object({
  pairingCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJKMNP-Z2-9]{6}$/, 'Pairing code must be 6 characters'),
  name: z.string().trim().min(1).max(100),
});

export const DeviceAssignmentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('screen'), screenId: z.string().min(1).max(100) }),
  z.object({ type: z.literal('playlist'), playlistId: z.string().min(1).max(100) }),
]);

export const UpdateDeviceRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    assignment: DeviceAssignmentSchema.optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field is required',
  });

export const DeviceCommandRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('reload') }),
  z.object({ type: z.literal('refreshData') }),
  z.object({ type: z.literal('navigate'), screenId: z.string().min(1).max(100) }),
  z.object({ type: z.literal('openExitMenu') }),
  z.object({ type: z.literal('openSettings') }),
  z.object({ type: z.literal('exitStrictMode') }),
]);

export const DeviceLogsQuerySchema = z.object({
  limit: z.coerce.number().pipe(z.int().min(1).max(500)).default(100),
  before: z.coerce.number().pipe(z.int().min(1)).optional(),
});

/** Maximum screen name length, shared by create/update and client-side duplication. */
export const SCREEN_NAME_MAX = 100;

export const CreateScreenRequestSchema = z.object({
  name: z.string().trim().min(1).max(SCREEN_NAME_MAX),
  description: z.string().max(500).default(''),
  html: z.string().min(1).max(512000),
  dataRefreshSeconds: z.int().min(5).max(3600).default(60),
  source: z.enum(['user', 'ai']).default('user'),
  generationPrompt: z.string().max(4000).nullable().optional(),
});

export const UpdateScreenRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(SCREEN_NAME_MAX).optional(),
    description: z.string().max(500).optional(),
    html: z.string().min(1).max(512000).optional(),
    dataRefreshSeconds: z.int().min(5).max(3600).optional(),
    source: z.enum(['user', 'ai']).optional(),
    generationPrompt: z.string().max(4000).nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field is required',
  });

export const PlaylistItemInputSchema = z.object({
  screenId: z.string().min(1).max(100),
  dwellSeconds: z.int().min(5).max(86400),
});

export const CreatePlaylistRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  items: z.array(PlaylistItemInputSchema).max(200).default([]),
});

export const UpdatePlaylistRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    items: z.array(PlaylistItemInputSchema).max(200).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field is required',
  });

export const UpdateSettingsRequestSchema = z
  .object({
    weatherLatitude: z.number().min(-90).max(90).nullable().optional(),
    weatherLongitude: z.number().min(-180).max(180).nullable().optional(),
    weatherUnits: z.enum(['imperial', 'metric']).nullable().optional(),
    weatherLocationName: z.string().trim().min(1).max(100).nullable().optional(),
    timezone: z
      .string()
      .min(1)
      .refine((tz) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      }, 'Invalid IANA timezone')
      .nullable()
      .optional(),
    kioskExitPin: z
      .string()
      .regex(/^\d{4,8}$/, 'PIN must be 4-8 digits')
      .nullable()
      .optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field is required',
  });

export const GeocodeQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
});

export const GenerateScreenRequestSchema = z.object({
  instruction: z.string().trim().min(1).max(4000),
  currentHtml: z.string().max(512000).nullable().optional(),
  model: z.string().trim().min(1).max(200).optional(),
  previewErrors: z.array(z.string().min(1).max(1000)).max(20).optional(),
});
