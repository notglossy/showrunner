'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { DeviceCommandRequest } from '@/lib/api/types';
import { api, ApiClientError } from '@/lib/client/api';

import type { Option } from './assignment-select';
import { Button, ErrorText, inputBase, inputClass } from './ui';

export function DeviceCommands({
  deviceId,
  screens,
  claimed,
  strict,
}: {
  deviceId: string;
  screens: Option[];
  claimed: boolean;
  strict: boolean;
}) {
  const router = useRouter();
  const [screenId, setScreenId] = useState(screens[0]?.id ?? '');
  // A live refresh can drop the chosen screen from the options (e.g. built-ins hidden in Settings);
  // fall back to the first one so the select and "Show now" always agree.
  const selectedId = screens.some((s) => s.id === screenId) ? screenId : (screens[0]?.id ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(command: DeviceCommandRequest) {
    setError(null);
    setMessage(null);
    try {
      const { delivered, queued } = await api<{ delivered: number; queued?: boolean }>(
        `/api/devices/${deviceId}/commands`,
        { method: 'POST', body: command },
      );
      setMessage(
        queued
          ? 'Queued. The display picks it up with its next heartbeat (within about 30 seconds).'
          : delivered > 0
            ? `Sent ${command.type} to ${delivered} connection${delivered === 1 ? '' : 's'}.`
            : "Sent, but the display isn't connected right now.",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => send({ type: 'reload' })}>Reload page</Button>
        <Button onClick={() => send({ type: 'refreshData' })}>Refresh data</Button>
      </div>
      {claimed && screens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <select
            className={`${inputBase} min-w-48 flex-1`}
            value={selectedId}
            onChange={(e) => setScreenId(e.target.value)}
          >
            {screens.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button
            onClick={() => send({ type: 'navigate', screenId: selectedId })}
            disabled={!selectedId}
          >
            Show now
          </Button>
        </div>
      )}
      <p className="text-subtle text-xs">
        &ldquo;Show now&rdquo; switches the display without changing its assignment; a playlist
        resumes after one dwell.
      </p>
      <div className="border-graphite/40 mt-1 flex flex-wrap gap-2 border-t pt-3">
        <Button onClick={() => send({ type: 'openExitMenu' })}>Open exit menu</Button>
        <Button onClick={() => send({ type: 'openSettings' })}>Open Android settings</Button>
        {strict && (
          <Button
            variant="danger"
            onClick={() =>
              window.confirm(
                'Leave strict mode? The app stops being device owner; it stays the Home app.',
              ) && send({ type: 'exitStrictMode' })
            }
          >
            Leave strict mode
          </Button>
        )}
      </div>
      <p className="text-subtle text-xs">
        Kiosk commands run on the display itself. The exit menu opens without asking for the PIN
        when sent from here.
      </p>
      {message && <p className="text-ink text-sm">{message}</p>}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export function RenameDevice({ deviceId, name }: { deviceId: string; name: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api(`/api/devices/${deviceId}`, { method: 'PATCH', body: { name: value } });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          className={inputClass}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          required
        />
        <Button type="submit" disabled={value === (name ?? '')}>
          {saved ? 'Saved' : 'Rename'}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

/** Outline trash can, sized by the surrounding font. */
function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

/**
 * Deletes a device after a confirm. `icon` renders a compact trash button for list rows; pass
 * `redirectTo` from pages that stop existing with the device (its detail page), list pages just
 * refresh in place.
 */
export function DeleteDevice({
  deviceId,
  name,
  icon = false,
  redirectTo,
}: {
  deviceId: string;
  name: string;
  icon?: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function remove() {
    if (
      !window.confirm(
        `Delete "${name}"? If the app is still running it will register again and show a new pairing code.`,
      )
    )
      return;
    setPending(true);
    setError(null);
    try {
      await api(`/api/devices/${deviceId}`, { method: 'DELETE' });
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    } finally {
      setPending(false);
    }
  }
  if (icon) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="text-subtle hover:text-danger"
          onClick={remove}
          disabled={pending}
          aria-label={`Delete ${name}`}
          title="Delete"
        >
          <TrashIcon />
        </Button>
        <ErrorText>{error}</ErrorText>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <Button variant="danger" onClick={remove} disabled={pending}>
        {pending ? 'Deleting…' : 'Delete device'}
      </Button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
