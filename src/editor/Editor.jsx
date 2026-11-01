import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { buildExtensions } from './extensions';
import BubbleToolbar from './components/BubbleToolbar';
import TableToolbar from './components/TableToolbar';
import { useApp } from '../store/useApp';

/**
 * Block editor. Uncontrolled: `content` is only read on mount — remount with a `key` to load other content.
 * onChange(json) fires on every document change. onReady(editor) / onReady(null, editor) on mount / unmount.
 */
export default function Editor({ content, onChange, onReady, placeholder, className = '', autofocus = false, editable = true }) {
  const setActiveEditor = useApp((s) => s.setActiveEditor);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor(
    {
      extensions: buildExtensions({ placeholder }),
      content: content && typeof content === 'object' && content.type === 'doc' ? content : '',
      autofocus: autofocus ? 'end' : false,
      editable,
      editorProps: { attributes: { class: 'hm-prose', spellcheck: 'true' } },
      onUpdate: ({ editor: ed }) => onChangeRef.current && onChangeRef.current(ed.getJSON()),
      onFocus: ({ editor: ed }) => setActiveEditor(ed),
    },
    [],
  );

  useEffect(() => {
    if (!editor || !onReady) return undefined;
    onReady(editor);
    return () => onReady(null, editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return null;
  return (
    <div className={`hm-editor-shell ${className}`}>
      <BubbleToolbar editor={editor} />
      <TableToolbar editor={editor} />
      <EditorContent editor={editor} className="hm-editor" />
    </div>
  );
}
