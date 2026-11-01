import { useMemo, useRef, useState, useEffect } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import katex from 'katex';
import Popover from '../../components/Popover';
import { isHex } from '../../lib/utils';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function renderKatex(latex, displayMode) {
  try {
    return katex.renderToString(latex || '', { displayMode, throwOnError: false, strict: 'ignore', trust: false, output: 'htmlAndMathml' });
  } catch (e) {
    return `<span class="hm-math-error">${escapeHtml(e.message)}</span>`;
  }
}

export function focusAfter(editor, pos) {
  if (editor.isDestroyed || typeof pos !== 'number') return;
  const { state, view } = editor;
  const p = Math.min(pos, state.doc.content.size);
  view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(p))));
  view.focus();
}

export function InlineMathView({ node, updateAttributes, deleteNode, editor, getPos, selected }) {
  const [editing, setEditing] = useState(() => !node.attrs.latex && editor.isEditable);
  const [draft, setDraft] = useState(node.attrs.latex || '');
  const [anchorEl, setAnchorEl] = useState(null);
  const done = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(node.attrs.latex || '');
  }, [node.attrs.latex, editing]);

  const html = useMemo(() => renderKatex(editing ? draft : node.attrs.latex, false), [editing, draft, node.attrs.latex]);

  const open = () => {
    if (!editor.isEditable) return;
    done.current = false;
    setDraft(node.attrs.latex || '');
    setEditing(true);
  };

  const commit = () => {
    if (done.current) return;
    done.current = true;
    setEditing(false);
    const v = draft.trim();
    const pos = getPos();
    if (!v) {
      deleteNode();
      focusAfter(editor, pos);
      return;
    }
    if (v !== node.attrs.latex) updateAttributes({ latex: v });
    requestAnimationFrame(() => focusAfter(editor, (typeof pos === 'number' ? pos : 0) + 1));
  };

  const cancel = () => {
    if (done.current) return;
    done.current = true;
    setEditing(false);
    if (!node.attrs.latex) deleteNode();
    editor.commands.focus();
  };

  const showEmpty = editing ? !draft : !node.attrs.latex;
  return (
    <NodeViewWrapper as="span" className={`hm-imath ${selected ? 'is-selected' : ''} ${editing ? 'is-editing' : ''}`}>
      <span
        ref={setAnchorEl}
        className="hm-imath-render"
        onClick={open}
        title={node.attrs.latex ? 'Click to edit formula' : ''}
        dangerouslySetInnerHTML={{ __html: showEmpty ? '<span class="hm-math-empty">formula</span>' : html }}
      />
      {editing && anchorEl && (
        <Popover anchor={anchorEl} onClose={commit} closeOnEscape={false} className="hm-imath-popover">
          <input
            autoFocus
            className="input mono"
            value={draft}
            placeholder="E = mc^2"
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
          />
          <div className="hm-imath-hint">Enter to save · Esc to cancel</div>
        </Popover>
      )}
    </NodeViewWrapper>
  );
}

export function MathBlockView({ node, updateAttributes, editor, getPos, selected }) {
  const [editing, setEditing] = useState(() => !node.attrs.latex && editor.isEditable);
  const latex = node.attrs.latex || '';
  const html = useMemo(() => renderKatex(latex, true), [latex]);

  const finish = () => {
    setEditing(false);
    const pos = getPos();
    if (typeof pos === 'number') requestAnimationFrame(() => focusAfter(editor, pos + node.nodeSize));
  };

  return (
    <NodeViewWrapper
      className={`hm-mathblock ${selected ? 'is-selected' : ''} ${node.attrs.blockBg ? 'has-bg' : ''}`}
      data-block-id={node.attrs.blockId || undefined}
      style={isHex(node.attrs.blockBg) ? { '--block-bg': node.attrs.blockBg } : undefined}
    >
      {editing ? (
        <div className="hm-mathblock-editor" contentEditable={false}>
          <textarea
            autoFocus
            className="hm-mathblock-input mono"
            value={latex}
            rows={Math.max(2, latex.split('\n').length)}
            placeholder={'\\int_0^1 x^2 \\, dx = \\frac{1}{3}'}
            spellCheck={false}
            onChange={(e) => updateAttributes({ latex: e.target.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) || e.key === 'Escape') {
                e.preventDefault();
                finish();
              }
            }}
          />
          <div className="hm-mathblock-preview" dangerouslySetInnerHTML={{ __html: latex ? html : '<span class="hm-math-empty">Preview</span>' }} />
          <div className="hm-mathblock-actions">
            <span>Ctrl/⌘ + Enter or Esc to finish</span>
            <button type="button" className="btn sm primary" onMouseDown={(e) => e.preventDefault()} onClick={finish}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <div
          className="hm-mathblock-render"
          contentEditable={false}
          onClick={() => editor.isEditable && setEditing(true)}
          dangerouslySetInnerHTML={{ __html: latex ? html : '<span class="hm-math-empty">Σ  Click to add a TeX equation</span>' }}
        />
      )}
    </NodeViewWrapper>
  );
}
