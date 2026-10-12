import type { ReactNode } from 'react';

import { DesignTabs } from '@/components/design-tabs';
import { PageHeader } from '@/components/ui';
import { requireAdminPage } from '@/lib/auth/session';
import { customFontFaceCss, listCustomFonts } from '@/lib/design/fonts';
import { fontFaceCss } from '@/lib/render/fonts';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function DesignLayout({ children }: { children: ReactNode }) {
  await requireAdminPage('/design');
  const fonts = listCustomFonts();
  return (
    <>
      {/* Bundled and downloaded fonts, so font pickers and samples render in the real typeface. */}
      <style>{`${fontFaceCss()}\n${customFontFaceCss(fonts)}`}</style>
      <PageHeader title="Design" />
      <div className="flex flex-col gap-6">
        <DesignTabs />
        {children}
      </div>
    </>
  );
}
