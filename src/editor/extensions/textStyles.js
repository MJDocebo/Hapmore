import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { cssId, bgTint } from '../../lib/utils';
import { useApp } from '../../store/useApp';
import { matchWrapper } from '../../lib/wrapMatch';

const wrapKey = new PluginKey('hmStyleWrappers');

/** Active wrapper definitions, longest closing sequence first (so "!!" wins over "!"). */
function activeWrappers() {
  const styles = useApp.getState().settings.customStyles || [];
  return styles
    .filter((st) => st.wrapOpen)
    .map((st) => ({ id: st.id, open: st.wrapOpen, close: st.wrapClose || st.wrapOpen }))
    .sort((a, b) => b.close.length - a.close.length || b.open.length - a.open.length);
}

/**
 * Typing  <open>text<close>  applies the custom style to "text" and removes the wrapper characters.
 * Runs on text input only (not paste), skips code and is undoable with Ctrl/⌘+Z.
 */
function wrapperPlugin(editor) {
  return new Plugin({
    key: wrapKey,
    props: {
      handleTextInput(view, from, to, text) {
        if (from !== to || !text || view.composing) return false;
        const wrappers = activeWrappers();
        if (!wrappers.length) return false;
        const { state } = view;
        const $from = state.doc.resolve(from);
        const parent = $from.parent;
        if (parent.type.spec.code || !parent.isTextblock) return false;
        if ($from.marks().some((m) => m.type.name === 'code')) return false;

        // Text before the cursor in this block; inline atoms (math, emoji, breaks) become one \ufffc so
        // string offsets map 1:1 to document positions (node.textBetween would expand them via renderText).
        let before = '';
        parent.forEach((child, offset) => {
          if (offset >= $from.parentOffset) return;
          if (child.isText) before += child.text.slice(0, $from.parentOffset - offset);
          else before += '\ufffc';
        });
        if (before.length > 400) before = before.slice(-400);
        const base = from - before.length; // doc position of before[0]

        const hit = matchWrapper(before, text, wrappers);
        if (hit) {
          const w = hit.wrapper;
          const openFrom = base + hit.openAt;
          const innerFrom = base + hit.innerAt;
          const closeFrom = base + hit.closeAt; // the part of the closing sequence already in the doc starts here
          const tsType = state.schema.marks.textStyle;
          if (!tsType) return false;

          const tr = state.tr;
          tr.delete(closeFrom, from); // already-typed part of the closing sequence (typed char is never inserted)
          // Apply the style per text node so existing colors etc. on the textStyle mark survive.
          tr.doc.nodesBetween(innerFrom, closeFrom, (node, pos) => {
            if (!node.isText) return;
            const a = Math.max(pos, innerFrom);
            const b = Math.min(pos + node.nodeSize, closeFrom);
            const existing = node.marks.find((m) => m.type === tsType);
            tr.addMark(a, b, tsType.create({ ...(existing ? existing.attrs : {}), styleId: w.id }));
          });
          tr.delete(openFrom, innerFrom);
          // Continue typing with whatever marks were active before the wrapped text (e.g. a text color).
          tr.setStoredMarks(state.doc.resolve(openFrom).marks());
          view.dispatch(tr.scrollIntoView());
          return true;
        }
        return false;
      },
    },
  });
}

/** Background (highlight) color for text, stored on the textStyle mark. */
export const TextBackground = Extension.create({
  name: 'textBackground',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          backgroundColor: {
            default: null,
            parseHTML: (el) => el.getAttribute('data-bg'),
            renderHTML: (a) =>
              a.backgroundColor
                ? {
                    'data-bg': a.backgroundColor,
                    style: `background-color: ${bgTint(a.backgroundColor, 30)}; border-radius: 3px; padding: 0 2px`,
                  }
                : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setTextBackground:
        (color) =>
        ({ chain }) =>
          chain().setMark('textStyle', { backgroundColor: color }).run(),
      unsetTextBackground:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { backgroundColor: null }).removeEmptyTextStyle().run(),
    };
  },
});

/** User-defined named text styles (Settings → Typography → Custom styles). CSS is generated at runtime. */
export const CustomStyle = Extension.create({
  name: 'customStyle',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          styleId: {
            default: null,
            parseHTML: (el) => el.getAttribute('data-style-id'),
            renderHTML: (a) =>
              a.styleId ? { 'data-style-id': a.styleId, class: `hm-cs hm-cs-${cssId(a.styleId)}`, style: '--hm-cs: 1' } : {},
          },
        },
      },
    ];
  },
  addProseMirrorPlugins() {
    return [wrapperPlugin(this.editor)];
  },

  addCommands() {
    return {
      setCustomStyle:
        (styleId) =>
        ({ chain }) =>
          chain().setMark('textStyle', { styleId }).run(),
      unsetCustomStyle:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { styleId: null }).removeEmptyTextStyle().run(),
    };
  },
});
