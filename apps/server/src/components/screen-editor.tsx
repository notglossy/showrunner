'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api, ApiClientError } from '@/lib/client/api';
import type { Screen } from '@/lib/db/schema';
import type { KioskDataPayload } from '@/lib/providers/payload';
import { buildDuplicateScreenInput } from '@/lib/screens/duplicate';

import { AiPanel, type AiResult } from './ai-panel';
import { CodeEditor } from './code-editor';
import { type PreviewLog, ScreenPreview } from './screen-preview';
import { Badge, Button, Card, ErrorText, Field, inputClass } from './ui';

export interface EditableScreen {
  id: string | null;
  name: string;
  description: string;
  html: string;
  dataRefreshSeconds: number;
  source: Screen['source'];
  generationPrompt: string | null;
}

export interface ScreenUsage {
  devices: { id: string; name: string | null }[];
  playlists: { id: string; name: string }[];
}

export function ScreenEditor({
  screen,
  sampleData,
  usage,
}: {
  screen: EditableScreen;
  sampleData: KioskDataPayload;
  usage: ScreenUsage;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(screen);
  const [draft, setDraft] = useState(screen);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [previewLogs, setPreviewLogs] = useState<PreviewLog[]>([]);
  /** html before each AI change, newest last, for undo. */
  const [aiHistory, setAiHistory] = useState<string[]>([]);
  /** Most recent instruction that produced the current draft, saved as generationPrompt. */
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  const dirty =
    draft.name !== saved.name ||
    draft.description !== saved.description ||
    draft.html !== saved.html ||
    draft.dataRefreshSeconds !== saved.dataRefreshSeconds;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setHtml = useCallback((html: string) => setDraft((d) => ({ ...d, html })), []);

  // Latest html, readable from async callbacks (an AI result can arrive after further edits).
  const htmlRef = useRef(draft.html);
  useEffect(() => {
    htmlRef.current = draft.html;
  }, [draft.html]);

  const applyAi = useCallback((result: AiResult) => {
    const before = htmlRef.current;
    setAiHistory((h) => [...h, before].slice(-20));
    setDraft((d) => ({ ...d, html: result.html }));
    setAiPrompt(result.instruction);
  }, []);

  function undoAi() {
    const previous = aiHistory.at(-1);
    if (previous === undefined) return;
    setAiHistory(aiHistory.slice(0, -1));
    setDraft((d) => ({ ...d, html: previous }));
  }

  async function save() {
    setPending(true);
    setError(null);
    const body = {
      name: draft.name,
      description: draft.description,
      html: draft.html,
      dataRefreshSeconds: draft.dataRefreshSeconds,
      ...(aiPrompt ? { source: 'ai' as const, generationPrompt: aiPrompt } : {}),
    };
    try {
      if (draft.id) {
        const { screen: updated } = await api<{ screen: Screen }>(`/api/screens/${draft.id}`, {
          method: 'PATCH',
          body,
        });
        setSaved({ ...draft, source: updated.source });
        setAiPrompt(null);
        router.refresh();
      } else {
        const { screen: created } = await api<{ screen: Screen }>('/api/screens', {
          method: 'POST',
          body,
        });
        setSaved({ ...draft, id: created.id });
        router.replace(`/screens/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!draft.id || !window.confirm(`Delete screen "${saved.name}"?`)) return;
    setError(null);
    try {
      await api(`/api/screens/${draft.id}`, { method: 'DELETE' });
      router.push('/screens');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    }
  }

  async function duplicate() {
    if (!draft.id) return;
    setPending(true);
    setError(null);
    try {
      // Copies the visible draft (including unsaved edits), not the saved row.
      const { screen: copy } = await api<{ screen: Screen }>('/api/screens', {
        method: 'POST',
        body: buildDuplicateScreenInput(draft, { savedName: saved.name, aiPrompt }),
      });
      router.push(`/screens/${copy.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Name" className="min-w-56 flex-1">
          <input
            className={inputClass}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            required
          />
        </Field>
        <Field label="Description" className="min-w-72 flex-[2]">
          <input
            className={inputClass}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </Field>
        <Field label="Data refresh (s)" className="w-32">
          <input
            className={inputClass}
            type="number"
            min={5}
            max={3600}
            value={draft.dataRefreshSeconds}
            onChange={(e) => setDraft({ ...draft, dataRefreshSeconds: Number(e.target.value) })}
          />
        </Field>
        <div className="flex items-center gap-2 pb-0.5">
          {dirty && <Badge tone="amber">Unsaved</Badge>}
          {draft.id && (
            <Button onClick={duplicate} disabled={pending}>
              Duplicate
            </Button>
          )}
          <Button
            variant="primary"
            onClick={save}
            disabled={pending || !dirty || !draft.name.trim() || !draft.html.trim()}
          >
            {pending ? 'Saving…' : draft.id ? 'Save' : 'Create screen'}
          </Button>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <AiPanel
            currentHtml={draft.html}
            hasExistingScreen={Boolean(draft.id)}
            previewErrors={previewLogs.map(
              (l) => `${l.message}${l.line ? ` (line ${l.line})` : ''}`,
            )}
            onResult={applyAi}
          />
          {aiHistory.length > 0 && (
            <div className="text-subtle flex items-center gap-2 text-xs">
              <Button size="sm" onClick={undoAi}>
                Undo AI change
              </Button>
              <span>
                {aiHistory.length} AI version{aiHistory.length === 1 ? '' : 's'} this session
              </span>
            </div>
          )}
          <CodeEditor value={draft.html} onChange={setHtml} />
          <p className="text-subtle mt-1 text-xs">
            Body fragment: one &lt;style&gt;, markup with data-bind attributes, optional
            &lt;script&gt;. See docs/screen-authoring.md.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-4 xl:self-start">
          <ScreenPreview
            html={draft.html}
            title={draft.name}
            sampleData={sampleData}
            onLogs={setPreviewLogs}
          />
          {previewLogs.length > 0 && (
            <Card title={`Preview errors (${previewLogs.length})`}>
              <ul className="flex flex-col gap-1 text-xs">
                {previewLogs.map((log, i) => (
                  <li key={i} className="text-danger font-mono">
                    {log.message}
                    {log.line ? ` (line ${log.line})` : ''}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {draft.id && (
            <Card title="Used by">
              {usage.devices.length === 0 && usage.playlists.length === 0 ? (
                <p className="text-subtle text-sm">Not assigned to any device or playlist.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {usage.devices.map((d) => (
                    <li key={d.id}>
                      Device{' '}
                      <Link className="underline underline-offset-2" href={`/devices/${d.id}`}>
                        {d.name ?? d.id}
                      </Link>
                    </li>
                  ))}
                  {usage.playlists.map((p) => (
                    <li key={p.id}>
                      Playlist{' '}
                      <Link className="underline underline-offset-2" href={`/playlists/${p.id}`}>
                        {p.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex justify-end">
                <Button variant="danger" size="sm" onClick={remove}>
                  Delete screen
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
