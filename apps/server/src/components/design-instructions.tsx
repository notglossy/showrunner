'use client';

import type { InstructionsState } from '@/lib/design/tokens';

import { Card } from './ui';

// TODO: Piece D (instructions) implements this component. Keep the name and props.
export function DesignInstructions({ state }: { state: InstructionsState }) {
  void state;
  return <Card title="Agent instructions">Coming soon.</Card>;
}
