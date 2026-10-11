import Link from 'next/link';

import { AssignmentSelect } from '@/components/assignment-select';
import { AutoRefresh } from '@/components/auto-refresh';
import { ClaimDevice } from '@/components/claim-device';
import { DeleteDevice } from '@/components/device-actions';
import { DeviceStatus } from '@/components/device-status';
import { RegistrationWindow } from '@/components/registration-window';
import { TimeAgo } from '@/components/time-ago';
import { Card, Empty, PageHeader } from '@/components/ui';
import { requireAdminPage } from '@/lib/auth/session';
import { registrationStatus } from '@/lib/devices/registration';
import { listDevices, toDeviceView } from '@/lib/devices/service';
import { listPlaylists } from '@/lib/playlists/service';
import { listScreens } from '@/lib/screens/service';
import { visibleScreens } from '@/lib/screens/visible';
import { getHideBuiltinScreens } from '@/lib/settings/service';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function DevicesPage() {
  await requireAdminPage('/devices');
  const devices = listDevices().map((d) => toDeviceView(d));
  const allScreens = listScreens().map(({ id, name, source }) => ({ id, name, source }));
  const hide = getHideBuiltinScreens();
  const playlists = listPlaylists().map(({ id, name }) => ({ id, name }));
  const screenName = new Map(allScreens.map((s) => [s.id, s.name]));
  const unclaimed = devices.filter((d) => !d.claimed);
  const claimed = devices.filter((d) => d.claimed);

  return (
    <>
      <AutoRefresh seconds={10} />
      <PageHeader title="Devices" />

      <div className="mb-6">
        <RegistrationWindow status={registrationStatus()} />
      </div>

      {unclaimed.length > 0 && (
        <Card title="Waiting to be claimed" className="mb-6">
          <p className="text-subtle mb-3 text-sm">
            These displays have registered. Check the pairing code shown on the screen matches
            before claiming.
          </p>
          <ul className="divide-graphite/30 divide-y">
            {unclaimed.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-4 py-3">
                <div className="w-36">
                  <Link
                    href={`/devices/${d.id}`}
                    className="text-ink font-mono text-2xl font-semibold tracking-widest underline-offset-4 hover:underline"
                  >
                    {d.pairingCode}
                  </Link>
                  <div className="text-subtle text-xs">
                    {d.model} · registered <TimeAgo iso={d.registeredAt} />
                  </div>
                </div>
                <div className="min-w-72 flex-1">
                  <ClaimDevice pairingCode={d.pairingCode ?? ''} />
                </div>
                <DeleteDevice
                  deviceId={d.id}
                  name={`unclaimed display ${d.pairingCode ?? d.id}`}
                  icon
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Displays">
        {claimed.length === 0 ? (
          <Empty>No claimed displays yet. Install the app on a device and claim it here.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="caption-mono border-ink text-subtle border-b text-left">
                  <th className="pr-3 pb-2 font-normal">Name</th>
                  <th className="pr-3 pb-2 font-normal">Status</th>
                  <th className="pr-3 pb-2 font-normal">Last seen</th>
                  <th className="pr-3 pb-2 font-normal">Showing</th>
                  <th className="w-64 pr-3 pb-2 font-normal">Assigned</th>
                  <th className="pb-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-graphite/30 divide-y">
                {claimed.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/devices/${d.id}`}
                        className="text-ink font-medium underline-offset-2 hover:underline"
                      >
                        {d.name}
                      </Link>
                      <div className="text-subtle text-xs">{d.model}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <DeviceStatus device={d} />
                    </td>
                    <td className="text-subtle py-2.5 pr-3">
                      <TimeAgo iso={d.lastSeenAt} />
                    </td>
                    <td className="text-ink py-2.5 pr-3">
                      {d.currentScreenId ? (screenName.get(d.currentScreenId) ?? '—') : '—'}
                    </td>
                    <td className="py-2.5 pr-3">
                      <AssignmentSelect
                        deviceId={d.id}
                        assignment={d.assignment}
                        screens={visibleScreens(
                          allScreens,
                          hide,
                          d.assignment.type === 'screen' ? [d.assignment.screenId] : [],
                        )}
                        playlists={playlists}
                      />
                    </td>
                    <td className="py-2.5 text-right">
                      <DeleteDevice deviceId={d.id} name={d.name ?? d.id} icon />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Claim by code" className="mt-6">
        <p className="text-subtle mb-3 text-sm">Type the 6-character code shown on a display.</p>
        <ClaimDevice />
      </Card>
    </>
  );
}
