import { afterEach, describe, expect, it, vi } from 'vitest';

import { type CustomFont, DEFAULT_THEME } from '@/lib/design/tokens';
import { BUILTIN_SCREENS } from '@/lib/seed/screens';

import {
  AiProviderError,
  type ChatChunk,
  type ChatOptions,
  type ChatResult,
  streamChat,
} from './client';
import { type GenerateEvent, generateScreen } from './generate';
import { buildMessages, designAppendix, repairMessage, systemPrompt } from './prompt';
import { boundPaths, validateTemplate } from './validate';

const FENCE = '```';
const GOOD = BUILTIN_SCREENS[0]!.html;

function sseResponse(lines: string[], status = 200) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      // Split mid-line to exercise buffering.
      const text = lines.join('\n');
      controller.enqueue(enc.encode(text.slice(0, 37)));
      controller.enqueue(enc.encode(text.slice(37)));
      controller.close();
    },
  });
  return new Response(body, { status, headers: { 'content-type': 'text/event-stream' } });
}

const chunk = (delta: object, extra: object = {}) =>
  `data: ${JSON.stringify({ model: 'google/gemini-3.8-flash', choices: [{ delta, finish_reason: null }], ...extra })}`;

afterEach(() => vi.unstubAllGlobals());

describe('streamChat', () => {
  const opts = (extra: Partial<ChatOptions> = {}): ChatOptions => ({
    baseUrl: 'https://openrouter.ai/api/v1/',
    apiKey: 'sk-test',
    model: 'google/gemini-3.8-flash',
    messages: [{ role: 'user', content: 'hi' }],
    ...extra,
  });

  it('parses SSE chunks, skips comments, separates reasoning from content, and reads usage', async () => {
    const fetchMock = vi.fn(async () =>
      sseResponse([
        ': OPENROUTER PROCESSING',
        '',
        chunk({ reasoning: 'thinking…' }),
        '',
        chunk({ content: 'Hello ' }),
        '',
        chunk({ content: 'world' }),
        '',
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 3 } })}`,
        '',
        'data: [DONE]',
        '',
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);
    const chunks: ChatChunk[] = [];
    const result = await streamChat(opts({ onChunk: (c) => chunks.push(c) }));
    expect(result).toEqual<ChatResult>({
      content: 'Hello world',
      model: 'google/gemini-3.8-flash',
      finishReason: 'stop',
      usage: { promptTokens: 12, completionTokens: 3 },
    });
    expect(chunks.map((c) => c.type)).toEqual(['reasoning', 'content', 'content']);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: 'google/gemini-3.8-flash',
      stream: true,
    });
  });

  it("surfaces HTTP errors with the provider's message", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: { message: 'not/a-model is not a valid model ID', code: 400 } },
          { status: 400 },
        ),
      ),
    );
    await expect(streamChat(opts())).rejects.toThrow(
      /HTTP 400: not\/a-model is not a valid model ID/,
    );
  });

  it('surfaces errors sent inside the stream', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          chunk({ content: 'partial' }),
          '',
          `data: ${JSON.stringify({ error: { message: 'rate limited', code: 429 } })}`,
          '',
        ]),
      ),
    );
    await expect(streamChat(opts())).rejects.toBeInstanceOf(AiProviderError);
  });
});

describe('validateTemplate', () => {
  it('accepts the built-in screens', () => {
    for (const s of BUILTIN_SCREENS) expect(validateTemplate(s.html)).toEqual([]);
  });

  it('reports rule violations in plain language', () => {
    const bad = `<!doctype html><html><body><link rel="stylesheet" href="https://fonts.googleapis.com/css"><style>a{}</style><style>b{}</style>
      <span data-bind="weather.current.temp"></span><div data-bind-attr="data-x:time.nope"></div>
      <script src="x.js"></script><script>fetch("/x"); setInterval(f, 10)`;
    const problems = validateTemplate(bad).join('\n');
    expect(problems).toMatch(/start with a <style>/);
    expect(problems).toMatch(/document-level tags/);
    expect(problems).toMatch(/http:\/\/ or https:\/\//);
    expect(problems).toMatch(/<script src>/);
    expect(problems).toMatch(/fetch/);
    expect(problems).toMatch(/setInterval/);
    expect(problems).toMatch(/exactly one <style>/);
    expect(problems).toMatch(/not closed/);
    expect(problems).toMatch(/weather\.current\.temp, time\.nope/);
    expect(validateTemplate('   ')).toEqual(['The template is empty.']);
  });

  it('collects bound paths from both binding attributes', () => {
    expect(
      boundPaths(
        '<a data-bind="time.hhmm"></a><b data-bind-attr="data-i:weather.current.icon; title:time.date"></b>',
      ),
    ).toEqual(['time.hhmm', 'weather.current.icon', 'time.date']);
  });
});

describe('prompt', () => {
  it('uses the authoring doc plus the response format as the system prompt', () => {
    const doc = systemPrompt();
    expect(doc).toContain('# Screen authoring guide');
    expect(doc).toContain('## Response format');
  });

  it('uses an explicit doc verbatim and still ends with the response format', () => {
    const prompt = systemPrompt('MY DOC');
    expect(prompt.startsWith('MY DOC')).toBe(true);
    expect(prompt).toContain("## This installation's theme and fonts");
    expect(prompt.indexOf('## Response format')).toBeGreaterThan(
      prompt.indexOf('## This installation'),
    );
    expect(prompt.endsWith('not a diff or excerpt.')).toBe(true);
  });

  it('builds the design appendix from the theme', () => {
    const out = designAppendix(DEFAULT_THEME, []);
    expect(out).toContain('| `--sr-bg` | `#000000` | Page background |');
    expect(out).toContain(
      '| `--sr-accent-text` | `#a995ff` | Accent on the background: text, icons, hands |',
    );
    expect(out).toContain(
      '| `--sr-font-display` | `"Space Grotesk", system-ui, sans-serif` | Big numbers and headings |',
    );
    expect(out).toContain('| `--sr-font-mono` | `"JetBrains Mono", monospace` |');
    expect(out).toContain('`color: var(--sr-text-muted, #c9ced8);`');
    expect(out).not.toContain('Extra fonts');
  });

  it('uses current theme values and lists extra fonts with formatted weights', () => {
    const fonts: CustomFont[] = [
      { family: 'Inter', files: [{ file: 'a.woff2', weight: '100 900' }], bytes: 1, addedAt: '' },
      {
        family: 'Lora',
        files: [
          { file: 'b.woff2', weight: '700' },
          { file: 'c.woff2', weight: '400' },
        ],
        bytes: 1,
        addedAt: '',
      },
    ];
    const theme = { ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, textMuted: '#123456' } };
    const out = designAppendix(theme, fonts);
    expect(out).toContain('| `--sr-text-muted` | `#123456` |');
    expect(out).toContain('var(--sr-text-muted, #123456)');
    expect(out).toContain('### Extra fonts downloaded by the owner');
    expect(out).toContain('| `"Inter"` | 100–900 |');
    expect(out).toContain('| `"Lora"` | 400, 700 |');
  });

  it('builds new-screen and revise messages', () => {
    const fresh = buildMessages({ instruction: 'A big clock', doc: 'DOC' });
    expect(fresh.map((m) => m.role)).toEqual(['system', 'user']);
    expect(fresh[1]!.content).toBe('Create a new screen.\n\nA big clock');

    const revise = buildMessages({
      instruction: 'Make it bigger',
      currentHtml: '<style></style><p/>',
      previewErrors: ['TypeError: x'],
      doc: 'DOC',
    });
    expect(revise[1]!.content).toContain(`${FENCE}html\n<style></style><p/>\n${FENCE}`);
    expect(revise[1]!.content).toContain('- TypeError: x');
    expect(revise[1]!.content.endsWith('Make it bigger')).toBe(true);
    expect(repairMessage(['No URLs.']).content).toContain('- No URLs.');
  });
});

