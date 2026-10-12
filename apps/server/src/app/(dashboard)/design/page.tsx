import { DesignTheme } from '@/components/design-theme';
import { requireAdminPage } from '@/lib/auth/session';
import { getTheme } from '@/lib/design/theme';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function DesignPage() {
  await requireAdminPage('/design');
  return <DesignTheme state={getTheme()} />;
}
