# Screen authoring guide

This document is the complete contract for writing a ShowRunner **screen template**. It is written
for whoever writes templates: a person in the dashboard editor, or a model generating a screen from
a plain-English description. If something isn't described here, don't rely on it.

## 1. What a screen is

A screen is one **HTML body fragment** stored in the database. The server wraps it in a full
document, injects the kiosk runtime, and serves it to a wall-mounted **Amazon Echo Show 8**. The
screen sits on a shelf or wall and is read from **across a room (2–4 m)**. Nobody touches it.

The fragment contains, in this order:

1. one `<style>` element,
2. the markup,
3. optionally one `<script>` element at the end.

```html
<style>
  /* all CSS for this screen */
</style>

<main class="screen">
  <!-- markup with data bindings -->
</main>

<script>
  // optional: behaviour that bindings can't express
</script>
```

### Output rules

- **Fragment only.** No `<!doctype>`, `<html>`, `<head>`, or `<body>` tags. No `<meta>`, `<title>`,
  or `<link>` tags.
- **Self-contained.** No external requests of any kind: no CDNs, external web fonts, remote images, iframes,
  or `fetch()` to other hosts. The display may have no internet access. Use inline SVG, CSS, emoji,
  or `data:` URIs for graphics.
- **No `<script src>`** and no ES module imports. Inline classic scripts only.
- **Read-only.** No forms, inputs, buttons, links, `alert`/`confirm`/`prompt`, or page navigation.
  Don't depend on `localStorage`.
- **All live data comes from `kiosk.data`** (section 5). Don't hard-code times, dates,
  temperatures, or device details.
- **Handle missing data.** Weather can be unavailable. Every value you show must have a sensible
  fallback (bindings show `—` automatically).

## 2. Canvas and environment

| Property | Value |
|---|---|
| Canvas | **1280 × 800 CSS pixels**, landscape, fixed. Design exactly for this size. |
| Scrolling | None. `html` and `body` are `overflow: hidden`; content outside the canvas is never seen. |
| Browser | **Chromium 139** (Android System WebView 139). |
| Device | Low-power ARM tablet, running 24/7. |
| Input | None (no pointer, keyboard, or touch interaction). |
| Theme | Dark. The page background is already `#000` and text `#fff`. |

### What the runtime already applies

The document shell includes this base CSS before your `<style>`:

```css
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; color: #fff; }
body { user-select: none; -webkit-tap-highlight-color: transparent; -webkit-font-smoothing: antialiased; }
```

It then declares the theme variables (see "Theme" below) and sets `html, body { background: var(--sr-bg); }`.

`100vw × 100vh` equals the 1280 × 800 canvas. Use `px` (or `vw`/`vh`) sizing. A root layout of
`position: fixed; inset: 0;` or `height: 100vh` is the most reliable.

### Supported CSS and JavaScript

Chromium 139 supports modern features. All of these are safe to use:

- CSS grid, flexbox, `gap`, `aspect-ratio`, `clamp()`/`min()`/`max()`, custom properties,
  native nesting, `:has()`, `:is()`/`:where()`, container queries, `inset`, logical properties,
  `color-mix()`, `oklch()`, `conic-gradient()`, `@layer`, `font-variant-numeric`,
  `text-wrap: balance`, CSS `@keyframes` and transitions, `@property`.
- ES2023+: optional chaining, `??`, `Array.prototype.at/findLast/toSorted`, `structuredClone`,
  `Intl.DateTimeFormat`/`Intl.NumberFormat`/`Intl.RelativeTimeFormat` with IANA timezones,
  `requestAnimationFrame`, `ResizeObserver`, `IntersectionObserver`, inline `<svg>`, `<canvas>` 2D.

### Performance on a small always-on device

- Animate only `transform` and `opacity`. Avoid animating layout properties, `filter: blur()`,
  `backdrop-filter`, and large `box-shadow`s.
- No infinite animations faster than about one cycle per 2 seconds. Keep motion subtle. It's on
  all day.
- Don't create timers faster than 1 per second. Use `kiosk.on('tick', …)` for per-second updates.
- Keep DOM small (a few hundred elements at most).

### Fonts

Use only the fonts below, plus any extra fonts listed at the end of this guide (downloaded by the owner).
Nothing else is available and web fonts can't be loaded from the internet.
Always end a `font-family` list with a generic family.

**Served by ShowRunner** (already declared with `@font-face` on every screen; just name them). Files are
only downloaded when used, so pick one or two per screen.

