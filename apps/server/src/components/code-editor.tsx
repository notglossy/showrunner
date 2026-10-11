'use client';

import { indentWithTab } from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { useEffect, useRef } from 'react';

/**
 * CodeMirror 6 HTML editor. `value` is controlled: external changes (e.g. AI output) replace the document.
 * `height` and `readOnly` are read once at mount.
 */
export function CodeEditor({
  value,
  onChange,
  height = '34rem',
  readOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  readOnly?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const initial = useRef({ value, height, readOnly });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial.current.value,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          html(),
          EditorView.lineWrapping,
          EditorState.readOnly.of(initial.current.readOnly),
          EditorView.editable.of(!initial.current.readOnly),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
          EditorView.theme({
            '&': { height: initial.current.height, fontSize: '13px' },
            '.cm-scroller': { fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace' },
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = view.current;
    if (editor && value !== editor.state.doc.toString()) {
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
    }
  }, [value]);

  return <div ref={host} className="border-ink overflow-hidden rounded border bg-white" />;
}
