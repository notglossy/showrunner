import { DesignFonts } from '@/components/design-fonts';
import { DesignInstructions } from '@/components/design-instructions';
import { DesignTheme } from '@/components/design-theme';
import { PageHeader } from '@/components/ui';
import { requireAdminPage } from '@/lib/auth/session';
import { listCustomFonts } from '@/lib/design/fonts';
import { getInstructions } from '@/lib/design/instructions';
import { getTheme } from '@/lib/design/theme';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function DesignPage() {
  await requireAdminPage('/design');
  return (
    <>
      <PageHeader title="Design" />
      <div className="flex flex-col gap-6">
        <DesignTheme state={getTheme()} />
        <DesignFonts fonts={listCustomFonts()} />
        <DesignInstructions state={getInstructions()} />
      </div>
    </>
  );
}
