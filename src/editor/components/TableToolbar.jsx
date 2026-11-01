import { useCallback } from 'react';
import { BubbleMenu } from '@tiptap/react';

const keep = (e) => e.preventDefault();

export default function TableToolbar({ editor }) {
  const shouldShow = useCallback(({ editor: ed, state }) => {
    if (!ed.isEditable || !ed.isActive('table')) return false;
    return state.selection.empty || '$anchorCell' in state.selection;
  }, []);

  const getRect = useCallback(() => {
    const { view, state } = editor;
    try {
      const { node } = view.domAtPos(state.selection.from);
      const el = node.nodeType === 1 ? node : node.parentElement;
      const table = el && el.closest('table');
      if (table) return table.getBoundingClientRect();
    } catch (_) {
      /* fall through */
    }
    return view.dom.getBoundingClientRect();
  }, [editor]);

  const c = () => editor.chain().focus();
  const B = ({ onClick, children, title, danger }) => (
    <button type="button" className={`hm-tbtn ${danger ? 'is-danger' : ''}`} title={title} onMouseDown={keep} onClick={onClick}>
      {children}
    </button>
  );

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="hmTableMenu"
      shouldShow={shouldShow}
      tippyOptions={{ duration: 100, placement: 'top-start', maxWidth: 'none', zIndex: 55, getReferenceClientRect: getRect }}
      className="hm-bubble hm-table-bubble"
    >
      <div className="hm-bubble-row">
        <B title="Insert row above" onClick={() => c().addRowBefore().run()}>+ Row ↑</B>
        <B title="Insert row below" onClick={() => c().addRowAfter().run()}>+ Row ↓</B>
        <B title="Insert column left" onClick={() => c().addColumnBefore().run()}>+ Col ←</B>
        <B title="Insert column right" onClick={() => c().addColumnAfter().run()}>+ Col →</B>
        <span className="hm-bsep" />
        <B title="Toggle header row" onClick={() => c().toggleHeaderRow().run()}>Header</B>
        <B title="Merge or split cells" onClick={() => c().mergeOrSplit().run()}>Merge/Split</B>
        <span className="hm-bsep" />
        <B title="Delete row" onClick={() => c().deleteRow().run()} danger>− Row</B>
        <B title="Delete column" onClick={() => c().deleteColumn().run()} danger>− Col</B>
        <B title="Delete table" onClick={() => c().deleteTable().run()} danger>Delete</B>
      </div>
    </BubbleMenu>
  );
}