describe('generateScreen', () => {
  const config = { baseUrl: 'http://ai', apiKey: 'k', model: 'default/model' };

  function fakeChat(replies: Partial<ChatResult>[]) {
    const calls: ChatOptions[] = [];
    const chat = vi.fn(async (options: ChatOptions) => {
      calls.push(structuredClone({ ...options, onChunk: undefined, signal: undefined }));
      options.onChunk?.({ type: 'content', text: 'x' });
      const next = replies.shift()!;
      return {
        content: '',
        model: 'used/model',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50 },
        ...next,
      };
    });
    return { chat, calls };
  }

  async function run(replies: Partial<ChatResult>[], request = { instruction: 'A clock' }) {
    const events: GenerateEvent[] = [];
    const { chat, calls } = fakeChat(replies);
    await generateScreen(request, config, (e) => events.push(e), {
      chat: chat as unknown as typeof streamChat,
      doc: 'DOC',
    });
    return { events, calls, result: events.at(-1)! };
  }

  it('returns valid output from a single call', async () => {
    const { result, calls } = await run([{ content: `${FENCE}html\n${GOOD}\n${FENCE}` }]);
    expect(result).toMatchObject({
      type: 'result',
      html: GOOD,
      problems: [],
      attempts: 1,
      model: 'used/model',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.model).toBe('default/model');
  });

  it('asks the model to repair invalid output once, with the problems listed', async () => {
    const bad = `${FENCE}html\n<style>a{}</style><img src="https://x/y.png">\n${FENCE}`;
    const { result, calls } = await run(
      [{ content: bad }, { content: `${FENCE}html\n${GOOD}\n${FENCE}` }],
      { instruction: 'x', model: 'picked/model' } as never,
    );
    expect(result).toMatchObject({
      type: 'result',
      html: GOOD,
      problems: [],
      attempts: 2,
      usage: { promptTokens: 200, completionTokens: 100 },
    });
    expect(calls[1]!.model).toBe('picked/model');
    expect(calls[1]!.messages.at(-2)).toMatchObject({ role: 'assistant', content: bad });
    expect(calls[1]!.messages.at(-1)!.content).toMatch(/https:\/\//);
  });

  it('returns remaining problems if the repair still fails, and flags truncation', async () => {
    const bad = `${FENCE}html\n<style>a{}</style><span data-bind="nope.x"></span>\n${FENCE}`;
    const { result } = await run([{ content: bad }, { content: bad, finishReason: 'length' }]);
    expect(result.type).toBe('result');
    if (result.type === 'result') {
      expect(result.attempts).toBe(2);
      expect(result.problems.join(' ')).toMatch(/nope\.x/);
      expect(result.problems.join(' ')).toMatch(/cut off/);
    }
  });

  it('errors when the model never returns HTML', async () => {
    const { result } = await run([{ content: "I can't do that." }, { content: 'Still no.' }]);
    expect(result).toMatchObject({ type: 'error' });
  });
});
