import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection, NodeSelection } from '@tiptap/pm/state';
import { shortId, bgTint } from '../../lib/utils';
import { parseNoteHref, navigateTo, noteTitle } from '../../lib/links';
import { openInTab } from '../../lib/tabs';

/** Block types that receive a stable `blockId` (used to link annotations to blocks). */
export const ID_TYPES = [
  'paragraph', 'heading', 'blockquote', 'codeBlock', 'bulletList', 'orderedList', 'taskList',
  'callout', 'mathBlock', 'flowchart', 'table', 'image', 'horizontalRule',
];
/** Block types that support a text color / background color. */
export const COLOR_TYPES = ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'taskList'];
/** Block types that support a background color only (their node views apply it; text keeps syntax/KaTeX colors). */
export const BG_ONLY_TYPES = ['codeBlock', 'mathBlock', 'flowchart'];

const idsKey = new PluginKey('hmBlockIds');

function swapWithSibling(state, dispatch, pos, dir) {
  const doc = state.doc;
  const $pos = doc.resolve(pos);
  if ($pos.depth !== 0) return false;
  const index = $pos.index(0);
  const target = dir === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= doc.childCount) return false;
  if (!dispatch) return true;
  const node = doc.child(index);
  const other = doc.child(target);
  const wasNodeSel = state.selection instanceof NodeSelection;
  const offsetInNode = Math.max(0, state.selection.from - pos);
  const tr = state.tr;
  let newPos;
  if (dir === 'up') {
    const otherFrom = pos - other.nodeSize;
    tr.replaceWith(otherFrom, pos + node.nodeSize, [node, other]);
    newPos = otherFrom;
  } else {
    tr.replaceWith(pos, pos + node.nodeSize + other.nodeSize, [other, node]);
    newPos = pos + other.nodeSize;
  }
  if (wasNodeSel) tr.setSelection(NodeSelection.create(tr.doc, newPos));
  else tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(newPos + offsetInNode, tr.doc.content.size))));
  dispatch(tr.scrollIntoView());
  return true;
}

export const BlockAttrs = Extension.create({
  name: 'blockAttrs',

  addGlobalAttributes() {
    return [
      {
        types: ID_TYPES,
        attributes: {
          blockId: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) => el.getAttribute('data-block-id'),
            renderHTML: (a) => (a.blockId ? { 'data-block-id': a.blockId } : {}),
          },
        },
      },
      {
        types: COLOR_TYPES,
        attributes: {
          blockColor: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) => el.getAttribute('data-color'),
            renderHTML: (a) => (a.blockColor ? { 'data-color': a.blockColor, style: `color: ${a.blockColor}` } : {}),
          },
          blockBg: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) => el.getAttribute('data-bg'),
            renderHTML: (a) =>
              a.blockBg ? { 'data-bg': a.blockBg, class: 'hm-block-bg', style: `background-color: ${bgTint(a.blockBg, 16)}` } : {},
          },
        },
      },
      {
        types: BG_ONLY_TYPES,
        attributes: {
          blockBg: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) => el.getAttribute('data-bg'),
            renderHTML: (a) => (a.blockBg ? { 'data-bg': a.blockBg } : {}),
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      /** Move the top-level block containing the selection (or at `pos`) up/down. */
      moveBlock:
        (dir, pos) =>
        ({ state, dispatch }) => {
          let p = pos;
          if (typeof p !== 'number') {
            const { $from } = state.selection;
            p = $from.depth === 0 ? state.selection.from : $from.before(1);
          }
          return swapWithSibling(state, dispatch, p, dir);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Alt-Shift-ArrowUp': () => this.editor.commands.moveBlock('up'),
      'Alt-Shift-ArrowDown': () => this.editor.commands.moveBlock('down'),
      'Mod-Shift-ArrowUp': () => this.editor.commands.moveBlock('up'),
      'Mod-Shift-ArrowDown': () => this.editor.commands.moveBlock('down'),
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: idsKey,
        appendTransaction: (transactions, _old, newState) => {
          if (!transactions.some((tr) => tr.docChanged || tr.getMeta(idsKey))) return null;
          const seen = new Set();
          const tr = newState.tr;
          let changed = false;
          newState.doc.descendants((node, pos) => {
            if (!ID_TYPES.includes(node.type.name)) return true;
            const id = node.attrs.blockId;
            if (!id || seen.has(id)) {
              const fresh = shortId();
              seen.add(fresh);
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, blockId: fresh });
              changed = true;
            } else {
              seen.add(id);
            }
            return true;
          });
          if (!changed) return null;
          tr.setMeta('addToHistory', false);
          return tr;
        },
      }),
    ];
  },

  onCreate() {
    const { view, state } = this.editor;
    view.dispatch(state.tr.setMeta(idsKey, true).setMeta('addToHistory', false));
  },
});

/** Keeps an empty paragraph at the end of the document so you can always click below the last block. */
export const TrailingNode = Extension.create({
  name: 'trailingNode',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('hmTrailingNode'),
        appendTransaction: (_trs, _old, state) => {
          const last = state.doc.lastChild;
          if (last && last.type.name === 'paragraph') return null;
          const tr = state.tr.insert(state.doc.content.size, state.schema.nodes.paragraph.create());
          tr.setMeta('addToHistory', false);
          return tr;
        },
      }),
    ];
  },
});

/**
 * Link behavior while editing:
 *  - Internal page links ("/n/<id>") open in the app on a plain click (Ctrl/⌘-click → new tab).
 *  - Other links open in a new tab with Ctrl/⌘ + click (a plain click just places the caret).
 *  - Pasting a str(notes) page link with nothing selected inserts the page title, linked.
 */
export const LinkOpener = Extension.create({
  name: 'linkOpener',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('hmLinkOpener'),
        props: {
          handleClick(_view, _pos, event) {
            if (event.button !== 0) return false;
            const a = event.target instanceof Element ? event.target.closest('a[href]') : null;
            if (!a) return false;
            const href = a.getAttribute('href');
            const internal = parseNoteHref(href);
            const modified = event.metaKey || event.ctrlKey;
            if (internal) {
              event.preventDefault();
              if (modified) openInTab(internal.href); // in-app tab
              else navigateTo(internal.href);
              return true;
            }
            if (!modified) return false;
            window.open(href, '_blank', 'noopener,noreferrer');
            return true;
          },
          handlePaste(view, event) {
            const text = event.clipboardData && event.clipboardData.getData('text/plain');
            if (!text || /\s/.test(text.trim())) return false;
            const internal = parseNoteHref(text.trim());
            if (!internal) return false;
            const { state } = view;
            const linkType = state.schema.marks.link;
            if (!linkType) return false;
            const { from, to, empty, $from } = state.selection;
            if ($from.parent.type.spec.code) return false; // inside a code block: paste the raw URL
            if (!empty) {
              // Selected text → turn it into a page link (relative href, no new tab)
              view.dispatch(state.tr.addMark(from, to, linkType.create({ href: internal.href, target: null })));
              return true;
            }
            const title = noteTitle(internal.id) || 'Untitled page';
            const label = internal.page ? `${title} (p. ${internal.page})` : title;
            const tr = state.tr.replaceSelectionWith(state.schema.text(label, [linkType.create({ href: internal.href, target: null })]), false);
            tr.removeStoredMark(linkType);
            view.dispatch(tr.insertText(' '));
            return true;
          },
        },
      }),
    ];
  },
});
