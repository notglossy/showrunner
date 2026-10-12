'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/client/api';
import type { KioskDataPayload } from '@/lib/providers/payload';
import { deviceUrls, renderKioskDocument } from '@/lib/render/document';

import { Button } from './ui';

const CANVAS_W = 1280;
const CANVAS_H = 800;

export interface PreviewLog {
  level: string;
  message: string;
  line: number | null;
}

/**
 * Renders a template exactly as a device would (same document shell + runtime) in a sandboxed iframe
 * at 1280x800, scaled to fit. Data is pushed in via postMessage: the bundled sample, or live data.
 */
export function ScreenPreview({
  html,
  title,
  sampleData,
  designCss,
  onLogs,
}: {
  html: string;
  title: string;
  sampleData: KioskDataPayload;
  /** Theme and downloaded-font CSS from the server (lib/design/css.ts), as a device would get it. */
  designCss: string;
  onLogs?: (logs: PreviewLog[]) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [srcDoc, setSrcDoc] = useState('');
  const [source, setSource] = useState<'sample' | 'live'>('sample');
  const [liveData, setLiveData] = useState<KioskDataPayload | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const logs = useRef<PreviewLog[]>([]);
  const [renderKey, setRenderKey] = useState(0);

  const currentData = useCallback((): KioskDataPayload => {
    const data = source === 'live' && liveData ? liveData : sampleData;
    // The runtime sets its clock from time.epochMs; sample data is frozen and live data may be a minute old.
    return { ...data, time: { ...data.time, epochMs: Date.now(), iso: new Date().toISOString() } };
  }, [source, liveData, sampleData]);

  // Scale the 1280x800 canvas to the available width.
  useEffect(() => {
    if (!box.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / CANVAS_W);
    });
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  // Re-render the document shortly after edits stop.
  useEffect(() => {
    const id = setTimeout(() => {
      logs.current = [];
      onLogs?.([]);
      setSrcDoc(
        renderKioskDocument({
          title,
          body: html,
          boot: {
            deviceId: 'preview',
            screenId: 'preview',
            viewer: 'preview',
            refreshSeconds: 60,
            serverTime: Date.now(),
            urls: deviceUrls('preview'),
            data: currentData(),
          },
          designCss,
        }),
      );
    }, 400);
    return () => clearTimeout(id);
    // currentData is read at render time on purpose; data updates are pushed via postMessage instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, title, designCss, renderKey]);

  // Collect runtime errors reported by the iframe.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.data?.type !== 'kiosk:log') return;
      logs.current = [
        ...logs.current,
        { level: event.data.level, message: event.data.message, line: event.data.line },
      ].slice(-20);
      onLogs?.(logs.current);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onLogs]);

  const pushData = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: 'kiosk:data', data: currentData() }, '*');
  }, [currentData]);

  useEffect(() => {
    pushData();
  }, [pushData]);

  // Live data: fetch now and every minute while selected.
  useEffect(() => {
    if (source !== 'live') return;
    let cancelled = false;
    const load = () =>
      api<KioskDataPayload>('/api/preview/data')
        .then((data) => {
          if (!cancelled) {
            setLiveData(data);
            setLiveError(null);
          }
        })
        .catch((err) => !cancelled && setLiveError(String(err.message ?? err)));
    const first = setTimeout(load, 0);
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [source]);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-subtle flex flex-wrap items-center gap-2 text-xs">
        <span>Data:</span>
        <Button
          size="sm"
          variant={source === 'sample' ? 'primary' : 'secondary'}
          onClick={() => setSource('sample')}
        >
          Sample
        </Button>
        <Button
          size="sm"
          variant={source === 'live' ? 'primary' : 'secondary'}
          onClick={() => setSource('live')}
        >
          Live
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRenderKey((k) => k + 1)}>
          ↻ Reload
        </Button>
        <span className="ml-auto">1280×800 at {Math.round(scale * 100)}%</span>
      </div>
      {liveError && <p className="text-danger text-xs">Live data failed: {liveError}</p>}
      <div
        ref={box}
        className="border-ink relative w-full overflow-hidden rounded border bg-black"
        style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
      >
        <iframe
          ref={frame}
          title="Screen preview"
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          onLoad={pushData}
          className="absolute top-0 left-0 origin-top-left border-0"
          style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})` }}
        />
      </div>
    </div>
  );
}
