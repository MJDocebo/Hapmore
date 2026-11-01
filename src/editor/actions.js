import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { noteHref } from '../lib/links';
import { useApp } from '../store/useApp';
import { getSignedUrl, uploadFile } from '../lib/storage';
import { shortId } from '../lib/utils';
import { COLOR_TYPES, BG_ONLY_TYPES } from './extensions/blockAttrs';

export async function insertImageFile(editor, file, pos) {
  const { toast, fail } = useApp.getState();
  if (!file || !file.type || !file.type.startsWith('image/')) {
    toast('Only image files can be added.', 'error');
    return;
  }
  toast('Uploading image…');
  try {
    const path = await uploadFile(file, 'images');
    await getSignedUrl(path);
    const content = { type: 'image', attrs: { path, alt: file.name || '' } };
    if (editor.isDestroyed) return;
    if (typeof pos === 'number') editor.chain().focus().insertContentAt(pos, content).run();
    else editor.chain().focus().insertContent(content).run();
  } catch (e) {
    fail(e, 'Image upload failed');
  }
}

export function nodeAt(editor, pos) {
  return editor.state.doc.nodeAt(pos);
}

function selectInside(editor, pos) {
  const { state, view } = editor;
  const sel = TextSelection.near(state.doc.resolve(Math.min(pos + 1, state.doc.content.size)));
  view.dispatch(state.tr.setSelection(sel));
}

export function deleteBlock(editor, pos) {
  const node = nodeAt(editor, pos);
  if (!node) return;
  const { state, view } = editor;
  view.dispatch(state.tr.delete(pos, pos + node.nodeSize));
  editor.commands.focus();
}

export function duplicateBlock(editor, pos) {
  const node = nodeAt(editor, pos);
  if (!node) return;
  const copy = node.type.create({ ...node.attrs, blockId: null }, node.content, node.marks);
  const { state, view } = editor;
  view.dispatch(state.tr.insert(pos + node.nodeSize, copy));
  editor.commands.focus();
}

export function moveBlockAt(editor, pos, dir) {
  editor.chain().focus().moveBlock(dir, pos).run();
}

export function turnInto(editor, pos, kind) {
  const node = nodeAt(editor, pos);
  if (!node) return;
  selectInside(editor, pos);
  const c = editor.chain().focus();
  // Unwrap list / quote / callout first so conversions behave predictably.
  const name = node.type.name;
  if (name === 'bulletList' && kind !== 'bullet') c.toggleBulletList();
  if (name === 'orderedList' && kind !== 'numbered') c.toggleOrderedList();
  if (name === 'taskList' && kind !== 'todo') c.toggleTaskList();
  if (name === 'blockquote' && kind !== 'quote') c.lift('blockquote');
  if (name === 'callout' && kind !== 'callout') c.lift('callout');
  switch (kind) {
    case 'text': c.setParagraph(); break;
    case 'h1': c.setNode('heading', { level: 1 }); break;
    case 'h2': c.setNode('heading', { level: 2 }); break;
    case 'h3': c.setNode('heading', { level: 3 }); break;
    case 'h4': c.setNode('heading', { level: 4 }); break;
    case 'bullet': if (name !== 'bulletList') c.setParagraph().toggleBulletList(); break;
    case 'numbered': if (name !== 'orderedList') c.setParagraph().toggleOrderedList(); break;
    case 'todo': if (name !== 'taskList') c.setParagraph().toggleTaskList(); break;
    case 'quote': if (name !== 'blockquote') c.setParagraph().setBlockquote(); break;
    case 'callout': if (name !== 'callout') c.setParagraph().setCallout(); break;
    case 'code': c.setCodeBlock({ language: 'plaintext' }); break;
    default: break;
  }
  c.run();
}

export function canColorBlock(node) {
  return !!node && (COLOR_TYPES.includes(node.type.name) || BG_ONLY_TYPES.includes(node.type.name) || node.type.name === 'callout');
}

/** Code and math blocks take a background color but keep their own text coloring. */
export function canColorBlockText(node) {
  return !!node && COLOR_TYPES.includes(node.type.name);
}

