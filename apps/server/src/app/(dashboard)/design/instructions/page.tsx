import { DesignInstructions } from '@/components/design-instructions';
import { requireAdminPage } from '@/lib/auth/session';
import { getInstructions } from '@/lib/design/instructions';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function DesignInstructionsPage() {
  await requireAdminPage('/design/instructions');
  return <DesignInstructions state={getInstructions()} />;
}
