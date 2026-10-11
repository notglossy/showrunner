'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { api, ApiClientError } from '@/lib/client/api';
import type { CustomFont } from '@/lib/design/tokens';

import { Button, Card, Empty, ErrorText, inputBase } from './ui';

const kb = (bytes: number) => Math.max(1, Math.round(bytes / 1024));

export function DesignFonts({ fonts }: { fonts: CustomFont[] }) {
  const router = useRouter();
  const [family, setFamily] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = family.trim();
    if (!name) return;
    setError(null);
    setPending(true);
    try {
      await api('/api/design/fonts', { method: 'POST', body: { family: name } });
      setFamily('');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    } finally {
      setPending(false);
    }
  }

  async function remove(name: string) {
    if (confirming !== name) {
      setConfirming(name);
      return;
    }
    setError(null);
    setDeleting(name);
    try {
      await api(`/api/design/fonts/${encodeURIComponent(name)}`, { method: 'DELETE' });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    } finally {
      setDeleting(null);
      setConfirming(null);
    }
  }

  return (
    <Card title="Fonts">
      <p className="text-subtle mb-3 text-sm">
        Download a family from Google Fonts by its exact name, e.g. Roboto Slab (names are
        case-sensitive). Only the Latin subset is stored on this server; screens and the AI can then
        use it.
      </p>
      <form onSubmit={(e) => void add(e)} className="mb-3 flex gap-2">
        <input
          className={`${inputBase} min-w-0 flex-1`}
          value={family}
          maxLength={64}
          placeholder="Roboto Slab"
          aria-label="Google Fonts family name"
          disabled={pending}
          onChange={(e) => setFamily(e.target.value)}
        />
        <Button type="submit" variant="primary" disabled={pending || !family.trim()}>
          {pending ? 'Downloading…' : 'Add'}
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
      {fonts.length === 0 ? (
        <Empty>No downloaded fonts yet.</Empty>
      ) : (
        <ul className="divide-graphite divide-y">
          {fonts.map((f) => (
            <li key={f.family} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p
                  className="text-ink truncate text-xl"
                  style={{ fontFamily: `"${f.family}", system-ui` }}
                >
                  {f.family}
                </p>
                <p className="text-subtle text-xs">
                  Weights {f.files.map((x) => x.weight).join(', ')} · {kb(f.bytes)} KB
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                disabled={deleting === f.family}
                onClick={() => void remove(f.family)}
                onBlur={() => setConfirming((c) => (c === f.family ? null : c))}
              >
                {confirming === f.family ? 'Confirm delete' : 'Delete'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