/** patch: { blockColor?, blockBg? } — callouts map background to their own color attribute. */
export function setBlockColors(editor, pos, patch) {
  const node = nodeAt(editor, pos);
  if (!node) return;
  const { state, view } = editor;
  let attrs = { ...node.attrs };
  if (node.type.name === 'callout') {
    if ('blockBg' in patch) attrs.color = patch.blockBg || '#787774';
  } else if (COLOR_TYPES.includes(node.type.name)) {
    attrs = { ...attrs, ...patch };
  } else if (BG_ONLY_TYPES.includes(node.type.name)) {
    if (!('blockBg' in patch)) return;
    attrs = { ...attrs, blockBg: patch.blockBg || null };
  } else return;
  view.dispatch(state.tr.setNodeMarkup(pos, undefined, attrs));
}

function ensureBlockId(editor, pos, node) {
  if (node.attrs.blockId) return node.attrs.blockId;
  const id = shortId();
  const { state, view } = editor;
  view.dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, blockId: id }));
  return id;
}

function emitAnnotate(editor, blockId, quote) {
  window.dispatchEvent(new CustomEvent('hm:annotate', { detail: { editor, blockId, quote: (quote || '').slice(0, 280) } }));
}

export function annotateBlock(editor, pos) {
  const node = nodeAt(editor, pos);
  if (!node || !('blockId' in node.attrs)) return;
  const id = ensureBlockId(editor, pos, node);
  emitAnnotate(editor, id, node.textContent || node.attrs.latex || node.type.name);
}

/** Annotate the innermost block around the current selection, quoting the selected text. */
export function annotateSelection(editor) {
  const { state } = editor;
  const sel = state.selection;
  let pos = null;
  let node = null;
  if (sel instanceof NodeSelection && 'blockId' in sel.node.attrs) {
    pos = sel.from;
    node = sel.node;
  } else {
    const { $from } = sel;
    for (let d = $from.depth; d > 0; d -= 1) {
      const n = $from.node(d);
      if (n.attrs && 'blockId' in n.attrs) {
        pos = $from.before(d);
        node = n;
        break;
      }
    }
  }
  if (node === null) {
    useApp.getState().toast('Place the cursor in a block first.', 'error');
    return;
  }
  const id = ensureBlockId(editor, pos, node);
  const quote = sel.empty ? node.textContent : state.doc.textBetween(sel.from, sel.to, ' ');
  emitAnnotate(editor, id, quote || node.attrs.latex || node.type.name);
}

export function openEmojiPickerAtCursor(editor) {
  const { from } = editor.state.selection;
  const c = editor.view.coordsAtPos(from);
  const rect = { left: c.left, right: c.right, top: c.top, bottom: c.bottom, width: 0, height: c.bottom - c.top };
  window.dispatchEvent(new CustomEvent('hm:emoji-picker', { detail: { editor, rect } }));
}

/** Opens the "Link to page" picker at the caret (handled by EditorOverlays). */
export function openPagePickerAtCursor(editor) {
  const { from } = editor.state.selection;
  const c = editor.view.coordsAtPos(from);
  const rect = { left: c.left, right: c.right, top: c.top, bottom: c.bottom, width: 0, height: c.bottom - c.top };
  window.dispatchEvent(new CustomEvent('hm:page-picker', { detail: { editor, rect } }));
}

/** Inserts "Title" linked to the note at the caret, followed by a plain space. */
export function insertPageLink(editor, note, opts) {
  if (!editor || editor.isDestroyed || !note) return;
  const href = noteHref(note.id, opts);
  const label = `${note.title || 'Untitled'}${opts && opts.page ? ` (p. ${opts.page})` : ''}`;
  editor
    .chain()
    .focus()
    .insertContent([{ type: 'text', text: label, marks: [{ type: 'link', attrs: { href, target: null } }] }])
    .unsetMark('link')
    .insertContent(' ')
    .run();
}

/** Scroll to a block by id (works across all zone editors on the page) and flash it. */
export function scrollToBlock(blockId) {
  if (!blockId) return false;
  const el = document.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('hm-flash');
  void el.offsetWidth;
  el.classList.add('hm-flash');
  setTimeout(() => el.classList.remove('hm-flash'), 1800);
  return true;
}
