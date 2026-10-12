// Compile-time check that schemas.ts and types.ts agree. Checked by `pnpm typecheck`.
import type { z } from 'zod';

import type * as S from './schemas';
import type * as T from './types';

type Extends<A, B> = [A] extends [B] ? true : false;
/** Parsed output is usable as the interface, and any interface value is accepted as input. */
type InSync<Schema extends z.ZodType, I> =
  Extends<z.output<Schema>, I> extends true
    ? Extends<I, z.input<Schema>> extends true
      ? true
      : false
    : false;
const ok = <X extends true>(): X | void => undefined;

ok<InSync<typeof S.LoginRequestSchema, T.LoginRequest>>();
ok<InSync<typeof S.RegisterDeviceRequestSchema, T.RegisterDeviceRequest>>();
ok<InSync<typeof S.HeartbeatRequestSchema, T.HeartbeatRequest>>();
ok<InSync<typeof S.DeviceLogRequestSchema, T.DeviceLogRequest>>();
ok<InSync<typeof S.SetRegistrationRequestSchema, T.SetRegistrationRequest>>();
ok<InSync<typeof S.ClaimDeviceRequestSchema, T.ClaimDeviceRequest>>();
ok<InSync<typeof S.DeviceAssignmentSchema, T.DeviceAssignment>>();
ok<InSync<typeof S.UpdateDeviceRequestSchema, T.UpdateDeviceRequest>>();
ok<InSync<typeof S.DeviceCommandRequestSchema, T.DeviceCommandRequest>>();
ok<InSync<typeof S.DeviceLogsQuerySchema, T.DeviceLogsQuery>>();
ok<InSync<typeof S.CreateScreenRequestSchema, T.CreateScreenRequest>>();
ok<InSync<typeof S.UpdateScreenRequestSchema, T.UpdateScreenRequest>>();
ok<InSync<typeof S.PlaylistItemInputSchema, T.PlaylistItemInput>>();
ok<InSync<typeof S.CreatePlaylistRequestSchema, T.CreatePlaylistRequest>>();
ok<InSync<typeof S.UpdatePlaylistRequestSchema, T.UpdatePlaylistRequest>>();
ok<InSync<typeof S.UpdateThemeRequestSchema, T.UpdateThemeRequest>>();
ok<InSync<typeof S.AddFontRequestSchema, T.AddFontRequest>>();
ok<InSync<typeof S.UpdateInstructionsRequestSchema, T.UpdateInstructionsRequest>>();
