# HTTP API

All request bodies are JSON and validated with Zod (`apps/server/src/lib/api/schemas.ts`, types in
`types.ts`). Every error response has the same shape:

```json
{ "error": { "code": "validation_failed", "message": "Request validation failed",
             "issues": [{ "path": "deviceId", "message": "Invalid UUID" }] } }
```

Codes: `bad_request` 400, `validation_failed` 400, `unauthorized` 401, `forbidden` 403,
`registration_closed` 403, `not_found` 404, `conflict` 409, `payload_too_large` 413,
`internal_error` 500.

## Authentication

| Caller | How |
|---|---|
| **Admin** | `showrunner_admin` session cookie from `POST /api/auth/login`, **or** `Authorization: Bearer <ADMIN_PASSWORD>`. |
| **Device, registration** | Any one of: the device's current token (Bearer or cookie, see below); `X-Kiosk-Secret: <DEVICE_SHARED_SECRET>` when the server has that variable set; or, without a secret, the dashboard's **registration window** being open (Devices → "Add a display", 10 minutes, closes on claim). A claimed device id can only be re-registered with its token. `GET /api/health` reports the mode. |
| **Device, everything else** | The per-device token returned by registration, as `Authorization: Bearer <token>` (native calls) **or** the cookie `showrunner_device=<deviceId>.<token>` set for the server origin (WebView page, data, SSE, log). Registering again rotates the token; the previous token keeps working for 10 minutes (covers HTTP stacks that silently retry the registration POST), and older ones stop working. |

Per-device read endpoints (`/device/:id`, `data`, `events`) also accept an admin so the owner can
preview a device in a browser. For non-admins an unknown device and a bad token both return 401.

## Unauthenticated

### `GET /api/health`
```json
{ "ok": true, "service": "showrunner", "time": "…",
  "registration": { "mode": "window", "open": true, "closesAt": "…" } }
```
Used by the Docker health check and by a display's setup flow: `mode` is `secret` (send
`X-Kiosk-Secret`; `open` is always true) or `window` (register only while `open`; `closesAt` is
null when closed). Call it once per connect attempt (and no more often than the 30-second
heartbeat while waiting for the window); the reply is `Cache-Control: no-store`.

## Device-facing

### `POST /api/devices/register`
Gated as described under Authentication (token, shared secret, or open window). Body:
```json
{ "deviceId": "3f2b7c1e-8a4d-4e6f-9b0a-1c2d3e4f5a6b", "model": "Echo_Show_8", "androidVersion": "11",
  "appVersion": "0.1.0", "screenWidth": 1280, "screenHeight": 800 }
```
200:
```json
{ "deviceId": "3f2b…", "token": "DhGT…", "cookie": { "name": "showrunner_device", "value": "3f2b….DhGT…" },
  "claimed": false, "name": null, "pairingCode": "3382FP", "pageUrl": "/device/3f2b…",
  "heartbeatIntervalSeconds": 30 }
```
The shell should set `cookie` for the server origin, then load `pageUrl`. On any 401 from
heartbeat or the page, register again. Unclaimed devices keep
their pairing code across re-registrations.