| `font-family` | Weights | Character |
|---|---|---|
| `"Inter"` | 100–900 (variable) | Neutral UI sans; excellent numerals |
| `"Outfit"` | 100–900 (variable) | Clean geometric sans; friendly large type |
| `"Space Grotesk"` | 300–700 (variable) | Techy geometric display |
| `"Nunito"` | 200–1000 (variable) | Rounded, soft and casual |
| `"Oswald"` | 200–700 (variable) | Condensed; fits big numbers in narrow space |
| `"Bebas Neue"` | 400 only | Tall condensed all-caps display (lowercase renders as caps) |
| `"Playfair Display"` | 400–900 (variable) | High-contrast serif display |
| `"JetBrains Mono"` | 100–800 (variable) | Monospace; dashboards and code-like readouts |

These fonts cover Latin text (English and Western European languages, common punctuation and
symbols such as `°`, `·`, `—`). Emoji and other scripts fall back to the device fonts.

Example: `font-family: "Outfit", system-ui, sans-serif;`

**Installed on the device:**

| `font-family` | Renders as | Notes |
|---|---|---|
| `system-ui`, `sans-serif`, `Roboto` | Roboto | Default. Weights 100–900. |
| `serif` | Noto Serif | Regular and bold. |
| `monospace` | Droid Sans Mono | Single weight. |
| `"Noto Color Emoji"` | Color emoji | Used automatically for emoji characters. |

Use `font-variant-numeric: tabular-nums;` on anything that ticks (clocks, countdowns) so digits
don't shift. Oswald, Inter, Outfit, and JetBrains Mono support it; Bebas Neue digits are already
nearly uniform width. Playfair Display uses old-style (descending) figures by default; add
`font-variant-numeric: lining-nums tabular-nums;` for clocks and temperatures.

### Theme

The owner picks a theme in the dashboard. It's declared on `:root` of every screen as CSS custom
properties. Prefer them to hardcoded colors and fonts so the screen follows the theme, and always give
the default as the fallback so the screen still renders on its own:
`color: var(--sr-text-muted, #c9ced8);`,
`font-family: var(--sr-font-display, "Space Grotesk", system-ui, sans-serif);`.

| Variable | Default | Use |
|---|---|---|
| `--sr-bg` | `#000000` | Page background |
| `--sr-surface` | `#1b1b1b` | Panels, tracks, raised areas |
| `--sr-border` | `#2a2a2a` | Dividers and outlines |
| `--sr-text` | `#f2f2f2` | Main text |
| `--sr-text-muted` | `#c9ced8` | Secondary text |
| `--sr-text-faint` | `#8b8b8b` | Labels and low-priority readouts |
| `--sr-accent` | `#6136f5` | Accent fills (bars, panels); too dark for text on the background |
| `--sr-accent-text` | `#a995ff` | Accent on the background: text, icons, hands |
| `--sr-font-display` | `"Space Grotesk", system-ui, sans-serif` | Big numbers and headings |
| `--sr-font-body` | `"Space Grotesk", system-ui, sans-serif` | Everything else |
| `--sr-font-mono` | `"JetBrains Mono", monospace` | Dates, labels, code-like readouts |

The current values on this installation are listed at the end of this guide; use those as the fallbacks.
Colors with a specific meaning (warm for heat, blue for rain) can stay literal.

## 3. Designing for across the room

- **Type sizes on the 1280 × 800 canvas:** the primary figure (the clock, the current temperature)
  is **160–320 px**; secondary values are **56–96 px**; labels and supporting text are **28–40 px**.
  Nothing smaller than **24 px**.
- **Contrast:** primary text near white (`#fff` / `#f2f2f2`) on black or very dark backgrounds.
  Secondary text no dimmer than about `#9aa3b2`. Avoid thin weights (< 300) below 120 px.
- **Hierarchy:** one dominant element, at most two or three secondary groups. Generous margins
  (at least 48 px from the canvas edges). Keep large areas of true black. It looks best on this
  panel and reduces glare at night.
- **Color:** use color sparingly and meaningfully (for example a warm accent for heat, blue for
  rain). Don't put important information in color alone.
- **Burn-in and fatigue:** avoid large static pure-white blocks.

## 4. Data bindings (no JavaScript needed)

The runtime fills elements from `kiosk.data` **every second** and after every data refresh.

### `data-bind="path"`: set text

