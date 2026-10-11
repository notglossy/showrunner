export interface BuiltinScreen {
  id: string;
  name: string;
  description: string;
  html: string;
  dataRefreshSeconds: number;
}

export const BUILTIN_SCREENS: BuiltinScreen[] = [
  {
    id: 'builtin-clock',
    name: 'Clock',
    description: 'Large clock with the date, a greeting and a bar that fills each minute.',
    dataRefreshSeconds: 300,
    html: `<style>
  /* Colors follow the Design theme; the fallbacks are the defaults. Change them here to restyle the screen. */
  :root {
    --ck-accent: var(--sr-accent, #6136f5); /* seconds bar */
    --ck-accent-text: var(--sr-accent-text, #a995ff); /* date; a lighter tint so it stays readable on black */
  }
  .ck-root { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--sr-bg, #000); color: var(--sr-text, #f2f2f2); font-family: var(--sr-font-body, "Space Grotesk", system-ui, sans-serif); font-weight: 500; text-align: center; }
  .ck-mono { font-family: var(--sr-font-mono, "JetBrains Mono", monospace); font-weight: 400; text-transform: uppercase; letter-spacing: -0.01em; }
  .ck-date { font-size: 30px; color: var(--ck-accent-text); }
  .ck-row { display: flex; align-items: flex-start; margin: 20px 0 12px; }
  .ck-time { font-family: var(--sr-font-display, "Space Grotesk", system-ui, sans-serif); font-size: 300px; line-height: 0.9; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
  .ck-ampm { font-size: 48px; color: var(--sr-text-faint, #8b8b8b); margin: 24px 0 0 20px; }
  .ck-greeting { font-size: 40px; color: var(--sr-text-muted, #c9ced8); }
  .ck-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 8px; background: var(--sr-surface, #1b1b1b); }
  .ck-fill { height: 100%; background: var(--ck-accent); transform: scaleX(0); transform-origin: left; transition: transform 1s linear; }
</style>
<main class="ck-root">
  <div class="ck-date ck-mono" data-bind="time.date"></div>
  <div class="ck-row"><span class="ck-time" data-bind="time.hhmm"></span><span class="ck-ampm ck-mono" data-bind="time.ampm"></span></div>
  <div class="ck-greeting" data-bind="time.greeting"></div>
  <div class="ck-bar"><div class="ck-fill" id="ck-fill"></div></div>
</main>
<script>
  var fill = document.getElementById("ck-fill");
  kiosk.on("tick", function (t) {
    var s = Number(t.second);
    // Snap back at :00 instead of animating the bar backwards.
    fill.style.transition = s === 0 ? "none" : "";
    fill.style.transform = "scaleX(" + s / 59 + ")";
  });
</script>`,
  },
  {
    id: 'builtin-clock-weather',
    name: 'Clock & Weather',
    description: 'Clock and current conditions side by side, with a 5-day forecast in line icons.',
    dataRefreshSeconds: 60,
    html: `<style>
  /* Colors follow the Design theme; the fallbacks are the defaults. Change them here to restyle the screen. */
  :root {
    --cw-accent: var(--sr-accent-text, #a995ff); /* weather icons and the date */
  }
  .cw-root { position: fixed; inset: 0; padding: 56px 64px 48px; background: var(--sr-bg, #000); color: var(--sr-text, #f2f2f2); font-family: var(--sr-font-body, "Space Grotesk", system-ui, sans-serif); font-weight: 500; display: flex; flex-direction: column; }
  .cw-mono { font-family: var(--sr-font-mono, "JetBrains Mono", monospace); font-weight: 400; text-transform: uppercase; letter-spacing: -0.01em; }
  /* Two columns sharing rows, so the time and the temperature sit on one line. */
  .cw-top { display: grid; grid-template-columns: auto auto; justify-content: space-between; column-gap: 48px; row-gap: 16px; }
  .cw-right { text-align: right; justify-self: end; }
  .cw-date { font-size: 26px; color: var(--cw-accent); align-self: end; }
  .cw-place { font-size: 22px; color: var(--sr-text-faint, #8b8b8b); align-self: end; max-width: 460px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cw-big { display: flex; align-items: flex-start; }
  .cw-time, .cw-temp { font-family: var(--sr-font-display, "Space Grotesk", system-ui, sans-serif); font-size: 170px; line-height: 0.88; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
  .cw-ampm, .cw-unit { font-size: 40px; color: var(--sr-text-faint, #8b8b8b); margin: 12px 0 0 12px; }
  .cw-greeting { font-size: 32px; color: var(--sr-text-muted, #c9ced8); }
  .cw-now { display: flex; align-items: center; justify-content: flex-end; gap: 14px; font-size: 32px; }
  .cw-nowicon { width: 40px; height: 40px; color: var(--cw-accent); display: block; }
  .cw-hilo { font-size: 22px; margin-top: 8px; color: var(--sr-text-faint, #8b8b8b); font-variant-numeric: tabular-nums; }
  .cw-band { margin-top: auto; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border-top: 1px solid var(--sr-border, #2a2a2a); }
  .cw-day { padding: 24px 20px 0; border-left: 1px solid var(--sr-border, #2a2a2a); min-width: 0; }
  .cw-day:first-child { border-left: 0; padding-left: 0; }
  .cw-name { font-size: 24px; color: var(--sr-text-faint, #8b8b8b); }
  .cw-icon { display: block; width: 72px; height: 72px; margin: 18px 0 16px; color: var(--cw-accent); }
  .cw-temps { font-size: 34px; font-variant-numeric: tabular-nums; }
  .cw-low { color: var(--sr-text-faint, #8b8b8b); margin-left: 12px; }
  .cw-rain { font-size: 18px; color: var(--sr-text-faint, #8b8b8b); margin-top: 6px; min-height: 24px; }
  .cw-empty { grid-column: 1 / -1; font-size: 28px; color: var(--sr-text-faint, #8b8b8b); padding: 32px 0; }
</style>
<main class="cw-root">
  <div class="cw-top">
    <div class="cw-date cw-mono" data-bind="time.date"></div>
    <div class="cw-place cw-mono cw-right" data-bind="weather.location.name" data-fallback=""></div>
    <div class="cw-big"><span class="cw-time" data-bind="time.hhmm"></span><span class="cw-ampm cw-mono" data-bind="time.ampm"></span></div>
    <div class="cw-big cw-right"><span class="cw-temp" data-bind="weather.current.temperature" data-fallback="--"></span><span class="cw-unit" data-bind="weather.units.temperature"></span></div>
    <div class="cw-greeting" data-bind="time.greeting"></div>
    <div class="cw-right">
      <div class="cw-now"><span id="cw-nowicon"></span><span data-bind="weather.current.condition" data-fallback="Weather unavailable"></span></div>
      <div class="cw-hilo cw-mono">H <span data-bind="weather.today.high" data-fallback="--"></span>° · L <span data-bind="weather.today.low" data-fallback="--"></span>°</div>
    </div>
  </div>
  <section class="cw-band" id="cw-days"></section>
</main>
<script>
  // Line icons per weather icon key, drawn in currentColor on a 24x24 grid.
  var SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  var CLOUD = '<path d="M7 18h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 18z"/>';
  var CLOUD_HI = '<path d="M7 15h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 15z"/>';
  var ICONS = {
    "clear": SUN,
    "partly-cloudy": '<path d="M8 3v1.5M3.5 8H5M4.8 4.8l1 1M11.2 4.8l-1 1"/><path d="M5.6 10.2A3 3 0 1 1 10.7 7"/><path d="M9 20h8a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.5 1.4A2.8 2.8 0 0 0 9 20z"/>',
    "cloudy": CLOUD,
    "fog": '<path d="M4 9h16M3 13h18M5 17h14"/>',
    "drizzle": CLOUD_HI + '<path d="M9 18v1M13 18v1M17 18v1"/>',
    "rain": CLOUD_HI + '<path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3"/>',
    "showers": CLOUD_HI + '<path d="M9 18l-1 3M13 18l-1 3"/>',
    "sleet": CLOUD_HI + '<path d="M9 18l-1 3M15 19h.01M12 21h.01"/>',
    "snow": CLOUD_HI + '<path d="M9 19h.01M13 19h.01M17 19h.01M11 21.5h.01M15 21.5h.01"/>',
    "thunderstorm": CLOUD_HI + '<path d="M13 15l-2 3.5h3L12 22"/>',
    "unknown": CLOUD
  };
  function icon(key, cls) {
    // Markup comes only from the constant table above, never from data.
    var wrap = document.createElement("span");
    wrap.innerHTML = '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[key] || ICONS.unknown) + '</svg>';
    return wrap.firstChild;
  }
  function el(tag, cls, text) { var n = document.createElement(tag); n.className = cls; if (text != null) n.textContent = text; return n; }
  var band = document.getElementById("cw-days"), nowSlot = document.getElementById("cw-nowicon");
  kiosk.on("data", function (data) {
    var w = (data && data.weather) || {};
    while (nowSlot.firstChild) nowSlot.removeChild(nowSlot.firstChild);
    if (w.current) nowSlot.appendChild(icon(w.current.icon, "cw-nowicon"));
    while (band.firstChild) band.removeChild(band.firstChild);
    var days = (w.daily || []).slice(1, 6);
    if (days.length < 5) { band.appendChild(el("div", "cw-empty cw-mono", "Forecast unavailable")); return; }
    days.forEach(function (d) {
      var col = el("div", "cw-day");
      col.appendChild(el("div", "cw-name cw-mono", d.weekdayShort));
      col.appendChild(icon(d.icon, "cw-icon"));
      var temps = el("div", "cw-temps", d.high + "°");
      temps.appendChild(el("span", "cw-low", d.low + "°"));
      col.appendChild(temps);
      col.appendChild(el("div", "cw-rain cw-mono", d.precipitationChance >= 20 ? d.precipitationChance + "% rain" : ""));
      band.appendChild(col);
    });
  });
</script>`,
  },
  {
    id: 'builtin-dial',
    name: 'Dial',
    description:
      'Analog dial with a sweeping second hand, current conditions, a sunrise-to-sunset arc and the next 12 hours of temperature.',
    dataRefreshSeconds: 60,
    html: `<style>
  /* Colors follow the Design theme; the fallbacks are the defaults. Change them here to restyle the screen. */
  :root {
    --dl-accent: var(--sr-accent-text, #a995ff); /* second hand, centre cap, sun */
    --dl-accent-dim: #3b3166; /* sun before sunrise and after sunset */
  }

  @property --fg {
    syntax: "<color>";
    inherits: true;
    initial-value: #f2f0ea;
  }
  @property --bg {
    syntax: "<color>";
    inherits: true;
    initial-value: #000000;
  }

  .screen {
    position: fixed;
    inset: 0;
    --fg: #f2f0ea;
    --bg: var(--sr-bg, #000000);
    background-color: var(--bg);
    color: var(--fg);
    transition: --fg 2s linear, --bg 2s linear, background-color 2s linear, color 2s linear;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 64px;
    padding: 0 80px;
    font-family: var(--sr-font-body, "Space Grotesk", system-ui, sans-serif);
    font-weight: 500;
  }
  .mono {
    font-family: var(--sr-font-mono, "JetBrains Mono", monospace);
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: -0.01em;
  }
  .screen[data-day="false"] {
    --fg: #e8e6df;
    --bg: var(--sr-bg, #000000);
  }

  [data-bind-missing] { opacity: 0.5; }

  /* ---------- clock ---------- */
  .clockcol {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .dial { display: block; width: 620px; height: 620px; }

  .tick-min { stroke: var(--sr-border, #2a2a2a); stroke-width: 2; }
  .tick-hour { stroke: var(--fg); stroke-width: 5; }

  .hand {
    stroke: var(--fg);
    stroke-linecap: butt;
    transform-box: view-box;
    transform-origin: 310px 310px;
  }
  .hand--sec {
    stroke: var(--dl-accent);
    transition: transform 1s linear;
  }
  .cap { fill: var(--dl-accent); }

  .readout {
    margin-top: 18px;
    font-size: 26px;
    line-height: 1.2;
    letter-spacing: 0.3em;
    text-indent: 0.3em;
    color: var(--sr-text-faint, #8b8b8b);
    font-variant-numeric: tabular-nums lining-nums;
  }

  /* ---------- weather column ---------- */
  .wx {
    flex: 0 0 400px;
    width: 400px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    padding-left: 64px;
    border-left: 1px solid var(--sr-border, #2a2a2a);
  }
  .screen[data-weather="off"] .wx { display: none; }

  .temp {
    font-family: var(--sr-font-display, "Space Grotesk", system-ui, sans-serif);
    display: flex;
    align-items: flex-start;
    font-size: 180px;
    line-height: 0.82;
    letter-spacing: -0.04em;
    white-space: nowrap;
    color: var(--fg);
    font-variant-numeric: tabular-nums lining-nums;
  }
  .temp__unit {
    font-size: 40px;
    line-height: 1.1;
    letter-spacing: 0;
    margin: 10px 0 0 8px;
    color: var(--sr-text-faint, #8b8b8b);
  }

  .cond {
    margin-top: 16px;
    font-size: 34px;
    line-height: 1.1;
    color: var(--sr-text-muted, #c9ced8);
  }

  .sun { display: block; margin-top: 28px; }
  .sun__arc { fill: none; stroke: var(--sr-border, #2a2a2a); stroke-width: 2; stroke-dasharray: 2 6; }
  .sun__dot { fill: var(--dl-accent); }
  .sun__dot.is-down { fill: var(--dl-accent-dim); }
  .sun__labels {
    width: 376px;
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 20px;
    line-height: 1.2;
    color: var(--sr-text-faint, #8b8b8b);
    font-variant-numeric: tabular-nums lining-nums;
  }

  .spark { display: block; margin-top: 26px; }
  .spark__line {
    fill: none;
    stroke: var(--fg);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .spark__labels {
    width: 360px;
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    font-size: 18px;
    line-height: 1.25;
    color: var(--sr-text-faint, #8b8b8b);
  }

  .hl {
    margin-top: 22px;
    font-size: 22px;
    line-height: 1.25;
    color: var(--sr-text-faint, #8b8b8b);
    font-variant-numeric: tabular-nums lining-nums;
  }
  .hl .sep { padding: 0 20px; }
</style>

<main class="screen" id="screen" data-bind-attr="data-day:weather.current.isDay">
  <section class="clockcol">
    <svg class="dial" width="620" height="620" viewBox="0 0 620 620" aria-hidden="true">
      <g id="ticks"></g>
      <line class="hand" id="handHour" x1="310" y1="310" x2="310" y2="160" stroke-width="14"></line>
      <line class="hand" id="handMin" x1="310" y1="310" x2="310" y2="80" stroke-width="8"></line>
      <g class="hand hand--sec" id="handSec">
        <line x1="310" y1="310" x2="310" y2="50" stroke-width="2"></line>
        <line x1="310" y1="310" x2="310" y2="350" stroke-width="2"></line>
      </g>
      <circle class="cap" cx="310" cy="310" r="5"></circle>
    </svg>
    <div class="readout mono" data-bind="time.hhmm24"></div>
  </section>

  <aside class="wx">
    <div class="temp">
      <span data-bind="weather.current.temperature"></span>
      <span class="temp__unit" data-bind="weather.units.temperature"></span>
    </div>
    <div class="cond" data-bind="weather.current.condition" data-fallback="Weather unavailable"></div>

    <svg class="sun" width="376" height="196" viewBox="-8 -8 376 196" aria-hidden="true">
      <path class="sun__arc" d="M 0 180 A 180 180 0 0 1 360 180"></path>
      <circle class="sun__dot" id="sunDot" cx="0" cy="180" r="7"></circle>
    </svg>
    <div class="sun__labels mono">
      <span data-bind="weather.today.sunrise"></span>
      <span data-bind="weather.today.sunset"></span>
    </div>

    <svg class="spark" width="360" height="90" viewBox="0 0 360 90" aria-hidden="true">
      <path class="spark__line" id="sparkLine" d=""></path>
    </svg>
    <div class="spark__labels mono">
      <span id="sparkStart"></span>
      <span id="sparkEnd"></span>
    </div>

    <div class="hl mono">
      H <span data-bind="weather.today.high"></span>°<span class="sep"></span>L
      <span data-bind="weather.today.low"></span>°
    </div>
  </aside>
</main>

<script>
  (function () {
    const screenEl = document.getElementById("screen");
    const handHour = document.getElementById("handHour");
    const handMin = document.getElementById("handMin");
    const handSec = document.getElementById("handSec");
    const sunDot = document.getElementById("sunDot");
    const sparkLine = document.getElementById("sparkLine");
    const sparkStart = document.getElementById("sparkStart");
    const sparkEnd = document.getElementById("sparkEnd");
    const ticks = document.getElementById("ticks");

    const CX = 310;
    const CY = 310;

    /* dial ticks (markup built from numbers only) */
    let tickMarkup = "";
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0;
      const a = (i * 6 * Math.PI) / 180;
      const rOut = 302;
      const rIn = major ? 276 : 292;
      const x1 = (CX + Math.sin(a) * rIn).toFixed(2);
      const y1 = (CY - Math.cos(a) * rIn).toFixed(2);
      const x2 = (CX + Math.sin(a) * rOut).toFixed(2);
      const y2 = (CY - Math.cos(a) * rOut).toFixed(2);
      tickMarkup +=
        '<line class="' + (major ? "tick-hour" : "tick-min") + '" x1="' + x1 +
        '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"></line>';
    }
    ticks.innerHTML = tickMarkup;

    /* second hand: cumulative angle so the sweep never runs backwards; it
       re-syncs to t.second on every tick so a late or skipped tick does not drift */
    let secondDeg = null;

    /* sun arc geometry (top half of a circle, centre + radius) */
    const SUN_CX = 180;
    const SUN_CY = 180;
    const SUN_R = 180;

    function updateSun(nowMs) {
      const start = Date.parse(kiosk.get("weather.today.sunriseIso"));
      const end = Date.parse(kiosk.get("weather.today.sunsetIso"));
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        !Number.isFinite(nowMs) ||
        !(end > start)
      ) {
        sunDot.style.opacity = "0";
        return;
      }
      sunDot.style.opacity = "1";
      const raw = (nowMs - start) / (end - start);
      const f = Math.min(1, Math.max(0, raw));
      const angle = Math.PI * (1 - f);
      const x = SUN_CX + SUN_R * Math.cos(angle);
      const y = SUN_CY - SUN_R * Math.sin(angle);
      sunDot.setAttribute("cx", x.toFixed(1));
      sunDot.setAttribute("cy", y.toFixed(1));
      sunDot.classList.toggle("is-down", raw < 0 || raw > 1);
    }

    /* hourly temperature curve */
    function drawSpark(hours) {
      const pts = (hours || []).filter(function (h) {
        return h && typeof h.temperature === "number";
      });
      if (pts.length < 2) {
        sparkLine.setAttribute("d", "");
        sparkStart.textContent = "";
        sparkEnd.textContent = "";
        return;
      }
      const temps = pts.map(function (p) { return p.temperature; });
      const min = Math.min.apply(null, temps);
      const max = Math.max.apply(null, temps);
      const flat = max === min;
      const stepX = 358 / (pts.length - 1);
      let d = "";
      temps.forEach(function (v, i) {
        const x = 1 + i * stepX;
        const y = flat ? 45 : 81 - ((v - min) / (max - min)) * 72;
        d += (i ? " L " : "M ") + x.toFixed(1) + " " + y.toFixed(1);
      });
      sparkLine.setAttribute("d", d);
      sparkStart.textContent = pts[0].hour || "";
      sparkEnd.textContent = pts[pts.length - 1].hour || "";
    }

    kiosk.on("tick", function (t) {
      const seconds = Number(t.second) || 0;
      const minutes = Number(t.minute) || 0;
      const hours = (Number(t.hour24) || 0) % 12;

      const hourDeg = hours * 30 + minutes * 0.5;
      const minuteDeg = minutes * 6 + seconds * 0.1;

      handHour.style.transform = "rotate(" + hourDeg.toFixed(3) + "deg)";
      handMin.style.transform = "rotate(" + minuteDeg.toFixed(3) + "deg)";

      const target = seconds * 6;
      if (secondDeg === null) {
        secondDeg = target;
        handSec.style.transition = "none";
        handSec.style.transform = "rotate(" + secondDeg + "deg)";
        handSec.getBoundingClientRect();
        handSec.style.transition = "";
      } else {
        let delta = target - (secondDeg % 360);
        if (delta < 0) delta += 360;
        if (delta > 0) {
          secondDeg += delta;
          handSec.style.transform = "rotate(" + secondDeg + "deg)";
        }
      }

      updateSun(Number(t.epochMs));
    });

    kiosk.on("data", function (data) {
      const w = data && data.weather;
      const ok = !!(w && w.available && w.current);
      screenEl.setAttribute("data-weather", ok ? "on" : "off");

      updateSun(Number(kiosk.get("time.epochMs")));
      drawSpark(w ? w.hourly : []);
    });
  })();
</script>`,
  },
  {
    id: 'builtin-morning-brief',
    // The screen new displays get on claim (DEFAULT_SCREEN_ID). The id predates the rename; existing rows keep it.
    name: 'Default',
    description:
      'Big clock and greeting on black, today’s weather and a 3-day outlook on a violet block. Assigned to new displays.',
    dataRefreshSeconds: 60,
    html: `<style>
  /* Weather panel color follows the Design theme; the fallback is the default. Change it here to restyle the screen. */
  :root { --mb-accent: var(--sr-accent, #6136f5); }
  .mb-root { position: fixed; inset: 0; display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); background: var(--sr-bg, #000); color: var(--sr-text, #f2f2f2); font-family: var(--sr-font-body, "Space Grotesk", system-ui, sans-serif); font-weight: 500; }
  .mb-mono { font-family: var(--sr-font-mono, "JetBrains Mono", monospace); font-weight: 400; text-transform: uppercase; letter-spacing: -0.01em; }
  .mb-clock { padding: 64px; display: flex; flex-direction: column; justify-content: space-between; }
  .mb-date { font-size: 30px; color: #9aa3b2; }
  .mb-timerow { display: flex; align-items: flex-start; }
  .mb-time { font-family: var(--sr-font-display, "Space Grotesk", system-ui, sans-serif); font-size: 216px; line-height: 0.9; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  .mb-ampm { font-size: 44px; color: #9aa3b2; margin: 18px 0 0 16px; }
  .mb-greeting { font-size: 44px; color: var(--sr-text-muted, #c9ced8); }
  .mb-weather { background: var(--mb-accent); color: #fff; padding: 56px; display: flex; flex-direction: column; justify-content: space-between; }
  .mb-place { font-size: 26px; color: #e6e0ff; }
  .mb-tempwrap { display: flex; align-items: flex-start; }
  .mb-temp { font-family: var(--sr-font-display, "Space Grotesk", system-ui, sans-serif); font-size: 160px; line-height: 0.9; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  .mb-unit { font-size: 48px; margin: 12px 0 0 8px; }
  .mb-cond { font-size: 40px; margin-top: 16px; }
  .mb-hilo { font-size: 28px; margin-top: 12px; color: #e6e0ff; font-variant-numeric: tabular-nums; }
  .mb-days { display: flex; flex-direction: column; }
  .mb-day { display: flex; justify-content: space-between; gap: 16px; padding: 14px 0; border-top: 1px solid rgba(255, 255, 255, 0.4); font-size: 26px; font-variant-numeric: tabular-nums; }
  .mb-dayname { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mb-temps { white-space: nowrap; }
  .mb-low { color: #e6e0ff; margin-left: 16px; }
</style>
<main class="mb-root">
  <section class="mb-clock">
    <div class="mb-date mb-mono" data-bind="time.date"></div>
    <div class="mb-timerow"><span class="mb-time" data-bind="time.hhmm"></span><span class="mb-ampm mb-mono" data-bind="time.ampm"></span></div>
    <div class="mb-greeting" data-bind="time.greeting"></div>
  </section>
  <section class="mb-weather">
    <div class="mb-place mb-mono" data-bind="weather.location.name" data-fallback="Weather"></div>
    <div>
      <div class="mb-tempwrap"><span class="mb-temp" data-bind="weather.current.temperature" data-fallback="--"></span><span class="mb-unit" data-bind="weather.units.temperature"></span></div>
      <div class="mb-cond" data-bind="weather.current.condition" data-fallback="Weather unavailable"></div>
      <div class="mb-hilo mb-mono">H <span data-bind="weather.today.high" data-fallback="--"></span>° · L <span data-bind="weather.today.low" data-fallback="--"></span>°</div>
    </div>
    <div class="mb-days mb-mono" id="mb-days"></div>
  </section>
</main>
<script>
  var days = document.getElementById("mb-days");
  kiosk.on("data", function (data) {
    while (days.firstChild) { days.removeChild(days.firstChild); }
    var daily = (data && data.weather && data.weather.daily) || [];
    var next = daily.slice(1, 4);
    for (var i = 0; i < next.length; i++) {
      var d = next[i];
      var row = document.createElement("div");
      row.className = "mb-day";
      var name = document.createElement("span");
      name.className = "mb-dayname";
      name.textContent = d.weekdayShort + " · " + d.condition;
      var temps = document.createElement("span");
      temps.className = "mb-temps";
      temps.textContent = d.high + "°";
      var low = document.createElement("span");
      low.className = "mb-low";
      low.textContent = d.low + "°";
      temps.appendChild(low);
      row.appendChild(name);
      row.appendChild(temps);
      days.appendChild(row);
    }
  });
</script>`,
  },
];