### `POST /api/devices/:id/heartbeat`
Device token only (admins get 403). Body (all optional):
```json
{ "battery": { "level": 100, "charging": true }, "wifi": { "rssi": -52, "ssid": "home", "linkSpeedMbps": 144 },
  "currentUrl": "http://…/device/3f2b…", "currentScreenId": "builtin-clock", "uptimeSeconds": 3600,
  "kioskMode": "launcher", "isDefaultHome": true }
```
200 (the watchdog's ack):
```json
{ "ok": true, "serverTime": 1789335035932, "claimed": true, "currentScreenId": "builtin-clock",
  "eventsConnected": true, "heartbeatIntervalSeconds": 30,
  "kiosk": { "exitPin": { "salt": "…", "sha256": "…" }, "commands": ["openExitMenu"] } }
```
`kiosk.exitPin` is `null` when no PIN is set. `kiosk.commands` are native commands queued from the dashboard
(`openExitMenu`, `openSettings`, `exitStrictMode`); each is delivered once. Registration replies also include
`kiosk.exitPin`.
`eventsConnected` says whether the device's page currently has its SSE stream open.

### `GET /device/:id`
HTML. Renders the pairing screen (unclaimed), a "no screen assigned" screen, or the current screen
template with the kiosk runtime. 401 page if the token is missing/invalid, 404 page for admins
viewing an unknown device.

### `GET /api/devices/:id/data`
The `kiosk.data` payload (see `docs/screen-authoring.md` §6; formatted `time.*` fields are added by
the runtime in the browser).

### `GET /api/devices/:id/events`
`text/event-stream`. Each message is `data: <json>`:
`{"type":"hello","screenId":…,"serverTime":…}` on connect, then `{"type":"reload"}`,
`{"type":"navigate","screenId":…}`, `{"type":"refreshData"}`. Comment pings every 25 s.

### `GET /kiosk/custom-fonts/:file`

A downloaded font (`<32 hex>.woff2`), unauthenticated and cached as immutable. Referenced by the
`@font-face` rules in every kiosk document.

### `POST /api/devices/:id/log`
Device token only. Body `{ "level": "error", "message": "…", "source", "line", "column", "stack",
"url", "screenId" }`. 202 `{ "stored": true }`, or 429 `{ "stored": false }` when over 60 lines/min.
The last 1000 lines per device are kept.

## Admin

| Method & path | Body / query | Response |
|---|---|---|
| `POST /api/auth/login` | `{ "password" }` | `{ ok, expiresAt }` + session cookie (30 days) |
| `POST /api/auth/logout` | | clears cookie |
| `GET /api/devices` | | `{ devices: DeviceView[] }` |
| `GET /api/devices/registration` | | `{ registration: { mode, open, closesAt } }` |
| `PUT /api/devices/registration` | `{ "open": true \| false }` | opens the registration window for 10 minutes (extends it if open) or closes it; no-op in secret mode |
| `POST /api/devices/claim` | `{ "pairingCode": "3382fp", "name": "Kitchen" }` | `{ device }`; assigns `builtin-morning-brief` ("Default"), else `builtin-clock`, if unassigned |
| `GET /api/devices/:id` | | `{ device }` |
| `PATCH /api/devices/:id` | `{ "name"?, "assignment"?: {"type":"none"} \| {"type":"screen","screenId"} \| {"type":"playlist","playlistId"} }` | `{ device }`; device navigates immediately |
| `DELETE /api/devices/:id` | | 204 |
| `POST /api/devices/:id/commands` | `{"type":"reload"}` \| `{"type":"refreshData"}` \| `{"type":"navigate","screenId"}` \| `{"type":"openExitMenu"\|"openSettings"\|"exitStrictMode"}` | `{ delivered: <open connections> }`; native kiosk commands return `{ delivered: 0, queued: true }` and reach the app with its next heartbeat (5-minute expiry) |
| `GET /api/devices/:id/logs` | `?limit=100&before=<id>` | `{ logs }` newest first |
| `GET /api/screens` | | `{ screens }` (without `html`, with `htmlBytes`) |
| `POST /api/screens` | `{ name, html, description?, dataRefreshSeconds?, source?: "user"\|"ai", generationPrompt? }` | 201 `{ screen }` |
| `GET /api/screens/:id` | | `{ screen }` |
| `PATCH /api/screens/:id` | any subset of the create fields | `{ screen }`; devices showing it reload; 403 `forbidden` for built-in screens (`source: "builtin"`, read-only; duplicate via `POST /api/screens` to get an editable copy) |
| `DELETE /api/screens/:id` | | 204, or 409 while assigned to a device or used in a playlist; 403 `forbidden` for built-in screens (`source: "builtin"`, read-only; duplicate via `POST /api/screens` to get an editable copy) |
| `GET /api/playlists` | | `{ playlists }` with `itemCount`, `totalSeconds` |
| `POST /api/playlists` | `{ name, items?: [{ screenId, dwellSeconds }] }` | 201 `{ playlist }` |
| `GET /api/playlists/:id` | | `{ playlist }` with ordered `items` |
| `PATCH /api/playlists/:id` | `{ name?, items? }` (`items` replaces the list) | `{ playlist }`; rotation re-syncs |
| `DELETE /api/playlists/:id` | | 204; devices using it become unassigned |
| `GET /api/settings` | | `{ effective, defaults, overrides, kioskExitPinSet, hideBuiltinScreens }` (weather location/units/name, timezone; exit PIN set; built-in screens hidden) |
| `PATCH /api/settings` | any of `weatherLatitude, weatherLongitude, weatherUnits, weatherLocationName, timezone`, `kioskExitPin` (4-8 digits; `null` clears), `hideBuiltinScreens` (boolean: hides built-in screens from the dashboard's Screens list and screen pickers) | same as GET; connected devices refresh data |
| `GET /api/settings/geocode` | `?q=paris` | `{ results: [{ label, latitude, longitude, timezone }] }` (Open-Meteo geocoding) |
| `GET /api/design/theme` | | `{ effective, defaults, overrides, availableFonts }`: `colors` (`bg, surface, border, text, textMuted, textFaint, accent, accentText`, each `#rrggbb`) and `fonts` (`display, body, mono`: family names) |
| `PATCH /api/design/theme` | `{ colors?: { <key>: "#rrggbb" or null }, fonts?: { <key>: family or null } }` (`null` clears one value; fonts must be bundled or downloaded) | same as GET; every device reloads |
| `DELETE /api/design/theme` | | same as GET, back to the defaults; every device reloads |
| `GET /api/design/fonts` | | `{ fonts: [{ family, files: [{ file, weight }], bytes, addedAt }] }` |
| `POST /api/design/fonts` | `{ family }` (Google Fonts family name: letters, digits, single spaces, ≤ 64 chars) | `201 { font }`; downloads the Latin subset from Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com` only, ≤ 1.5 MB per file, ≤ 5 MB per family); 404 unknown family, 409 already installed; every device reloads |
| `DELETE /api/design/fonts/:family` | | `204`; 409 while the theme uses it; every device reloads |
| `GET /api/design/instructions` | | `{ text, defaultText, customised, defaultChanged }`: the guide the AI follows (default `docs/screen-authoring.md`) |
| `PUT /api/design/instructions` | `{ text }` (1-200000 chars) | same as GET (text equal to the default clears the customisation) |
| `DELETE /api/design/instructions` | | same as GET, back to the default |
| `GET /api/preview/data` | | live `kiosk.data` for a placeholder device (editor preview) |
| `GET /api/ai/config` | | `{ configured, defaultModel, provider, models[] }` (never the key; models from the provider's `/models`) |
| `POST /api/ai/generate-screen` | `{ instruction, currentHtml?, model?, previewErrors? }` | `application/x-ndjson` stream of events (below); 503 `not_configured` without `AI_API_KEY` |

### AI generation stream

One JSON object per line, in order:

```jsonl
{"type":"status","message":"Asking google/gemini-3.8-flash…"}
{"type":"progress","phase":"reasoning","characters":812}
{"type":"progress","phase":"writing","characters":10240}
{"type":"status","message":"Fixing problems (attempt 2)…"}
{"type":"result","html":"<style>…","problems":[],"model":"google/gemini-3.8-flash","attempts":1,"usage":{"promptTokens":7520,"completionTokens":8895}}
```

The last line is `result` or `{"type":"error","message":"…"}`. The server sends `docs/screen-authoring.md` as the
system prompt, validates the returned fragment (`lib/ai/validate.ts`), and asks the model once to fix any rule
violations. `problems` lists anything still wrong. Nothing is saved; the editor saves with `source: "ai"` and
`generationPrompt`.

`DeviceView` fields: `id, name, claimed, claimedAt, pairingCode, model, androidVersion, appVersion,
screenWidth, screenHeight, assignment, currentScreenId, playlistPosition, online` (heartbeat within
90 s)`, connected` (device SSE open)`, lastSeenAt, lastIp, status, registeredAt, createdAt, updatedAt`.

## Playlist rotation

When a device's playlist item dwell expires, the server advances `playlistPosition`, sets
`currentScreenId`, and sends `navigate`. Position is stored on the device row, so a server restart
resumes rotation. A manual `navigate` command inside a playlist shows the chosen screen for one full
dwell, then rotation continues.

## curl quick reference

```sh
B=http://localhost:3000; A="Authorization: Bearer $ADMIN_PASSWORD"
curl -s $B/api/devices -H "$A"
curl -s -XPOST $B/api/devices/claim -H "$A" -d '{"pairingCode":"ABC234","name":"Kitchen"}'
curl -s -XPATCH $B/api/devices/<id> -H "$A" -d '{"assignment":{"type":"screen","screenId":"builtin-clock-weather"}}'
curl -s -XPOST $B/api/playlists -H "$A" -d '{"name":"Rotate","items":[{"screenId":"builtin-clock","dwellSeconds":30},{"screenId":"builtin-clock-weather","dwellSeconds":60}]}'
```
