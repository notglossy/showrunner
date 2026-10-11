import { DesignFonts } from '@/components/design-fonts';
import { DesignInstructions } from '@/components/design-instructions';
import { DesignTheme } from '@/components/design-theme';
import { PageHeader } from '@/components/ui';
import { requireAdminPage } from '@/lib/auth/session';
import { customFontFaceCss, listCustomFonts } from '@/lib/design/fonts';
import { getInstructions } from '@/lib/design/instructions';
import { getTheme } from '@/lib/design/theme';
import { fontFaceCss } from '@/lib/render/fonts';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function DesignPage() {
  await requireAdminPage('/design');
  const fonts = listCustomFonts();
  return (
    <>
      {/* Bundled and downloaded fonts, so font pickers and samples render in the real typeface. */}
      <style>{`${fontFaceCss()}\n${customFontFaceCss(fonts)}`}</style>
      <PageHeader title="Design" />
      <div className="flex flex-col gap-6">
        <DesignTheme state={getTheme()} />
        <DesignFonts fonts={fonts} />
        <DesignInstructions state={getInstructions()} />
      </div>
    </>
  );
}