```html
<span data-bind="time.hhmm"></span>
<span data-bind="weather.current.temperature"></span><span data-bind="weather.units.temperature"></span>
<span data-bind="weather.daily.1.weekdayShort"></span>
```

- `path` is a dot-separated path into `kiosk.data`. Array elements use numeric segments
  (`weather.daily.0.high`).
- The element's text content is replaced with the value converted to a string.
- If the value is missing, `null`, an empty string, or an object/array, the element shows its
  `data-fallback` attribute, or `—` if there is none. It also gets a `data-bind-missing` attribute
  you can style:
  ```css
  [data-bind-missing] { opacity: 0.4; }
  ```
- Bound elements shouldn't contain child markup (it is replaced). Wrap units or labels in sibling
  elements.

### `data-bind-attr="attr:path; attr2:path2"`: set attributes

```html
<div class="weather" data-bind-attr="data-icon:weather.current.icon; data-day:weather.current.isDay"></div>
```

- Sets each attribute to the value as a string. Booleans become `"true"`/`"false"`.
- Removes the attribute when the value is missing, `null`, or an object.
- Combine with CSS attribute selectors to switch visuals without JavaScript:
  ```css
  .weather[data-icon="rain"] .rain-art { display: block; }
  .weather[data-day="false"] { --accent: #8fb8ff; }
  ```

Elements added later by your own script are picked up on the next tick (≤ 1 s). Call
`kiosk.applyBindings()` to apply them immediately.

## 5. JavaScript API: `window.kiosk`

The runtime loads before your template, so `kiosk` exists when your script runs.

| Member | Description |
|---|---|
| `kiosk.data` | The current data object (section 6). Replaced on each refresh; don't cache nested references across refreshes. |
| `kiosk.on(event, fn)` | Subscribe. Returns an unsubscribe function. Events are listed below. |
| `kiosk.off(event, fn)` | Unsubscribe. |
| `kiosk.get(path, fallback?)` | Read a dot path from `kiosk.data`; returns `fallback` if missing/null. |
| `kiosk.applyBindings(root?)` | Re-apply `data-bind`/`data-bind-attr` now (defaults to the whole document). |
| `kiosk.refresh()` | Refetch data now. Returns a promise. Rarely needed. |
| `kiosk.log(level, message)` | Report `"error"`, `"warn"`, or `"info"` to the dashboard's device log. |
| `kiosk.deviceId` / `kiosk.screenId` | Identifiers (strings; `screenId` may be `null`). |
| `kiosk.connected` | `true` while the live command connection to the server is open. |
| `kiosk.native` | Device bridge on the Echo, or `null` in a desktop browser/preview. Always guard: `kiosk.native?.setBrightness(0.3)`. Methods: `getBrightness()` → 0–1, `setBrightness(value)` (0–1; negative returns to the system setting), `getDeviceInfo()` → JSON string (`deviceId, model, androidVersion, appVersion, screenWidth, screenHeight, kioskMode` (`"launcher"`, `"strict"` or `"immersive"`), `isDefaultHome, serverUrl, webViewVersion`), `reload()`. Use sparingly, e.g. dimming at night. |

### Events

| Event | Payload | When |
|---|---|---|
| `data` | `kiosk.data` | Once when the page is ready, then after every successful refresh (every `dataRefreshSeconds`, default 60 s). |
| `tick` | `kiosk.data.time` | Once when the page is ready, then every second on the second, after the time fields update. |
| `connection` | `{ connected: boolean }` | When the live connection to the server opens or drops. |
| `command` | `{ type, … }` | When the server sends a command (the runtime handles it; informational). |

Lifecycle guarantees:

- Handlers registered while the page is loading first run **after the whole fragment has been
  parsed**, so your script can query any element in the template.
- Handlers registered later are called once immediately (next microtask) with the current value
  (`data` and `tick` only).
- An exception thrown in a handler is caught and reported to the device log. Other handlers still
  run.
- Uncaught errors and unhandled promise rejections anywhere on the page are reported too.

Use JavaScript only when bindings can't express it: building repeated elements such as a forecast
row, formatting, conditional layout, SVG geometry (an analog clock or a progress arc), or choosing
colors from values.

## 6. Data reference: `kiosk.data`

All fields are always present with the types shown unless marked nullable. Example values are
realistic, for Los Angeles in imperial units.

