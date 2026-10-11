import Link from 'next/link';

import { TimeAgo } from '@/components/time-ago';
import { Badge, Empty, PageHeader } from '@/components/ui';
import { requireAdminPage } from '@/lib/auth/session';
import { bytes } from '@/lib/client/format';
import { isReadOnlyScreen } from '@/lib/screens/read-only';
import { listScreens, screenUsage } from '@/lib/screens/service';
import { visibleScreens } from '@/lib/screens/visible';
import { getHideBuiltinScreens } from '@/lib/settings/service';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function ScreensPage() {
  await requireAdminPage('/screens');
  const all = listScreens();
  const shown = visibleScreens(all, getHideBuiltinScreens());
  const hidden = all.length - shown.length;
  const screens = shown.map((s) => {
    const usage = screenUsage(s.id);
    return { ...s, used: usage.devices.length + usage.playlists.length };
  });
  return (
    <>
      <PageHeader title="Screens">
        <Link
          href="/screens/new"
          className="label-mono bg-signal hover:bg-ink hover:text-signal-tint inline-flex h-10 items-center rounded px-5 text-white"
        >
          New screen
        </Link>
      </PageHeader>
      {hidden > 0 && (
        <p className="text-subtle mb-3 text-sm">
          {hidden} built-in {hidden === 1 ? 'screen' : 'screens'} hidden. Show them in{' '}
          <Link href="/settings" className="text-ink underline underline-offset-2">
            Settings
          </Link>
          .
        </p>
      )}
      {screens.length === 0 ? (
        <Empty>No screens yet.</Empty>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="caption-mono border-ink text-subtle border-b text-left">
              <th className="pr-3 pb-2 font-normal">Name</th>
              <th className="pr-3 pb-2 font-normal">Source</th>
              <th className="pr-3 pb-2 font-normal">Size</th>
              <th className="pr-3 pb-2 font-normal">Used by</th>
              <th className="pr-3 pb-2 font-normal">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-graphite/30 divide-y">
            {screens.map((s) => (
              <tr key={s.id}>
                <td className="py-2.5 pr-3">
                  <Link
                    href={`/screens/${s.id}`}
                    className="text-ink font-medium underline-offset-2 hover:underline"
                  >
                    {s.name}
                  </Link>
                  {s.description && <div className="text-subtle text-xs">{s.description}</div>}
                </td>
                <td className="py-2.5 pr-3">
                  <span className="flex items-center gap-1.5">
                    <Badge
                      tone={s.source === 'ai' ? 'blue' : s.source === 'builtin' ? 'gray' : 'green'}
                    >
                      {s.source}
                    </Badge>
                    {isReadOnlyScreen(s) && <Badge tone="amber">read-only</Badge>}
                  </span>
                </td>
                <td className="text-subtle py-2.5 pr-3">{bytes(s.htmlBytes)}</td>
                <td className="text-subtle py-2.5 pr-3">{s.used || '—'}</td>
                <td className="text-subtle py-2.5">
                  <TimeAgo iso={s.updatedAt.toISOString()} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
