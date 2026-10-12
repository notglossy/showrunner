import { DesignInstructions } from '@/components/design-instructions';
import { getInstructions } from '@/lib/design/instructions';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function DesignInstructionsPage() {
  return <DesignInstructions state={getInstructions()} />;
}
