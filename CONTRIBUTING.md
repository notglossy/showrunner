# Contributing

Solo-owner project, open to drive-by PRs. Small and boring wins.

## Workflow

- One branch + PR per change, **based on `main`** (no stacked PRs).
- Conventional Commits: `feat(server): …`, `fix(android): …`, `chore: …`, `docs: …`.
- Small, reviewable commits, one per meaningful step.

## Before pushing

```sh
pnpm check   # format + lint + typecheck + tests with coverage + build
```

Android, when touched:

```sh
cd apps/android && ./gradlew lintDebug assembleDebug testDebugUnitTest
```

## Rules

- Every API route validates input with Zod and returns typed JSON errors.
- Server style: Prettier + sorted imports (enforced by `pnpm check`); `/** ... */`
  on exported lib functions; `docs/screen-authoring.md` stays in sync with data fields.

### Android (Kotlin)

Google Android Kotlin style (https://developer.android.com/kotlin/style-guide); on
conflict with the Kotlin conventions it wins. Views codebase — no Compose.

- Imports: alphabetical, no blank lines between groups (matches the tree as-is).
- One primary type per file, PascalCase, file named after it; closely-related value
  classes may share it (see `DeviceIdentity.kt`, `KioskConfig.kt`). Pure logic lives
  in testable helpers (see `KioskLogic.kt`), not the activity.
- KDoc (`/** ... */`) on classes and on anything non-obvious; `[Symbol]` links;
  `@param`/`@return` only when they add beyond the signature. Comments explain why
  (lifecycle, threading, API-level/OEM workarounds with the level cited), never restate code.
- `// TODO(name): description` only. No commented-out code, no file headers.
- Leave untouched lines alone; no whole-file reformats as a side effect.
- Ask before adding dependencies beyond the stack in `AGENTS.md`.
- Never commit secrets, `.env`, keystores, or signing passwords.
- Device quirks and adb steps go in `docs/device-setup.md` as soon as they're known.
- Never require a factory reset to leave the kiosk.

## Releasing

Releases are GitHub releases with the signed kiosk APK attached, built by
`.github/workflows/release.yaml` from a tag.

1. Set `versionName` in `apps/android/app/build.gradle.kts` and merge it to `main`. Use a
   pre-release suffix (`0.2.0-beta.1`) for betas; a bare version (`0.2.0`) is a full release.
2. Tag that commit `v` + `versionName` and push the tag:
   ```sh
   git tag v0.2.0-beta.1 && git push origin v0.2.0-beta.1
   ```
   The workflow refuses a tag that doesn't match `versionName`, builds and verifies the APK,
   and publishes the release (a pre-release when the tag has a suffix) with generated notes.
3. Signing comes from the repository secrets listed in `docs/device-setup.md` (release
   builds). Without them the job fails before building.

## Reporting bugs

Include: server (`docker compose`) or Android build, device model if relevant,
steps to reproduce, and what you expected. See `SECURITY.md` for vulnerabilities.
