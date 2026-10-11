'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api, ApiClientError } from '@/lib/client/api';
import type { InstructionsState } from '@/lib/design/tokens';

import { Badge, Button, Card, ErrorText } from './ui';

export function DesignInstructions({ state }: { state: InstructionsState }) {
  const router = useRouter();
  const [text, setText] = useState(state.text);
  // Re-sync when the server state changes (after save/reset refresh).
  const [seen, setSeen] = useState(state.text);
  if (seen !== state.text) {
    setSeen(state.text);
    setText(state.text);
  }
  const [pending, setPending] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = text !== state.text;

  async function run(fn: () => Promise<InstructionsState>) {
    setError(null);
    setPending(true);
    try {
      const next = await fn();
      setSeen(next.text);
      setText(next.text);
      setConfirmReset(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    } finally {
      setPending(false);
    }
  }

  const save = () =>
    run(() =>
      api<InstructionsState>('/api/design/instructions', { method: 'PUT', body: { text } }),
    );

  function reset() {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    void run(() => api<InstructionsState>('/api/design/instructions', { method: 'DELETE' }));
  }

  return (
    <Card
      title="Agent instructions"
      actions={state.customised ? <Badge tone="amber">customised</Badge> : undefined}
    >
      <div className="space-y-3">
        <p className="text-subtle text-sm">
          The guide the AI follows when it generates or edits a screen. It defaults to
          docs/screen-authoring.md. The theme, downloaded fonts and the reply format are added
          automatically.
        </p>
        {state.defaultChanged && (
          <p className="border-signal-tint bg-signal-tint text-ink rounded border px-3 py-2 text-sm">
            The built-in guide changed since you edited this (a ShowRunner update). Reset to get the
            new version, or merge the changes by hand.
          </p>
        )}
        <textarea
          className="border-graphite bg-ground text-ink focus:border-signal min-h-[28rem] w-full rounded border p-3 font-mono text-xs leading-relaxed outline-none"
          value={text}
          spellCheck={false}
          disabled={pending}
          onChange={(e) => {
            setText(e.target.value);
            setConfirmReset(false);
          }}
          aria-label="Agent instructions"
        />
        <p className="text-subtle text-xs">{text.length.toLocaleString()} characters</p>
        <ErrorText>{error}</ErrorText>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled={pending || !dirty || !text.trim()} onClick={save}>
            Save
          </Button>
          {dirty && (
            <Button
              disabled={pending}
              onClick={() => {
                setText(state.text);
                setError(null);
              }}
            >
              Discard changes
            </Button>
          )}
          <Button
            variant={confirmReset ? 'danger' : 'secondary'}
            disabled={pending || !state.customised}
            onClick={reset}
          >
            {confirmReset ? 'Click again to reset' : 'Reset to default'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
