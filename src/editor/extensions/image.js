import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ImageView from '../components/ImageView';
import { insertImageFile } from '../actions';

export const ImageBlock = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      path: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-path'),
        renderHTML: (a) => (a.path ? { 'data-path': a.path } : {}),
      },
      alt: { default: '' },
      caption: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-caption') || '',
        renderHTML: (a) => (a.caption ? { 'data-caption': a.caption } : {}),
      },
      width: {
        default: 100,
        parseHTML: (el) => Number(el.getAttribute('data-width')) || 100,
        renderHTML: (a) => ({ 'data-width': a.width }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'img[data-path]' }, { tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const images = (list) => Array.from(list || []).filter((f) => f.type && f.type.startsWith('image/'));
    return [
      new Plugin({
        key: new PluginKey('hmImageUpload'),
        props: {
          handlePaste(_view, event) {
            const files = images(event.clipboardData && event.clipboardData.files);
            if (!files.length) return false;
            event.preventDefault();
            files.forEach((f) => insertImageFile(editor, f));
            return true;
          },
          handleDrop(view, event, _slice, moved) {
            if (moved) return false;
            const files = images(event.dataTransfer && event.dataTransfer.files);
            if (!files.length) return false;
            event.preventDefault();
            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
            files.forEach((f) => insertImageFile(editor, f, coords ? coords.pos : undefined));
            return true;
          },
        },
      }),
    ];
  },
});
