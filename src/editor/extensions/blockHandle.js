import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, NodeSelection, TextSelection } from '@tiptap/pm/state';
import { DOMSerializer } from '@tiptap/pm/model';

const PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
const GRIP = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';

// Shared across editors so blocks can be dragged between the zones of a 4-zone note.
let activeDrag = null;

function topLevelBlock(view, el) {
  let cur = el;
  while (cur && cur.parentElement !== view.dom) cur = cur.parentElement;
  return cur && cur.parentElement === view.dom ? cur : null;
}

function posOfBlock(view, el) {
  let found = null;
  view.state.doc.forEach((_node, offset) => {
    if (found === null && view.nodeDOM(offset) === el) found = offset;
  });
  return found;
}

/** Notion-style "+" and "⋮⋮" handle shown left of the hovered top-level block. */
export const BlockHandle = Extension.create({
  name: 'blockHandle',

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey('hmBlockHandle'),
        props: {
          handleDrop(view) {
            // Dropped into a *different* editor: remove the block from its source editor (move instead of copy).
            if (activeDrag && activeDrag.view !== view) {
              const src = activeDrag;
              activeDrag = null;
              setTimeout(() => {
                try {
                  const node = src.view.state.doc.nodeAt(src.pos);
                  if (node && node.nodeSize === src.size) src.view.dispatch(src.view.state.tr.delete(src.pos, src.pos + src.size));
                } catch (e) {
                  console.warn(e);
                }
              }, 0);
            }
            return false;
          },
        },
        view: (view) => {
          const handle = document.createElement('div');
          handle.className = 'hm-handle';
          handle.innerHTML = `<button type="button" class="hm-handle-btn hm-handle-add" title="Add a block below">${PLUS}</button><div class="hm-handle-btn hm-handle-grip" draggable="true" title="Drag to move · Click for options">${GRIP}</div>`;
          const addBtn = handle.querySelector('.hm-handle-add');
          const grip = handle.querySelector('.hm-handle-grip');
          let current = null;
          let raf = 0;
          let dragging = false;

          const wrap = () => view.dom.parentElement;
          const hide = () => {
            handle.classList.remove('is-visible');
            current = null;
          };
          const show = (el, pos) => {
            const w = wrap();
            if (!w) return;
            if (handle.parentElement !== w) w.appendChild(handle);
            current = { el, pos };
            const wr = w.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            const cs = window.getComputedStyle(el);
            let lh = parseFloat(cs.lineHeight);
            if (Number.isNaN(lh)) lh = (parseFloat(cs.fontSize) || 16) * 1.5;
            const padTop = parseFloat(cs.paddingTop) || 0;
            const top = r.top - wr.top + padTop + Math.max(0, (Math.min(lh, r.height) - 24) / 2);
            handle.style.top = `${top}px`;
            handle.style.left = `${r.left - wr.left - 46}px`;
            handle.classList.add('is-visible');
          };

          const onMove = (e) => {
            if (dragging || !editor.isEditable) return;
            const w = wrap();
            if (!w) return;
            const target = e.target;
            if (handle.contains(target)) return;
            if (!(target instanceof Node) || !w.contains(target)) {
              if (current) hide();
              return;
            }
            const { clientX, clientY } = e;
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
              const dr = view.dom.getBoundingClientRect();
              if (clientY < dr.top || clientY > dr.bottom) return;
              const x = Math.min(Math.max(clientX, dr.left + 24), dr.right - 8);
              const hit = document.elementFromPoint(x, clientY);
              const block = hit && view.dom.contains(hit) ? topLevelBlock(view, hit) : null;
              if (!block || (current && current.el === block)) return;
              const pos = posOfBlock(view, block);
              if (pos === null) return;
              show(block, pos);
            });
          };

          const onKey = () => hide();

          addBtn.addEventListener('mousedown', (e) => e.preventDefault());
          addBtn.addEventListener('click', () => {
            if (!current) return;
            const { pos } = current;
            const { state } = view;
            const node = state.doc.nodeAt(pos);
            if (!node) return;
            const para = state.schema.nodes.paragraph;
            const tr = state.tr;
            if (node.type === para && node.content.size === 0) {
              tr.setSelection(TextSelection.create(tr.doc, pos + 1));
            } else {
              const after = pos + node.nodeSize;
              tr.insert(after, para.create());
              tr.setSelection(TextSelection.create(tr.doc, after + 1));
            }
            tr.insertText('\\');
            view.dispatch(tr.scrollIntoView());
            view.focus();
            hide();
          });

          grip.addEventListener('click', () => {
            if (!current) return;
            const rect = grip.getBoundingClientRect();
            window.dispatchEvent(new CustomEvent('hm:block-menu', { detail: { editor, pos: current.pos, rect } }));
          });

          grip.addEventListener('dragstart', (e) => {
            if (!current) {
              e.preventDefault();
              return;
            }
            const { pos, el } = current;
            const sel = NodeSelection.create(view.state.doc, pos);
            view.dispatch(view.state.tr.setSelection(sel));
            const slice = sel.content();
            const box = document.createElement('div');
            box.appendChild(DOMSerializer.fromSchema(view.state.schema).serializeFragment(slice.content));
            e.dataTransfer.clearData();
            e.dataTransfer.setData('text/html', box.innerHTML);
            e.dataTransfer.setData('text/plain', el.textContent || '');
            e.dataTransfer.effectAllowed = 'copyMove';
            try {
              e.dataTransfer.setDragImage(el, 0, 0);
            } catch (_) {
              /* ignore */
            }
            view.dragging = { slice, move: true };
            activeDrag = { view, pos, size: sel.node.nodeSize };
            dragging = true;
            document.body.classList.add('hm-dragging-block');
          });

          grip.addEventListener('dragend', () => {
            dragging = false;
            view.dragging = null;
            setTimeout(() => {
              activeDrag = null;
            }, 50);
            document.body.classList.remove('hm-dragging-block');
            hide();
          });

          document.addEventListener('mousemove', onMove);
          view.dom.addEventListener('keydown', onKey);

          return {
            update(v, prev) {
              if (!dragging && current && !v.state.doc.eq(prev.doc)) hide();
            },
            destroy() {
              cancelAnimationFrame(raf);
              document.removeEventListener('mousemove', onMove);
              view.dom.removeEventListener('keydown', onKey);
              handle.remove();
            },
          };
        },
      }),
    ];
  },
});
