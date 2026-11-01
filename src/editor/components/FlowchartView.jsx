import { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { useApp } from '../../store/useApp';
import { isHex } from '../../lib/utils';
import { renderMermaid, FLOWCHART_TEMPLATES } from '../../lib/mermaid';
import { focusAfter } from './MathViews';
import { Workflow, Pencil, AlertTriangle, ExternalLink, Loader } from '../../components/icons';

const SYNTAX_URL = 'https://mermaid.js.org/syntax/flowchart.html';

/** Renders Mermaid source (debounced). Keeps the last good drawing while the source has a syntax error. */
function useMermaid(code, delay) {
  const dark = useApp((s) => s.resolvedTheme) === 'dark';
  const [state, setState] = useState({ svg: '', error: '', loading: !!code.trim() });
  useEffect(() => {
    if (!code.trim()) {
      setState({ svg: '', error: '', loading: false });
      return undefined;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    const t = setTimeout(() => {
      renderMermaid(code, { dark })
        .then((r) => alive && setState((s) => (r.error ? { svg: s.svg, error: r.error, loading: false } : { svg: r.svg, error: '', loading: false })))
        .catch(() => alive && setState((s) => ({ ...s, loading: false, error: 'The diagram engine could not be loaded. Check your connection and try again.' })));
    }, delay);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [code, dark, delay]);
  return state;
}

function Diagram({ svg, error, loading, stale }) {
  if (!svg && loading) {
    return (
      <div className="hm-flow-empty">
        <Loader size={15} className="spin" /> Drawing…
      </div>
    );
  }
  return (
    <>
      {/* SVG comes from Mermaid with securityLevel 'strict' (labels sanitized, no scripts / click handlers). */}
      {svg && <div className={`hm-flow-svg ${stale ? 'is-stale' : ''}`} dangerouslySetInnerHTML={{ __html: svg }} />}
      {error && (
        <div className="hm-flow-error">
          <AlertTriangle size={13} />
          <pre>{error}</pre>
        </div>
      )}
    </>
  );
}

export default function FlowchartView({ node, updateAttributes, editor, getPos, selected }) {
  const code = node.attrs.code || '';
  const [editing, setEditing] = useState(() => !code && editor.isEditable);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const busy = useRef(false); // a confirm dialog is open: don't treat the focus loss as "done"
  const view = useMermaid(code, editing ? 350 : 0);

  const finish = () => {
    setEditing(false);
    const pos = getPos();
    if (typeof pos === 'number') requestAnimationFrame(() => focusAfter(editor, pos + node.nodeSize));
  };

  const applyTemplate = async (t) => {
    if (code.trim() && code.trim() !== t.code) {
      busy.current = true;
      const ok = await useApp.getState().confirm({ title: 'Replace this diagram?', message: `Start over from the “${t.label}” template. Your current diagram text will be replaced.`, confirmLabel: 'Replace' });
      busy.current = false;
      setEditing(true);
      if (!ok) return requestAnimationFrame(() => inputRef.current?.focus());
    }
    updateAttributes({ code: t.code });
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const onKeyDown = (e) => {
    if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) || e.key === 'Escape') {
      e.preventDefault();
      finish();
    } else if (e.key === 'Tab') {
      // Indent with spaces instead of leaving the editor.
      e.preventDefault();
      const el = e.currentTarget;
      const { selectionStart: a, selectionEnd: b } = el;
      const next = `${code.slice(0, a)}    ${code.slice(b)}`;
      updateAttributes({ code: next });
      requestAnimationFrame(() => el.setSelectionRange(a + 4, a + 4));
    }
  };

  const keepOpen = (e) => e.preventDefault(); // buttons inside the editor must not blur the textarea

  return (
    <NodeViewWrapper
      ref={wrapRef}
      className={`hm-flow ${selected ? 'is-selected' : ''} ${editing ? 'is-editing' : ''} ${node.attrs.blockBg ? 'has-bg' : ''}`}
      data-block-id={node.attrs.blockId || undefined}
      style={isHex(node.attrs.blockBg) ? { '--block-bg': node.attrs.blockBg } : undefined}
    >
      {editing ? (
        <div
          className="hm-flow-editor"
          contentEditable={false}
          onBlur={(e) => {
            if (!busy.current && !wrapRef.current?.contains(e.relatedTarget)) setEditing(false);
          }}
        >
          <div className="hm-flow-bar">
            <span className="hm-flow-bar-label">
              <Workflow size={14} /> Flowchart
            </span>
            <div className="hm-flow-templates">
              {FLOWCHART_TEMPLATES.map((t) => (
                <button type="button" key={t.id} className="btn ghost sm" onMouseDown={keepOpen} onClick={() => applyTemplate(t)} title={`Start from: ${t.label}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="hm-flow-split">
            <textarea
              ref={inputRef}
              autoFocus
              className="hm-flow-input mono"
              value={code}
              rows={Math.min(22, Math.max(6, code.split('\n').length + 1))}
              placeholder={'flowchart TD\n    A[Start] --> B{Decision}\n    B -- Yes --> C[Do this]\n    B -- No --> D[Do that]'}
              spellCheck={false}
              onChange={(e) => updateAttributes({ code: e.target.value })}
              onKeyDown={onKeyDown}
            />
            <div className="hm-flow-preview" onMouseDown={keepOpen}>
              {code.trim() ? (
                <Diagram {...view} stale={!!view.error} />
              ) : (
                <div className="hm-flow-empty">Pick a template above, or type Mermaid syntax on the left.</div>
              )}
            </div>
          </div>
          <div className="hm-flow-actions">
            <span>
              <a href={SYNTAX_URL} target="_blank" rel="noreferrer" onMouseDown={keepOpen}>
                Mermaid syntax <ExternalLink size={11} />
              </a>{' '}
              · Ctrl/⌘ + Enter or Esc to finish
            </span>
            <button type="button" className="btn sm primary" onMouseDown={keepOpen} onClick={finish}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="hm-flow-render" contentEditable={false} onClick={() => editor.isEditable && setEditing(true)} title={editor.isEditable ? 'Click to edit' : undefined}>
          {code.trim() ? (
            <Diagram {...view} />
          ) : (
            <div className="hm-flow-empty">
              <Workflow size={15} /> Click to create a flowchart
            </div>
          )}
          {editor.isEditable && code.trim() && (
            <span className="hm-flow-edit-hint">
              <Pencil size={12} /> Edit
            </span>
          )}
        </div>
      )}
    </NodeViewWrapper>
  );
}
