import { BuiltinScreensForm } from '@/components/builtin-screens-form';
import { KioskPinForm } from '@/components/kiosk-pin-form';
import { SettingsForm } from '@/components/settings-form';
import { PageHeader } from '@/components/ui';
import { requireAdminPage } from '@/lib/auth/session';
import { getSettings } from '@/lib/settings/service';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requireAdminPage('/settings');
  const { effective, defaults, overrides, kioskExitPinSet, hideBuiltinScreens } = getSettings();
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsForm effective={effective} defaults={defaults} overrides={overrides} />
      <div className="mt-6 lg:w-2/3">
        <KioskPinForm pinSet={kioskExitPinSet} />
      </div>
      <div className="mt-6 lg:w-2/3">
        <BuiltinScreensForm hide={hideBuiltinScreens} />
      </div>
    </>
  );
}
