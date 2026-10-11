'use client';

import type { ThemeState } from '@/lib/design/tokens';

import { Card } from './ui';

// TODO: Piece B (theme) implements this component. Keep the name and props.
export function DesignTheme({ state }: { state: ThemeState }) {
  void state;
  return <Card title="Theme">Coming soon.</Card>;
}
