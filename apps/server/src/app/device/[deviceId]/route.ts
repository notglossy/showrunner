import type { NextRequest } from 'next/server';

import { ApiError } from '@/lib/api/http';
import { designCss } from '@/lib/design/css';
import { requireDeviceOrAdmin, type Viewer } from '@/lib/auth/device';
import { currentScreenOf } from '@/lib/devices/service';
import { buildDataPayload } from '@/lib/providers/payload';
import { deviceUrls, renderKioskDocument, renderPlainPage } from '@/lib/render/document';
import { pairingScreen, unassignedScreen } from '@/lib/render/system-screens';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

const html = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });

/** The one URL the kiosk WebView loads. Renders the device's current screen with the runtime injected. */
export async function GET(req: NextRequest, { params }: RouteContext<'/device/[deviceId]'>) {
  const { deviceId } = await params;
  let viewer: Viewer;
  try {
    viewer = requireDeviceOrAdmin(req, deviceId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404)
      return html(renderPlainPage('Unknown device', deviceId), 404);
    if (err instanceof ApiError)
      return html(renderPlainPage('Not authorized', 'This display needs to register again.'), 401);
    throw err;
  }

  const { device } = viewer;
  const screen = device.claimedAt ? currentScreenOf(device) : null;
  const data = await buildDataPayload(device, screen);

  let title: string;
  let body: string;
  if (!device.claimedAt) {
    title = 'Pairing';
    body = pairingScreen(device.pairingCode ?? '------', device.id);
  } else if (!screen) {
    title = device.name ?? 'Unassigned';
    body = unassignedScreen(device.name, device.id);
  } else {
    title = screen.name;
    body = screen.html;
  }

  return html(
    renderKioskDocument({
      title,
      body,
      boot: {
        deviceId: device.id,
        screenId: screen?.id ?? null,
        viewer: viewer.kind,
        refreshSeconds: screen?.dataRefreshSeconds ?? 60,
        serverTime: Date.now(),
        urls: deviceUrls(device.id),
        data,
      },
      designCss: designCss(),
    }),
  );
}
