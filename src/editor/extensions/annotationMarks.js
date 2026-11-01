import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const key = new PluginKey('hmAnnotationMarks');
const ICON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/></svg>';

/**
 * Marks blocks that have open annotations: a subtle class on the block plus a clickable icon in the
 * editor's right gutter (mirroring the "+ ⋮⋮" handle on the left). Clicking the icon dispatches
 * `hm:show-annotations` { editor, blockId } so the note page can open the panel on that annotation.
 */
export const AnnotationMarks = Extension.create({
  name: 'annotationMarks',

  addCommands() {
    return {
      /** ids: block ids with open annotations (repeat an id once per annotation to show a count). */
      setAnnotatedBlocks:
        (ids) =>
        ({ tr }) => {
          const counts = new Map();
          (ids || []).forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
          tr.setMeta(key, counts);
          tr.setMeta('addToHistory', false);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key,
        state: {
          init: () => new Map(),
          apply: (tr, value) => tr.getMeta(key) || value,
        },
        props: {
          decorations(state) {
            const counts = key.getState(state);
            if (!counts || !counts.size) return null;
            const decos = [];
            state.doc.descendants((node, pos) => {
              if (node.attrs && node.attrs.blockId && counts.has(node.attrs.blockId)) {
                decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'hm-annotated' }));
              }
              return true;
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
        view(view) {
          const layer = document.createElement('div');
          layer.className = 'hm-anno-gutter'; // absolutely positioned against the editor's right padding (see editor.css)
          layer.setAttribute('contenteditable', 'false');
          let raf = 0;

          const render = () => {
            raf = 0;
            const wrap = view.dom.parentElement;
            if (!wrap) return;
            if (layer.parentElement !== wrap) wrap.appendChild(layer);
            const counts = key.getState(view.state);
            const items = [];
            if (counts && counts.size) {
              const wr = wrap.getBoundingClientRect();
              const seen = new Set();
              view.state.doc.descendants((node, pos) => {
                const id = node.attrs && node.attrs.blockId;
                if (!id || !counts.has(id) || seen.has(id)) return true;
                const el = view.nodeDOM(pos);
                if (!(el instanceof HTMLElement) || !el.offsetParent) return true;
                seen.add(id);
                const r = el.getBoundingClientRect();
                const cs = window.getComputedStyle(el);
                let lh = parseFloat(cs.lineHeight);
                if (Number.isNaN(lh)) lh = (parseFloat(cs.fontSize) || 16) * 1.5;
                const padTop = parseFloat(cs.paddingTop) || 0;
                const top = r.top - wr.top + padTop + Math.max(0, (Math.min(lh, r.height) - 22) / 2);
                const prev = items[items.length - 1];
                // A nested annotated block on the same line as its parent shares one marker.
                if (prev && Math.abs(prev.top - top) < 6) prev.n += counts.get(id);
                else items.push({ id, top, n: counts.get(id) });
                return true;
              });
            }
            // Reuse buttons to avoid flicker.
            while (layer.children.length > items.length) layer.lastChild.remove();
            items.forEach((it, i) => {
              let b = layer.children[i];
              if (!b) {
                b = document.createElement('button');
                b.type = 'button';
                b.className = 'hm-anno-btn';
                b.addEventListener('mousedown', (e) => e.preventDefault());
                b.addEventListener('click', () => {
                  window.dispatchEvent(new CustomEvent('hm:show-annotations', { detail: { editor, blockId: b.dataset.blockId } }));
                });
                layer.appendChild(b);
              }
              b.dataset.blockId = it.id;
              b.title = it.n > 1 ? `${it.n} open annotations — click to view` : 'Open annotation — click to view';
              b.innerHTML = `${ICON}${it.n > 1 ? `<span>${it.n}</span>` : ''}`;
              b.style.top = `${it.top}px`; // horizontal position is pure CSS: centered in the right-hand gutter
            });
          };
          const schedule = () => {
            if (!raf) raf = requestAnimationFrame(render);
          };

          const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
          if (ro) ro.observe(view.dom);
          window.addEventListener('resize', schedule);
          schedule();

          return {
            update: schedule,
            destroy() {
              cancelAnimationFrame(raf);
              if (ro) ro.disconnect();
              window.removeEventListener('resize', schedule);
              layer.remove();
            },
          };
        },
      }),
    ];
  },
});
