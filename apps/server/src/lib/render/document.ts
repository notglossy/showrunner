import type { KioskDataPayload } from '@/lib/providers/payload';

import { fontFaceCss } from './fonts';

/** Changes on every server start so WebViews pick up a new runtime without cache tricks. */
export const RUNTIME_VERSION = Date.now().toString(36);

export interface KioskBoot {
  deviceId: string;
  screenId: string | null;
  /**
   * device: the kiosk itself. admin: owner viewing /device/:id in a browser.
   * preview: dashboard editor iframe; no network (data arrives via postMessage).
   */
  viewer: 'device' | 'admin' | 'preview';
  refreshSeconds: number;
  serverTime: number;
  urls: { page: string; data: string; events: string; log: string };
  data: KioskDataPayload;
}

export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/** JSON that is safe to embed inside an inline <script>. */
export const jsonForScript = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

/** Builds the page, data, events, and log URLs a kiosk device talks to. */
export function deviceUrls(deviceId: string): KioskBoot['urls'] {
  const id = encodeURIComponent(deviceId);
  return {
    page: `/device/${id}`,
    data: `/api/devices/${id}/data`,
    events: `/api/devices/${id}/events`,
    log: `/api/devices/${id}/log`,
  };
}

const BASE_CSS = `
${fontFaceCss()}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000;color:#fff}
body{-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;-webkit-font-smoothing:antialiased}
html[data-viewer="device"] body{cursor:none}
`;

/** Wraps a template body fragment in the kiosk document shell with the runtime injected. */
export function renderKioskDocument({
  title,
  body,
  boot,
  designCss = '',
}: {
  title: string;
  body: string;
  boot: KioskBoot;
  /** Theme custom properties and downloaded-font rules (lib/design/css.ts), after the base CSS. */
  designCss?: string;
}): string {
  return `<!doctype html>
<html lang="en" data-viewer="${boot.viewer}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1280, user-scalable=no">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(title)} · ShowRunner</title>
<style>${BASE_CSS}${designCss}</style>
<script>window.__KIOSK_BOOT__=${jsonForScript(boot)};</script>
<script src="/kiosk/runtime.js?v=${RUNTIME_VERSION}"></script>
</head>
<body data-screen-id="${escapeHtml(boot.screenId ?? '')}">
${body}
</body>
</html>`;
}

/** Minimal page without the runtime, for requests that can't be served a screen. */
export function renderPlainPage(title: string, message: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=1280, user-scalable=no">
<meta name="color-scheme" content="dark"><title>${escapeHtml(title)} · ShowRunner</title>
<style>${BASE_CSS}body{display:grid;place-items:center;font:500 32px/1.4 system-ui,sans-serif;text-align:center}
h1{font-size:56px;margin:0 0 16px}p{color:#aaa;margin:0}</style></head>
<body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></main></body></html>`;
}
