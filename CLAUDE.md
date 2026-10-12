# ShowRunner

Self-hosted dashboard kiosk for a rooted Echo Show 8 (2nd gen) running LineageOS 18.1 / Android 11.
A thin Android WebView shell displays whatever a Next.js server on the LAN tells it to.
Single user (the owner). The repo will be open-sourced; never commit secrets.

See `docs/architecture.md` for the diagram and request/event flow.

## Layout

```
apps/server/    Next.js 16 App Router, TS strict, Tailwind 4, SQLite via Drizzle, Zod
apps/android/   Kotlin kiosk shell (AGP 9.4 built-in Kotlin, Gradle 9.7.1), app id com.notglossy.showrunner
docs/           architecture.md, api.md, device-setup.md, screen-authoring.md, glossary.md
scripts/        delegate.sh (OMP delegation), install.sh (Phase 2)
.claude/agents/ local-worker.md (delegation subagent)
```

## Architecture in brief

- The device is dumb. It registers (`POST /api/devices/register`: device token, optional shared secret header,
  or the dashboard's registration window), sends a heartbeat
  every 30s, and loads one URL: `GET /device/:deviceId`.
- A **screen** is a DB row holding an HTML/CSS/JS template. The server renders it and injects a runtime
  exposing `window.kiosk` (`kiosk.data`, `kiosk.on('data', fn)`, `data-bind="weather.temp"`).
- The runtime polls `GET /api/devices/:id/data`, listens to SSE at `GET /api/devices/:id/events`
  (`reload`, `navigate`, `refreshData`), and reports JS errors to `POST /api/devices/:id/log`.
- **Playlists** (ordered screens + dwell seconds) are rotated by the server sending `navigate`.
- **Providers** (`time`, `weather` via Open-Meteo, ...) live in a server `providers/` module: one class with
  `fetch()` + cache TTL, plus one registry entry.
- `docs/screen-authoring.md` is the binding contract for templates **and** the system prompt for AI screen
  generation. Keep it precise and complete when data fields change; `lib/ai/validate.ts` enforces its mechanical rules.
- **AI generation** uses any OpenAI-compatible API (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`; OpenRouter +
  `google/gemini-3.8-flash` by default). The editor can pick another model per browser. Output always lands in the
  editor for review; nothing is saved automatically.
- Target browser is **AOSP WebView 139** (Chromium 139). Anything Chromium 139 supports is fine.

## Server code map (`apps/server/src`)

```
app/(dashboard)/                 admin UI (server components load via services; client components mutate via /api)
                                 devices, devices/[id], screens (+ new, [id] editor), playlists (+ new, [id]), design, settings
components/                      dashboard client components: ui.tsx primitives, code-editor (CodeMirror 6),
                                 screen-preview (sandboxed 1280x800 iframe, runtime viewer "preview", postMessage data)
app/device/[deviceId]/route.ts   the page the WebView loads (pairing / unassigned / screen + runtime)
app/api/**/route.ts              thin handlers: auth check -> parseJson(schema) -> service -> JSON
lib/api/                         http.ts (ApiError, route(), parseJson), types.ts + schemas.ts (kept in sync
                                 by schemas.typecheck.ts), request.ts
lib/auth/                        admin.ts (session/Bearer), device.ts (secret, token), crypto.ts, session.ts (pages)
lib/db/                          schema.ts, client.ts (opens + migrates once); migrations in apps/server/drizzle
lib/devices|screens|playlists/   services (business logic); playlists/scheduler.ts rotates via navigate
lib/events/bus.ts                in-memory SSE pub/sub (single process)
lib/providers/                   DataProvider interface, cache, time/weather/device, registry.ts, payload.ts,
                                 sample.ts (browser-shaped sample kiosk.data for previews/tests)
lib/render/                      document shell + system screens
lib/ai/                          AI screen generation: client.ts (streams any OpenAI-compatible /chat/completions),
                                 prompt.ts (authoring doc or owner's override + theme/fonts appendix), validate.ts (template rules, also used by
                                 seed tests), extract.ts, generate.ts (call -> validate -> one repair turn)
lib/design/                      Design section: tokens.ts (theme tokens + defaults, client-safe), theme.ts, fonts.ts
                                 (Google Fonts download into FONTS_DIR, served at /kiosk/custom-fonts), instructions.ts
                                 (owner's AI guide override), css.ts (designCss() injected into every kiosk document)
lib/settings/                    dashboard settings (weather location/units, timezone) overriding env defaults; geocoding
lib/client/                      browser-side helpers (api() fetch wrapper with typed errors, formatting)
lib/seed/screens.ts              built-in screens (theme-aware), inserted on first boot, synced on every start
public/kiosk/runtime.js          window.kiosk runtime (plain JS); its contract is docs/screen-authoring.md
instrumentation.ts -> lib/startup.ts   env check, migrate, seed, start scheduler
```

## Android code map (`apps/android/app/src/main/java/com/notglossy/showrunner`)

```
MainActivity.kt           session state machine: SETUP / CONNECTING / SHOWING / RECONNECTING; WebView setup,
                          register -> cookie -> load /device/:id, heartbeat loop + watchdog, overlay, setup wizard
KioskConfig.kt            ConfigStore: /sdcard/showrunner/config.json or am start extras (most recent wins)
ServerClient.kt           HttpURLConnection + org.json client for register / heartbeat
KioskMode.kt              LAUNCHER (default Home app, default) / STRICT (opt-in device owner + lock task, leavable
                          in-app via clearDeviceOwnerApp) / IMMERSIVE; launchIntent() reuses the Home task
ExitPin.kt                cached salted PIN hash for the exit menu (hold top-left corner 3 s)
NativeBridge.kt           window.KioskNative (getDeviceInfo, get/setBrightness, reload): keep it small
DeviceStatus.kt           heartbeat body (battery, wifi); DeviceIdentity.kt: UUID + device info
BootReceiver.kt           BOOT_COMPLETED / MY_PACKAGE_REPLACED -> bring kiosk forward unless the user chose another Home
KioskDeviceAdminReceiver.kt   device admin component for dpm set-device-owner
KioskLogic.kt             pure decisions (retry backoff, heartbeat clamp, network recovery, boot start, screen id):
                          keep logic here, not in MainActivity, so it stays unit-testable
```

Device quirks and every adb step: `docs/device-setup.md`. Install with `scripts/install.sh` (prefer USB).
Inspect the running page via WebView DevTools (debug builds), see the troubleshooting table there.

Adding a data provider: new file in `lib/providers/`, add to `registry.ts`, document the fields in
`docs/screen-authoring.md` §6, and extend `sample.ts`.

## Running

### Server

```sh
pnpm install
pnpm dev                 # http://localhost:3000
pnpm check               # format + lint + typecheck + tests (coverage) + build
pnpm --filter @showrunner/server db:generate # after editing lib/db/schema.ts (commit the SQL)

cp .env.example .env     # set ADMIN_PASSWORD (DEVICE_SHARED_SECRET optional, see README)
docker compose up -d     # pulls ghcr.io/notglossy/showrunner:${SHOWRUNNER_VERSION:-latest}; health: /api/health
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d   # build from this checkout
```

Config is env vars only: `ADMIN_PASSWORD`, `DEVICE_SHARED_SECRET`, `WEATHER_LAT`, `WEATHER_LON`,
`WEATHER_UNITS` (imperial|metric), `KIOSK_TIMEZONE`, `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` (AI screen generation via
any OpenAI-compatible API, OpenRouter by default), `DATABASE_PATH`
(image default `/data/showrunner.db`), `FONTS_DIR` (downloaded fonts, default next to the database),
`SHOWRUNNER_VERSION` (compose only: image tag). The release workflow
builds `apps/server/Dockerfile` (repo root as context) for amd64 and arm64 and pushes `ghcr.io/notglossy/showrunner`
on every `v*` tag; the prod host (amd64, Komodo) pins one of those tags. Server-only fixes ship by tagging a new
version, which also bumps the app's versionName.

### Android

No system JDK; use Android Studio's bundled JBR. SDK at `~/Library/Android/sdk`.

```sh
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
cd apps/android && ./gradlew assembleDebug      # or assembleRelease (signing: ~/.gradle/gradle.properties, see device-setup.md)
./gradlew testDebugUnitTest                      # JVM unit tests (no device): app/src/test
```

Never commit keystores (`*.jks` is gitignored) or put signing passwords in the repo or `.env`.

Device: `adb connect <device-ip>:5555` (network adb persists across reboots). adb lives at
`~/Library/Android/sdk/platform-tools/adb` and isn't on PATH. Scripts honor `ANDROID_SERIAL`.

## Conventions

- Small, reviewable commits, one per meaningful step.
- Every API route validates input with Zod and returns typed JSON errors.
- Comments: `/** ... */` on every exported lib function (no `@param`/`@returns` types; signatures carry
  them), `//` for why-not-what (`force-dynamic`, `use client` workarounds, odd deps), `{/* */}` in JSX,
  `// TODO:`, `// FIXME:`, `// HACK:` uppercase with colon. Lint warns on missing JSDoc and tagged comments.
- Anything that must be done on the device (adb commands, permissions, settings) goes in
  `docs/device-setup.md` as soon as it's known.
- Prefer boring, well-known dependencies. Ask the owner before adding anything beyond the stack.
  Approved so far: next, react, tailwind, drizzle-orm, drizzle-kit, better-sqlite3, zod, vitest,
  codemirror (+ @codemirror/lang-html, state, view, commands), prettier (+ eslint-config-prettier,
  prettier-plugin-tailwindcss), eslint-plugin-jsdoc, androidx.core-ktx, androidx.webkit,
  and test-only junit + org.json (real JSON for JVM tests; android.jar's is a stub).
- No Google Play Services / Firebase on Android.
- Never require a factory reset to leave the kiosk: launcher mode is the default, strict (device owner) is opt-in and
  must stay leavable from the exit menu and dashboard.
- Unsure about a device quirk? Flag it and give an adb command to check. Don't guess.
- Work in phases (0 scaffold, 1 server core, 2 Android shell, 3 dashboard, 4 AI screens) and check in
  with the owner at the end of each. One branch + PR per phase, **always based on `main`** (no stacked PRs).
- `apps/server/AGENTS.md` is regenerated by `next dev`; read the Next.js docs it points to before writing
  Next code, since v16 differs from older versions.

## Delegation to a cheap model (OMP)

`scripts/delegate.sh <task-file> [model]` runs `omp -p` (thinking off, auto-approve, no session) with the task
file as the prompt. It refuses to run on a dirty tree and prints only the reply tail, changed files / diff stat,
and the tail of the acceptance check (the task file's `CHECK:` line, or an inferred typecheck/build). Exit codes:
0 ok, 1 omp failed, 2 usage, 3 dirty tree, 4 check failed. Default model: `openrouter/meta/muse-spark-1.3-contributor`
(always use the provider-qualified id: a bare `meta/...` resolves to the unconfigured `meta` provider; override with the 2nd arg or `DELEGATE_MODEL`).

Dispatch through the `local-worker` subagent (`.claude/agents/local-worker.md`). **The loop, every time:**

1. Commit so the tree is clean.
2. Give `local-worker` a concrete spec: exact files, the interface/example to match, and a verification command.
3. Read its report.
4. `git diff` (and read new files) yourself.
5. Run the real build/tests.
6. Good → commit. Bad → `git checkout -- . && git clean -fd <new paths>`.

Rules:
- Never merge unreviewed delegated output. Never delegate something you couldn't verify without reading the code.
- Good candidates: seed screen HTML/CSS from a description + the authoring doc, Zod schemas from a written TS
  interface, test boilerplate for an existing route, doc first drafts from an outline, Drizzle migrations from a
  specified schema, commit messages.
- Never delegate: architecture, the Android shell, auth, the device runtime/SSE layer, anything failing, anything
  ambiguous.
- If the delegated model produces garbage twice in a row on the same kind of task, stop delegating that kind of
  task and tell the owner.