```jsonc
{
  "generatedAt": "2026-09-13T21:30:38.241Z",   // ISO time the server built this payload
  "screen": { "id": "builtin-clock", "name": "Clock" },   // nullable: null on system screens
  "time":    { /* 6.1 */ },
  "weather": { /* 6.2 */ },
  "device":  { /* 6.3 */ }
}
```

### 6.1 `time`

Updated every second on the device, corrected to the server's clock, in the configured
timezone. All formatted values are **strings**.

| Path | Type | Example | Notes |
|---|---|---|---|
| `time.epochMs` | number | `1789335038241` | Milliseconds since epoch (server-corrected). |
| `time.iso` | string | `"2026-09-13T21:30:38.241Z"` | UTC ISO 8601. |
| `time.timezone` | string | `"America/Los_Angeles"` | IANA timezone all fields below are in. |
| `time.utcOffsetMinutes` | number | `-420` | Offset at the last data refresh. |
| `time.hhmm` | string | `"2:30"` | 12-hour, no leading zero, no AM/PM. |
| `time.hhmm24` | string | `"14:30"` | 24-hour, zero-padded. |
| `time.hour12` | string | `"2"` | 1–12, no padding. |
| `time.hour24` | string | `"14"` | `"00"`–`"23"`. |
| `time.minute` | string | `"30"` | `"00"`–`"59"`. |
| `time.second` | string | `"38"` | `"00"`–`"59"`. |
| `time.ampm` | string | `"PM"` | `"AM"` or `"PM"`. |
| `time.weekday` | string | `"Sunday"` | |
| `time.weekdayShort` | string | `"Sun"` | |
| `time.month` | string | `"September"` | |
| `time.monthShort` | string | `"Sep"` | |
| `time.day` | string | `"13"` | Day of month, no padding. |
| `time.year` | string | `"2026"` | |
| `time.date` | string | `"Sunday, September 13"` | |
| `time.dateShort` | string | `"Sun, Sep 13"` | |
| `time.isoDate` | string | `"2026-09-13"` | Local calendar date. |
| `time.greeting` | string | `"Good afternoon"` | `"Good morning"` 05–11, `"Good afternoon"` 12–16, `"Good evening"` 17–20, `"Good night"` otherwise. |

### 6.2 `weather`

From Open-Meteo, refreshed on the server every 10 minutes. Numbers are rounded integers unless
noted. Units follow the server setting (imperial shown).

| Path | Type | Example | Notes |
|---|---|---|---|
| `weather.available` | boolean | `true` | `false` if weather has never loaded; then `current` and `today` are `null` and `daily`/`hourly` are empty (`units` and `location` are still present). |
| `weather.error` | string \| null | `null` | Error message when unavailable. |
| `weather.fetchedAt` | string \| null | `"2026-09-13T21:30:00.000Z"` | When the data was fetched. |
| `weather.location.name` | string \| null | `"Los Angeles, California"` | Place label from dashboard settings; may be `null`. |
| `weather.location.latitude` / `.longitude` | number | `34.0522` / `-118.2437` | Forecast coordinates. |
| `weather.units.temperature` | string | `"°F"` | `"°F"` or `"°C"`. Includes the degree sign. |
| `weather.units.windSpeed` | string | `"mph"` | `"mph"` or `"km/h"`. |
| `weather.units.precipitation` | string | `"in"` | `"in"` or `"mm"`. |
| **`weather.current`** | object \| null | | Conditions now. |
| `weather.current.temperature` | number | `83` | |
| `weather.current.feelsLike` | number | `87` | Apparent temperature. |
| `weather.current.humidity` | number | `59` | Percent, 0–100. |
| `weather.current.windSpeed` | number | `10` | |
| `weather.current.windDirection` | number | `257` | Degrees, 0 = from north. |
| `weather.current.windDirectionCardinal` | string | `"W"` | One of `N NE E SE S SW W NW`. |
| `weather.current.precipitation` | number | `0` | Current precipitation amount (not rounded). |
| `weather.current.isDay` | boolean | `true` | |
| `weather.current.weatherCode` | number | `0` | WMO code. |
| `weather.current.condition` | string | `"Clear"` | Short human label (table below). |
| `weather.current.icon` | string | `"clear"` | Icon key (table below). |
| `weather.current.emoji` | string | `"☀️"` | Day/night-appropriate emoji. |
| **`weather.today`** | object \| null | | Today's forecast. |
| `weather.today.high` / `.low` | number | `85` / `68` | |
| `weather.today.precipitationChance` | number \| null | `0` | Max chance today, percent. |
| `weather.today.uvIndexMax` | number \| null | `7` | |
| `weather.today.sunrise` / `.sunset` | string | `"6:34 AM"` / `"7:05 PM"` | Local, 12-hour. |
| `weather.today.sunriseIso` / `.sunsetIso` | string | `"2026-09-13T13:34:54.000Z"` | UTC ISO. |
| `weather.today.date`, `.weekday`, `.weekdayShort`, `.weatherCode`, `.condition`, `.icon`, `.emoji` | | | Same as a `daily` entry. |
| **`weather.daily`** | array (7) | | Index `0` is today. |
| `weather.daily[i].date` | string | `"2026-09-14"` | Local date. |
| `weather.daily[i].weekday` / `.weekdayShort` | string | `"Monday"` / `"Mon"` | |
| `weather.daily[i].high` / `.low` | number | `86` / `65` | |
| `weather.daily[i].precipitationChance` | number \| null | `10` | Percent. |
| `weather.daily[i].weatherCode`, `.condition`, `.icon`, `.emoji` | | | Daytime variant. |
| **`weather.hourly`** | array (12) | | Starts at the current hour. |
| `weather.hourly[i].iso` | string | `"2026-09-13T21:00:00.000Z"` | Start of the hour, UTC. |
| `weather.hourly[i].hour` | string | `"2 PM"` | Local label. |
| `weather.hourly[i].temperature` | number | `83` | |
| `weather.hourly[i].precipitationChance` | number \| null | `0` | Percent. |
| `weather.hourly[i].isDay` | boolean | `true` | |
| `weather.hourly[i].weatherCode`, `.condition`, `.icon`, `.emoji` | | | Day/night-appropriate emoji. |

