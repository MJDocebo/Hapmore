import { useLayoutEffect, useRef, useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { CODE_LANGUAGES } from '../languages';
import { Check, Copy, WrapText } from '../../components/icons';
import { isHex } from '../../lib/utils';
import { useApp } from '../../store/useApp';

// Per-block wrap choice for this session only (keyed by block id so it survives the node view being re-created,
// e.g. after dragging the block). New blocks wrap by default.
const wrapPrefs = new Map();

/**
 * Visual row (0-based) at which each logical line starts. A wrapped line spans several rows but gets one number,
 * so numbers are positioned at their line's first row rather than stacked one per row.
 * Each line's first character (or its "\n" when the line is empty) is measured and snapped to the line-height grid,
 * using its vertical center so differences between glyph boxes and line boxes don't matter.
 */
function measureLineRows(code) {
  const lh = parseFloat(getComputedStyle(code).lineHeight);
  if (!lh) return null;
  const box = code.getBoundingClientRect();
  const totalRows = Math.max(1, Math.round(box.height / lh));
  const rowAt = (r) => Math.max(0, Math.round((r.top + r.height / 2 - box.top - lh / 2) / lh));
  const range = document.createRange();
  const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  const rows = [];
  let atStart = true;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const s = n.data;
    for (let i = 0; i < s.length; i++) {
      if (atStart) {
        range.setStart(n, i);
        range.setEnd(n, i + 1);
        const r = range.getClientRects()[0] || range.getBoundingClientRect();
        rows.push(Math.max(rowAt(r), rows.length ? rows[rows.length - 1] + 1 : 0));
        atStart = false;
      }
      if (s.charCodeAt(i) === 10) atStart = true;
    }
  }
  // Empty block, or an empty last line after a trailing "\n" (no character to measure): it's the last visual row.
  if (atStart) rows.push(Math.max(rows.length ? rows[rows.length - 1] + 1 : 0, totalRows - 1));
  return { rows, lh, totalRows: Math.max(totalRows, rows[rows.length - 1] + 1) };
}

const sameLayout = (a, b) => a && b && a.lh === b.lh && a.totalRows === b.totalRows && a.rows.length === b.rows.length && a.rows.every((v, i) => v === b.rows[i]);

function useLineLayout(enabled, preRef, deps) {
  const [layout, setLayout] = useState(null);
  useLayoutEffect(() => {
    const pre = preRef.current;
    if (!enabled || !pre) return undefined;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const code = pre.querySelector('code');
      const next = code ? measureLineRows(code) : null;
      setLayout((prev) => (sameLayout(prev, next) ? prev : next));
    };
    measure();
    // Re-measure when the text re-wraps: width changes, font loads, size / line-height settings, wrap toggle.
    const ro = new ResizeObserver(() => {
      if (!raf) raf = requestAnimationFrame(measure);
    });
    ro.observe(pre);
    const code = pre.querySelector('code');
    if (code) ro.observe(code);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
  return enabled ? layout : null;
}

export default function CodeBlockView({ node, updateAttributes, editor }) {
  const lang = node.attrs.language || 'plaintext';
  const blockId = node.attrs.blockId;
  const [copied, setCopied] = useState(false);
  const [wrap, setWrapState] = useState(() => (blockId && wrapPrefs.has(blockId) ? wrapPrefs.get(blockId) : true));
  const preRef = useRef(null);
  const known = CODE_LANGUAGES.some(([v]) => v === lang);
  const lineNumbers = useApp((s) => !!s.settings.codeStyle?.lineNumbers);
  const text = node.textContent;
  const lineCount = lineNumbers ? text.split('\n').length : 0;
  const layout = useLineLayout(lineNumbers, preRef, [text, wrap]);
  const measured = layout && layout.rows.length === lineCount;

  const setWrap = (next) => {
    setWrapState(next);
    if (blockId) wrapPrefs.set(blockId, next);
  };

  // Clicking the toggle shouldn't move the cursor out of the code.
  const keepCursor = (e) => e.preventDefault();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (_) {
      /* clipboard blocked */
    }
  };

  return (
    <NodeViewWrapper
      className={`hm-code ${node.attrs.blockBg ? 'has-bg' : ''} ${wrap ? 'is-wrapped' : 'is-nowrap'}`}
      data-block-id={blockId || undefined}
      style={isHex(node.attrs.blockBg) ? { '--block-bg': node.attrs.blockBg } : undefined}
    >
      <div className="hm-code-bar" contentEditable={false}>
        <select className="hm-code-lang" value={lang} disabled={!editor.isEditable} onChange={(e) => updateAttributes({ language: e.target.value })}>
          {!known && <option value={lang}>{lang}</option>}
          {CODE_LANGUAGES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <div className="hm-code-actions">
          <button
            type="button"
            className={`hm-code-copy hm-code-wrap ${wrap ? 'is-on' : ''}`}
            onMouseDown={keepCursor}
            onClick={() => setWrap(!wrap)}
            aria-pressed={wrap}
            title={wrap ? 'Text wrapping is on: click to turn off' : 'Text wrapping is off: click to turn on'}
          >
            <WrapText size={13} />
            <span>Wrap</span>
          </button>
          <button type="button" className="hm-code-copy" onClick={copy} title="Copy code">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
      <div className={`hm-code-body ${lineNumbers ? 'has-lines' : ''}`}>
        {lineNumbers && (
          <div
            className={`hm-code-lines ${measured ? 'is-measured' : ''}`}
            contentEditable={false}
            aria-hidden="true"
            style={{ '--ln-digits': String(lineCount).length }}
          >
            {measured ? (
              <div className="hm-code-lines-inner" style={{ height: layout.totalRows * layout.lh }}>
                {layout.rows.map((row, i) => (
                  <span key={i} style={{ top: row * layout.lh }}>
                    {i + 1}
                  </span>
                ))}
              </div>
            ) : (
              Array.from({ length: lineCount }, (_, i) => <span key={i}>{i + 1}</span>)
            )}
          </div>
        )}
        <pre ref={preRef} spellCheck={false}>
          {/* Tiptap puts white-space: pre-wrap inline on this element; override it when wrapping is off. */}
          <NodeViewContent as="code" className={`hljs language-${lang}`} style={{ whiteSpace: wrap ? 'pre-wrap' : 'pre' }} />
        </pre>
      </div>
    </NodeViewWrapper>
  );
}
