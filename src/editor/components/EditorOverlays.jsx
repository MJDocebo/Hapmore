import { useEffect, useState, useReducer } from 'react';
import Popover from '../../components/Popover';
import ColorPicker from '../../components/ColorPicker';
import EmojiPicker from '../../components/EmojiPicker';
import { PagePickerPopover } from '../../components/PagePicker';
import { useApp } from '../../store/useApp';
import {
  annotateBlock, canColorBlock, canColorBlockText, deleteBlock, duplicateBlock, insertPageLink, moveBlockAt, setBlockColors, turnInto,
} from '../actions';
import {
  Type, Heading1, Heading2, Heading3, Heading4, List, ListOrdered, ListChecks, Quote, Lightbulb,
  SquareCode, MessageSquarePlus, Copy, ArrowUp, ArrowDown, Trash,
} from '../../components/icons';

const TURN_INTO = [
  { id: 'text', label: 'Text', Icon: Type },
  { id: 'h1', label: 'Heading 1', Icon: Heading1 },
  { id: 'h2', label: 'Heading 2', Icon: Heading2 },
  { id: 'h3', label: 'Heading 3', Icon: Heading3 },
  { id: 'h4', label: 'Heading 4', Icon: Heading4 },
  { id: 'bullet', label: 'Bulleted list', Icon: List },
  { id: 'numbered', label: 'Numbered list', Icon: ListOrdered },
  { id: 'todo', label: 'To-do list', Icon: ListChecks },
  { id: 'quote', label: 'Quote', Icon: Quote },
  { id: 'callout', label: 'Callout', Icon: Lightbulb },
  { id: 'code', label: 'Code', Icon: SquareCode },
];

const NAMES = {
  paragraph: 'Text', heading: 'Heading', bulletList: 'Bulleted list', orderedList: 'Numbered list',
  taskList: 'To-do list', blockquote: 'Quote', callout: 'Callout', codeBlock: 'Code block',
  mathBlock: 'Math block', flowchart: 'Flowchart', table: 'Table', image: 'Image', horizontalRule: 'Divider',
};
const TEXTUAL = ['paragraph', 'heading', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'callout', 'codeBlock'];

function BlockMenu({ detail, onClose }) {
  const { editor, pos, rect } = detail;
  const presets = useApp((s) => s.settings.colorPresets);
  const [, refresh] = useReducer((x) => x + 1, 0);
  if (editor.isDestroyed) return null;
  const node = editor.state.doc.nodeAt(pos);
  if (!node) return null;
  const name = node.type.name;
  const isCallout = name === 'callout';
  const act = (fn) => () => {
    fn();
    onClose();
  };

  return (
    <Popover anchor={rect} onClose={onClose} keepFocus className="hm-blockmenu" placement="bottom-start">
      <div className="hm-menu-label">{NAMES[name] || name}</div>
      {TEXTUAL.includes(name) && (
        <>
          <div className="hm-menu-sub">Turn into</div>
          <div className="hm-turninto">
            {TURN_INTO.map(({ id, label, Icon }) => (
              <button type="button" key={id} title={label} onClick={act(() => turnInto(editor, pos, id))}>
                <Icon size={15} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {canColorBlock(node) && (
        <>
          <div className="hm-menu-sep" />
          {canColorBlockText(node) && (
            <ColorPicker
              compact
              label="Text color"
              value={node.attrs.blockColor}
              presets={presets}
              onChange={(c) => {
                setBlockColors(editor, pos, { blockColor: c });
                refresh();
              }}
              onDone={onClose}
              doneOnSwatch={false}
            />
          )}
          <ColorPicker
            compact
            label={isCallout ? 'Callout color' : 'Background'}
            value={isCallout ? node.attrs.color : node.attrs.blockBg}
            presets={presets}
            allowNone={!isCallout}
            onChange={(c) => {
              setBlockColors(editor, pos, { blockBg: c });
              refresh();
            }}
            onDone={onClose}
            doneOnSwatch={false}
          />
        </>
      )}
      <div className="hm-menu-sep" />
      {'blockId' in node.attrs && (
        <button type="button" className="hm-menu-item" onClick={act(() => annotateBlock(editor, pos))}>
          <MessageSquarePlus size={15} /> Add annotation
        </button>
      )}
      <button type="button" className="hm-menu-item" onClick={act(() => duplicateBlock(editor, pos))}>
        <Copy size={15} /> Duplicate
      </button>
      <button type="button" className="hm-menu-item" onClick={act(() => moveBlockAt(editor, pos, 'up'))}>
        <ArrowUp size={15} /> Move up <kbd>Alt+Shift+↑</kbd>
      </button>
      <button type="button" className="hm-menu-item" onClick={act(() => moveBlockAt(editor, pos, 'down'))}>
        <ArrowDown size={15} /> Move down <kbd>Alt+Shift+↓</kbd>
      </button>
      <button type="button" className="hm-menu-item is-danger" onClick={act(() => deleteBlock(editor, pos))}>
        <Trash size={15} /> Delete
      </button>
    </Popover>
  );
}

/** Mounted once in the layout: block menu (from the drag handle), the caret emoji picker and the page-link picker. */
export default function EditorOverlays() {
  const [menu, setMenu] = useState(null);
  const [picker, setPicker] = useState(null);
  const [pagePicker, setPagePicker] = useState(null);

  useEffect(() => {
    const onMenu = (e) => setMenu(e.detail);
    const onPicker = (e) => setPicker(e.detail);
    window.addEventListener('hm:block-menu', onMenu);
    const onPagePicker = (e) => setPagePicker(e.detail);
    window.addEventListener('hm:emoji-picker', onPicker);
    window.addEventListener('hm:page-picker', onPagePicker);
    return () => {
      window.removeEventListener('hm:page-picker', onPagePicker);
      window.removeEventListener('hm:block-menu', onMenu);
      window.removeEventListener('hm:emoji-picker', onPicker);
    };
  }, []);

  return (
    <>
      {menu && <BlockMenu key={`${menu.pos}-${menu.rect.top}`} detail={menu} onClose={() => setMenu(null)} />}
      {pagePicker && (
        <PagePickerPopover
          anchor={pagePicker.rect}
          onClose={() => {
            setPagePicker(null);
            if (!pagePicker.editor.isDestroyed) pagePicker.editor.commands.focus();
          }}
          onPick={(note) => {
            setPagePicker(null);
            insertPageLink(pagePicker.editor, note);
          }}
        />
      )}
      {picker && (
        <EmojiPicker
          anchor={picker.rect}
          onClose={() => setPicker(null)}
          onSelect={(value, custom) => {
            const ed = picker.editor;
            if (ed.isDestroyed) return;
            if (custom) ed.chain().focus().insertContent({ type: 'customEmoji', attrs: { id: custom.id, name: custom.name } }).run();
            else ed.chain().focus().insertContent(value).run();
          }}
        />
      )}
    </>
  );
}
