import { DesignFonts } from '@/components/design-fonts';
import { requireAdminPage } from '@/lib/auth/session';
import { listCustomFonts } from '@/lib/design/fonts';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function DesignFontsPage() {
  await requireAdminPage('/design/fonts');
  return <DesignFonts fonts={listCustomFonts()} />;
}
