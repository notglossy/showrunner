import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AssignmentSelect } from '@/components/assignment-select';
import { AutoRefresh } from '@/components/auto-refresh';
import { ClaimDevice } from '@/components/claim-device';
import { DeleteDevice, DeviceCommands, RenameDevice } from '@/components/device-actions';
import { DeviceLogs } from '@/components/device-logs';
import { DeviceStatus } from '@/components/device-status';
import { TimeAgo } from '@/components/time-ago';
import { Card, PageHeader } from '@/components/ui';
import { requireAdminPage } from '@/lib/auth/session';
import { duration } from '@/lib/client/format';
import { findDevice, toDeviceView } from '@/lib/devices/service';
import { getPlaylistOr404, listPlaylists } from '@/lib/playlists/service';
import { wifiBars } from '@/lib/providers/device';
import { listScreens } from '@/lib/screens/service';
import { visibleScreens } from '@/lib/screens/visible';
import { getHideBuiltinScreens } from '@/lib/settings/service';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-subtle">{label}</dt>
      <dd className="text-ink text-right">{children}</dd>
    </div>
  );
}

export default async function DevicePage({ params }: PageProps<'/devices/[id]'>) {
  const { id } = await params;
  await requireAdminPage(`/devices/${id}`);
  const row = findDevice(id);
  if (!row) notFound();
  const device = toDeviceView(row);
  const allScreens = listScreens().map(({ id, name, source }) => ({ id, name, source }));
  const hide = getHideBuiltinScreens();
  const playlists = listPlaylists().map(({ id, name }) => ({ id, name }));
  const screenNames = Object.fromEntries(allScreens.map((s) => [s.id, s.name]));
  const playlist =
    device.assignment.type === 'playlist' ? getPlaylistOr404(device.assignment.playlistId) : null;
  const { battery, wifi, uptimeSeconds, kioskMode, isDefaultHome } = device.status;

  return (
    <>
      <AutoRefresh seconds={10} />
      <PageHeader title={device.name ?? `Unclaimed display ${device.pairingCode ?? ''}`}>
        <Link
          href={`/device/${device.id}`}
          target="_blank"
          className="text-subtle text-sm underline underline-offset-2"
        >
          Open live page ↗
        </Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-1">
          <Card title="Status">
            <dl className="divide-graphite/30 divide-y">
              <Row label="State">
                <DeviceStatus device={device} />
              </Row>
              <Row label="Last heartbeat">
                <TimeAgo iso={device.lastSeenAt} />
              </Row>
              <Row label="Showing">
                {device.currentScreenId
                  ? (screenNames[device.currentScreenId] ?? device.currentScreenId)
                  : '—'}
              </Row>
              {playlist && (
                <Row label="Playlist">
                  {playlist.name} (
                  {playlist.items.length
                    ? `${device.playlistPosition + 1}/${playlist.items.length}`
                    : 'empty'}
                  )
                </Row>
              )}
              <Row label="Wi-Fi">
                {wifi
                  ? `${wifi.ssid ?? 'connected'} · ${wifi.rssi} dBm · ${'▮'.repeat(wifiBars(wifi.rssi))}${'▯'.repeat(4 - wifiBars(wifi.rssi))}`
                  : '—'}
              </Row>
              <Row label="Battery">
                {battery ? `${battery.level}%${battery.charging ? ' (charging)' : ''}` : '—'}
              </Row>
              <Row label="Kiosk mode">
                {kioskMode
                  ? {
                      launcher: 'Launcher (default Home app)',
                      strict: 'Strict (device owner lock)',
                      immersive: 'Full-screen only',
                    }[kioskMode]
                  : '—'}
              </Row>
              <Row label="Default Home app">
                {isDefaultHome === null || isDefaultHome === undefined
                  ? '—'
                  : isDefaultHome
                    ? 'ShowRunner'
                    : 'Another app'}
              </Row>
              <Row label="App uptime">
                {typeof uptimeSeconds === 'number' ? duration(uptimeSeconds) : '—'}
              </Row>
              <Row label="IP">{device.lastIp ?? '—'}</Row>
              <Row label="Model">{device.model}</Row>
              <Row label="Android / app">
                {device.androidVersion} / {device.appVersion}
              </Row>
              <Row label="Screen">
                {device.screenWidth}×{device.screenHeight}
              </Row>
              <Row label="Registered">
                <TimeAgo iso={device.registeredAt} />
              </Row>
              <Row label="Device ID">
                <span className="font-mono text-xs">{device.id}</span>
              </Row>
            </dl>
          </Card>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          {device.claimed ? (
            <>
              <Card title="Assignment">
                <AssignmentSelect
                  deviceId={device.id}
                  assignment={device.assignment}
                  screens={visibleScreens(
                    allScreens,
                    hide,
                    device.assignment.type === 'screen' ? [device.assignment.screenId] : [],
                  )}
                  playlists={playlists}
                />
              </Card>
              <Card title="Commands">
                <DeviceCommands
                  deviceId={device.id}
                  screens={visibleScreens(allScreens, hide)}
                  claimed={device.claimed}
                  strict={kioskMode === 'strict'}
                />
              </Card>
              <Card title="Name">
                <RenameDevice deviceId={device.id} name={device.name} />
              </Card>
            </>
          ) : (
            <Card title="Claim this display">
              <p className="text-subtle mb-3 text-sm">
                Pairing code <span className="font-mono font-semibold">{device.pairingCode}</span>
              </p>
              <ClaimDevice pairingCode={device.pairingCode ?? ''} />
            </Card>
          )}
          <Card title="Log">
            <DeviceLogs deviceId={device.id} screenNames={screenNames} />
          </Card>
          <div className="flex justify-end">
            <DeleteDevice
              deviceId={device.id}
              name={device.name ?? device.id}
              redirectTo="/devices"
            />
          </div>
        </div>
      </div>
    </>
  );
}
