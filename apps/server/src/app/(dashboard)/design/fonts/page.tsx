import { DesignFonts } from '@/components/design-fonts';
import { listCustomFonts } from '@/lib/design/fonts';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function DesignFontsPage() {
  return <DesignFonts fonts={listCustomFonts()} />;
}
