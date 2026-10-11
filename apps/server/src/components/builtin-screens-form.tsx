'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api, ApiClientError } from '@/lib/client/api';

import { Card, ErrorText } from './ui';

export function BuiltinScreensForm({ hide }: { hide: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(hide);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setError(null);
    setChecked(next);
    setPending(true);
    try {
      await api('/api/settings', { method: 'PATCH', body: { hideBuiltinScreens: next } });
      router.refresh();
    } catch (err) {
      setChecked(!next);
      setError(err instanceof ApiClientError ? err.detail : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card title="Built-in screens">
      <p className="text-subtle mb-3 text-sm">
        The screens that ship with ShowRunner are read-only; duplicate one to make an editable copy.
        Hiding them removes them from the Screens list and screen pickers. Displays and playlists
        already using one keep it.
      </p>
      <label className="text-ink flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-signal h-4 w-4"
          checked={checked}
          disabled={pending}
          onChange={(e) => void toggle(e.target.checked)}
        />
        Hide built-in screens
      </label>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
