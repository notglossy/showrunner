# Glossary

Terms used across the ShowRunner server, Android shell, and docs.

## Binding

The `data-bind="path"` attribute (e.g. `data-bind="weather.temp"`) makes the runtime put a value from `kiosk.data` into an element's text.

## Claim

The admin action in the dashboard that names an unclaimed device and takes ownership of it after matching its pairing code.

## Command

A message the server pushes to a device over Server-Sent Events, one of `reload`, `navigate`, or `refreshData`. Native kiosk commands (open the exit menu, open settings, leave strict mode) travel in the heartbeat reply instead.

## Data payload

The JSON object exposed to screens as `window.kiosk.data`, covering time and timezone, weather, and device info, refreshed from `GET /api/devices/:id/data`.

## Device

One kiosk unit, identified by a UUID the Android app generates on first run.

## Device owner

Android device-policy status granted with `adb shell dpm set-device-owner`. ShowRunner uses it only for the optional strict kiosk mode. The app can give it up itself from the exit menu or dashboard, so no factory reset is ever needed.

## Device token

A per-device credential returned at registration and stored by the shell as a cookie so every WebView request is authenticated.

## Dwell

The number of seconds a screen stays up in a playlist before the server navigates to the next one.

## Exit menu

The native kiosk menu opened by holding the top-left corner of the display for 3 seconds (PIN optional) or from the dashboard. It offers Choose Home app, Open Android settings, Leave strict mode and Reload.

## Heartbeat

A `POST /api/devices/:id/heartbeat` the Android shell sends every 30 seconds with battery, Wi-Fi signal, and current screen, which drives last-seen status.

## Immersive mode

Full-screen with the system bars hidden. The app is always immersive; "immersive" as a kiosk mode means ShowRunner is neither the default Home app nor device owner.

## Kiosk runtime

The small script the server injects into every rendered screen, which provides `window.kiosk`, listens for commands, and reports errors to `POST /api/devices/:id/log`.

## Launcher mode

The default kiosk mode: ShowRunner is the default Home app, so Home, boot and updates return to it. The user can still swipe in the system bars and pick another Home app.

## Lock task mode

Android kiosk mode started with `startLockTask()` that suppresses the status bar, navigation bar, Home and Recents. Used by strict mode.

## Pairing code

The large 6-character code an unclaimed device shows on screen so it can be matched in the dashboard.

## Playlist

An ordered list of screens, each with a dwell time, assigned to a device, which the server rotates by sending `navigate` commands.

## Provider

A server module, for example `time` or `weather`, with a `fetch()` method and a cache TTL that supplies part of the data payload.

## Screen

A database row holding an HTML/CSS/JS template that a device can display.

## Shared secret

The optional `DEVICE_SHARED_SECRET` value the Android shell sends in a header when registering. When the server has none, new displays register only while the dashboard's **registration window** ("Add a display", 10 minutes, closes on claim) is open. Everything after registration uses the per-device token, and a claimed display can only re-register with it.

## Shell

The thin full-screen Android WebView app in `apps/android` that loads `GET /device/:id` and displays whatever the server renders.

## Strict mode

The optional kiosk mode using device owner and lock task, where nothing else can be opened. It can always be left from the exit menu or dashboard.

## Template

The HTML/CSS/JS source stored in a screen, which references live data through bindings and `kiosk.on('data', fn)`.

## Watchdog

Logic in the Android shell that retries with backoff when the WebView fails to load or no heartbeat acknowledgement has arrived for several minutes, and shows a full-screen "reconnecting" state that includes the server URL and device ID.
