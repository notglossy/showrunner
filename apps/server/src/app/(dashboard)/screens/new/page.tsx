import { ScreenEditor } from '@/components/screen-editor';
import { PageHeader } from '@/components/ui';
import { requireAdminPage } from '@/lib/auth/session';
import { designCss } from '@/lib/design/css';
import { samplePayload } from '@/lib/providers/sample';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

const STARTER = `<style>
  .screen { position: fixed; inset: 0; display: grid; place-content: center; text-align: center;
            font-family: "Inter", system-ui, sans-serif; }
  .screen__time { font-size: 240px; font-weight: 300; line-height: 1; font-variant-numeric: tabular-nums; }
  .screen__date { margin-top: 24px; font-size: 56px; color: #c9ced8; }
</style>

<main class="screen">
  <div class="screen__time" data-bind="time.hhmm"></div>
  <div class="screen__date" data-bind="time.date"></div>
</main>
`;

export default async function NewScreenPage() {
  await requireAdminPage('/screens/new');
  return (
    <>
      <PageHeader title="New screen" />
      <ScreenEditor
        screen={{
          id: null,
          name: '',
          description: '',
          html: STARTER,
          dataRefreshSeconds: 60,
          source: 'user',
          generationPrompt: null,
        }}
        sampleData={samplePayload()}
        designCss={designCss()}
        usage={{ devices: [], playlists: [] }}
      />
    </>
  );
}
