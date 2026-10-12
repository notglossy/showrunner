import { DesignTheme } from '@/components/design-theme';
import { getTheme } from '@/lib/design/theme';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function DesignPage() {
  return <DesignTheme state={getTheme()} />;
}
