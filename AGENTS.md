# ShowRunner

Self-hosted dashboard kiosk for a rooted Echo Show 8 (2nd gen) running LineageOS 18.1 / Android 11.
A thin Android WebView shell displays whatever a Next.js server on the LAN tells it to.
Single owner, open source (MIT). Never commit secrets.

This file is the shared brief for every coding agent (Claude Code reads it through `CLAUDE.md`). Human-facing rules
live in `CONTRIBUTING.md`; this file repeats what an agent needs and adds the traps.
`docs/architecture.md` has the diagram and request/event flow.

## Commands

```sh
pnpm install
pnpm dev                 # http://localhost:3000 (needs .env: cp .env.example .env, set ADMIN_PASSWORD)
pnpm check               # prettier + eslint + knip + typegen + tsc + vitest (coverage) + next build
pnpm --filter @showrunner/server db:generate   # after editing lib/db/schema.ts; commit the SQL
pnpm --filter @showrunner/server examples      # regenerate examples/ after changing seed screens
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d   # image from this checkout; /api/health
```

Android (no system JDK: use Android Studio's bundled JBR; SDK at `~/Library/Android/sdk`):

```sh
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
cd apps/android && ./gradlew lintDebug assembleDebug testDebugUnitTest
```

`pnpm check` must pass before every push that touches the server; CI runs the same. Run the Android line when
`apps/android` changes.

## Layout

```
apps/server/    Next.js 16 App Router, TS strict, Tailwind 4, SQLite via Drizzle, Zod
apps/android/   Kotlin kiosk shell (AGP 9.4 built-in Kotlin, Gradle 9.7.1), app id com.notglossy.showrunner
docs/           architecture.md, api.md, device-setup.md, screen-authoring.md, glossary.md
examples/       copies of the seed screen templates (a test keeps them in sync)
scripts/        install.sh (build + install the APK)
```

## Architecture in brief

- The device is dumb. It registers (`POST /api/devices/register`: device token, optional shared secret header, or
  the dashboard's registration window), sends a heartbeat every 30s, and loads one URL: `GET /device/:deviceId`.
- A **screen** is a DB row holding an HTML/CSS/JS template. The server renders it and injects a runtime exposing
  `window.kiosk` (`kiosk.data`, `kiosk.on('data', fn)`, `data-bind="weather.temp"`).
- The runtime polls `GET /api/devices/:id/data`, listens to SSE at `GET /api/devices/:id/events`
  (`reload`, `navigate`, `refreshData`), and reports JS errors to `POST /api/devices/:id/log`.
- **Playlists** (ordered screens + dwell seconds) are rotated by the server sending `navigate`.
- **Providers** (`time`, `weather` via Open-Meteo, ...) live in `lib/providers/`: one class with `fetch()` + cache
  TTL, plus one registry entry.
- `docs/screen-authoring.md` is the binding contract for templates **and** the system prompt for AI screen
  generation. Keep it precise and complete when data fields change; `lib/ai/validate.ts` enforces its rules.
- **AI generation** uses any OpenAI-compatible API (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`; OpenRouter by default).
  Output always lands in the editor for review; nothing is saved automatically.
- Target browser is **AOSP WebView 139** (Chromium 139). Anything Chromium 139 supports is fine.

### Server (`apps/server/src`)

```
app/(dashboard)/                 admin UI: server components load via services, client components mutate via /api
app/device/[deviceId]/route.ts   the page the WebView loads (pairing / unassigned / screen + runtime)
app/api/**/route.ts              thin handlers: auth check -> parseJson(schema) -> service -> JSON
components/                      dashboard client components (ui.tsx primitives, code editor, screen preview)
lib/api/                         http.ts (ApiError, route(), parseJson), types.ts + schemas.ts (kept in sync by
                                 schemas.typecheck.ts)
lib/auth/                        admin.ts (session/Bearer), device.ts (secret, token), session.ts (pages)
lib/db/                          schema.ts, client.ts (opens + migrates once); migrations in apps/server/drizzle
lib/devices|screens|playlists/   services (business logic); playlists/scheduler.ts rotates via navigate
lib/events/bus.ts                in-memory SSE pub/sub (single process)
lib/providers/                   DataProvider interface, cache, registry.ts, payload.ts, sample.ts (preview data)
lib/render/                      document shell + system screens
lib/ai/                          client.ts, prompt.ts, validate.ts, extract.ts, generate.ts
lib/design/                      theme tokens, Google Fonts download, AI-instructions override, designCss()
lib/settings/                    dashboard settings overriding env defaults; geocoding
lib/seed/screens.ts              built-in screens, inserted on first boot and synced on every start
public/kiosk/runtime.js          window.kiosk runtime (plain JS); its contract is docs/screen-authoring.md
instrumentation.ts -> lib/startup.ts   env check, migrate, seed, start scheduler
```

Adding a data provider: new file in `lib/providers/`, add it to `registry.ts`, document the fields in
`docs/screen-authoring.md` §6, and extend `sample.ts`.

### Android (`apps/android/app/src/main/java/com/notglossy/showrunner`)

`MainActivity.kt` holds the session state machine (SETUP / CONNECTING / SHOWING / RECONNECTING) and WebView setup.
Pure decisions (retry backoff, heartbeat clamp, network recovery, boot start) belong in `KioskLogic.kt` so they stay
unit-testable; keep `NativeBridge.kt` (`window.KioskNative`) small. Kiosk modes are in `KioskMode.kt`: LAUNCHER
(default Home app, the default), STRICT (opt-in device owner + lock task), IMMERSIVE. Kotlin style rules are in
`CONTRIBUTING.md`.

## Conventions

- Every API route validates input with Zod and returns typed JSON errors.
- Every dashboard page calls `requireAdminPage(<its own path>)` itself. A layout check alone is not enough: layouts
  don't re-run on client navigation and don't gate their child segments.
- Comments: `/** ... */` on every exported lib function (no `@param`/`@returns` types; signatures carry them), `//`
  for why-not-what, `{/* */}` in JSX, `// TODO:` / `// FIXME:` / `// HACK:` uppercase with a colon. Lint warns on
  missing JSDoc. Don't restate the code.
- Match the surrounding code; leave untouched lines alone, no whole-file reformats.
- Next.js 16 differs from older versions. Read the guide in `apps/server/node_modules/next/dist/docs/` before
  writing Next code (see `apps/server/AGENTS.md`).
- Prefer boring, well-known dependencies. **Ask the owner before adding any dependency.** Approved so far: next,
  react, tailwind, drizzle-orm, drizzle-kit, better-sqlite3, zod, vitest, codemirror (+ @codemirror/lang-html,
  state, view, commands), prettier (+ eslint-config-prettier, prettier-plugin-tailwindcss), eslint-plugin-jsdoc,
  androidx.core-ktx, androidx.webkit, and test-only junit + org.json.
- No Google Play Services / Firebase on Android.
- Never require a factory reset to leave the kiosk: launcher mode is the default; strict (device owner) is opt-in
  and must stay leavable from the exit menu and the dashboard.
- Anything that must be done on the device (adb commands, permissions, settings) goes in `docs/device-setup.md` as
  soon as it's known. Unsure about a device quirk? Say so and give an adb command to check. Don't guess.

## Tests

- Server tests are Vitest, next to the code (`*.test.ts`). Add or update a test with every behaviour change; a bug
  fix starts with a failing test when practical.
- Android JVM tests live in `apps/android/app/src/test` and run without a device.
- Never weaken or delete a test to make it pass. If a test is wrong, say why in the commit.

## Git and pull requests

- Branch from `main` for each change, and base the PR on `main`. No stacked PRs: GitHub merges a stacked PR into
  its feature-branch base, not `main`.
- Conventional Commits with a scope: `feat(server): …`, `fix(android): …`, `docs: …`, `chore: …`. Small commits,
  one per meaningful step; the body says why.
- Stage files by path. Don't `git add -A` or `git add .` (it picks up `.env`, worktrees and scratch files).
- Fill in `.github/pull_request_template.md`, including how the change was verified.
- Don't push, open, merge or tag anything unless the owner asked for it. The owner often batches tweaks on one
  branch before opening the PR.
- Releases: bump `versionName` in `apps/android/app/build.gradle.kts`, merge, then tag `v<versionName>` on `main`
  (see `CONTRIBUTING.md`). The tag builds the APK and the `ghcr.io/notglossy/showrunner` image.

## Secrets and safety

- Config is env vars only (see `README.md` and `.env.example`). Never commit `.env`, keystores (`*.jks`), signing
  passwords or API keys, and never print their values.
- Don't change auth (`lib/auth/`, device tokens, the shared secret) without saying so in the PR description.

## Generated files: don't hand-edit

- `apps/server/AGENTS.md`: rewritten by `next dev`. Commit its change rather than reverting it.
- `apps/server/drizzle/*`: generated by `db:generate` from `lib/db/schema.ts`.
- `.github/workflows/pr-review.lock.yml`: compiled by `gh aw` from `pr-review.md`, which comes from
  `notglossy/agentic-workflows`. Review notes for the AI reviewer go in `.github/ai-review-instructions.md`.
- `examples/`: regenerated from the seed screens by the `examples` script.

## Traps

- Don't run Prettier on `docs/*.md`: it reflows tables, and tests match exact rows in `docs/screen-authoring.md`.
- Runtime file paths built from env in lib code need `/*turbopackIgnore: true*/`, or `next build` traces the whole
  project.
- Google Fonts css2 is case-sensitive on family names and returns 400 for a weight range the font lacks;
  `lib/design/fonts.ts` probes weights for that reason.
- adb lives at `~/Library/Android/sdk/platform-tools/adb` (not on PATH); scripts honor `ANDROID_SERIAL`. Prefer USB
  for installs: a stalled install over Wi-Fi clogs the Echo's uplink.