**Icon keys** (`icon`) and the `condition` labels that map to them:

| `icon` | `condition` values |
|---|---|
| `clear` | Clear |
| `partly-cloudy` | Mostly clear, Partly cloudy |
| `cloudy` | Overcast |
| `fog` | Fog, Freezing fog |
| `drizzle` | Light drizzle, Drizzle, Heavy drizzle |
| `rain` | Light rain, Rain, Heavy rain |
| `showers` | Light showers, Showers, Heavy showers |
| `sleet` | Freezing drizzle, Freezing rain |
| `snow` | Light snow, Snow, Heavy snow, Snow grains, Snow showers, Heavy snow showers |
| `thunderstorm` | Thunderstorm, Thunderstorm with hail |
| `unknown` | Unknown |

### 6.3 `device`

| Path | Type | Example | Notes |
|---|---|---|---|
| `device.id` | string | `"3f2b7c1e-…"` | |
| `device.name` | string \| null | `"Kitchen"` | Name given when claimed. |
| `device.claimed` | boolean | `true` | |
| `device.model` | string | `"Echo_Show_8"` | |
| `device.appVersion` | string | `"0.1.0"` | |
| `device.screenWidth` / `.screenHeight` | number | `1280` / `800` | Physical pixels (the canvas is always 1280 × 800 CSS px). |
| `device.battery` | object \| null | `{ "level": 100, "charging": true }` | `level` 0–100. Often `null`; the Echo Show has no battery. |
| `device.wifi` | object \| null | `{ "rssi": -52, "ssid": "home", "bars": 4 }` | `bars` 0–4. `ssid` may be `null`. |
| `device.lastSeenAt` | string \| null | `"2026-09-13T21:30:37.087Z"` | Last heartbeat. |

## 7. Examples

### 7.1 Minimal clock (bindings only)

```html
<style>
  .clock { position: fixed; inset: 0; display: grid; place-content: center; text-align: center;
           font-family: system-ui, sans-serif; }
  .clock__time { font-size: 300px; font-weight: 300; line-height: 1; letter-spacing: -0.02em;
                 font-variant-numeric: tabular-nums; }
  .clock__ampm { font-size: 72px; font-weight: 400; color: #9aa3b2; margin-left: 16px; }
  .clock__date { margin-top: 32px; font-size: 56px; color: #c9ced8; }
</style>

<main class="clock">
  <div><span class="clock__time" data-bind="time.hhmm"></span><span class="clock__ampm" data-bind="time.ampm"></span></div>
  <div class="clock__date" data-bind="time.date"></div>
</main>
```

### 7.2 Current weather with icon switching (bindings + CSS)

