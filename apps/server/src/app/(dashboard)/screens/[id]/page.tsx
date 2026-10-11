import { notFound } from 'next/navigation';

import { ScreenEditor } from '@/components/screen-editor';
import { Badge, PageHeader } from '@/components/ui';
import { requireAdminPage } from '@/lib/auth/session';
import { samplePayload } from '@/lib/providers/sample';
import { findScreen, screenUsage } from '@/lib/screens/service';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function ScreenPage({ params }: PageProps<'/screens/[id]'>) {
  const { id } = await params;
  await requireAdminPage(`/screens/${id}`);
  const screen = findScreen(id);
  if (!screen) notFound();
  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {screen.name} <Badge>{screen.source}</Badge>
          </span>
        }
      />
      <ScreenEditor
        key={screen.id}
        screen={{
          id: screen.id,
          name: screen.name,
          description: screen.description,
          html: screen.html,
          dataRefreshSeconds: screen.dataRefreshSeconds,
          source: screen.source,
          generationPrompt: screen.generationPrompt,
        }}
        sampleData={samplePayload()}
        usage={screenUsage(screen.id)}
      />
    </>
  );
}