```html
<style>
  .wx { position: fixed; inset: 48px; display: grid; grid-template-columns: auto 1fr; align-items: center;
        gap: 48px; font-family: system-ui, sans-serif; }
  .wx__emoji { font-size: 220px; line-height: 1; }
  .wx__temp { font-size: 240px; font-weight: 200; line-height: 1; font-variant-numeric: tabular-nums; }
  .wx__cond { font-size: 64px; color: #c9ced8; }
  .wx__meta { margin-top: 16px; font-size: 36px; color: #9aa3b2; }
  .wx[data-icon="rain"] .wx__cond, .wx[data-icon="showers"] .wx__cond { color: #7fb4ff; }
  .wx[data-icon="thunderstorm"] .wx__cond { color: #ffd166; }
</style>

<main class="wx" data-bind-attr="data-icon:weather.current.icon">
  <div class="wx__emoji" data-bind="weather.current.emoji" data-fallback="…"></div>
  <div>
    <div class="wx__temp"><span data-bind="weather.current.temperature"></span><span data-bind="weather.units.temperature"></span></div>
    <div class="wx__cond" data-bind="weather.current.condition" data-fallback="Weather unavailable"></div>
    <div class="wx__meta">
      H <span data-bind="weather.today.high"></span>° · L <span data-bind="weather.today.low"></span>°
      · Feels like <span data-bind="weather.current.feelsLike"></span>°
    </div>
  </div>
</main>
```

### 7.3 Forecast row built with JavaScript

```html
<style>
  .days { position: fixed; left: 48px; right: 48px; bottom: 48px; display: grid;
          grid-template-columns: repeat(5, 1fr); gap: 24px; font-family: system-ui, sans-serif; }
  .day { text-align: center; padding: 24px 0; border-radius: 24px; background: #11151c; }
  .day__name { font-size: 32px; color: #9aa3b2; }
  .day__emoji { font-size: 72px; margin: 8px 0; }
  .day__temps { font-size: 40px; font-variant-numeric: tabular-nums; }
  .day__low { color: #9aa3b2; margin-left: 12px; }
  .days__empty { grid-column: 1 / -1; text-align: center; font-size: 36px; color: #9aa3b2; }
</style>

<section class="days" id="days"></section>

<script>
  const days = document.getElementById("days");

  kiosk.on("data", (data) => {
    const forecast = data.weather.daily.slice(1, 6);
    if (!forecast.length) {
      days.innerHTML = '<div class="days__empty">Forecast unavailable</div>';
      return;
    }
    days.replaceChildren(
      ...forecast.map((d) => {
        const el = document.createElement("div");
        el.className = "day";
        el.innerHTML = `
          <div class="day__name"></div>
          <div class="day__emoji"></div>
          <div class="day__temps"><span class="day__high"></span>°<span class="day__low"></span></div>`;
        el.querySelector(".day__name").textContent = d.weekdayShort;
        el.querySelector(".day__emoji").textContent = d.emoji;
        el.querySelector(".day__high").textContent = d.high;
        el.querySelector(".day__low").textContent = `${d.low}°`;
        return el;
      }),
    );
  });
</script>
```

Set text with `textContent`, never by interpolating data into `innerHTML`.

### 7.4 Per-second behaviour with `tick`

```html
<div class="seconds-bar"><div class="seconds-bar__fill" id="fill"></div></div>
<script>
  const fill = document.getElementById("fill");
  kiosk.on("tick", (t) => {
    fill.style.transform = `scaleX(${Number(t.second) / 59})`;
  });
</script>
```

## 8. Checklist

Before a screen is done, confirm:

- [ ] Output is a single fragment: `<style>`, markup, optional trailing `<script>`. No document tags.
- [ ] No external URLs, fonts, images, scripts, or network calls. Fonts come only from section 2.
- [ ] Colors and fonts use the theme variables (section 2, "Theme") with the default as the fallback.
- [ ] Laid out for exactly 1280 × 800 with ≥ 48 px margins; nothing overflows.
- [ ] Primary element ≥ 160 px; nothing smaller than 24 px; high contrast on a dark background.
- [ ] Every data path used exists in section 6, spelled exactly.
- [ ] Looks intentional when `weather.available` is `false` (fallbacks, not blank gaps).
- [ ] Ticking numbers use `font-variant-numeric: tabular-nums`.
- [ ] Animations are subtle and use only `transform`/`opacity`.
- [ ] Scripts use `kiosk.on('data' | 'tick', …)`, not their own fast timers or `fetch`.
