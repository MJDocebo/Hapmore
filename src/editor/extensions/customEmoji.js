import { Node, mergeAttributes } from '@tiptap/core';
import { useApp } from '../../store/useApp';

/** Inline uploaded emoji (rendered from private storage via a signed URL). */
export const CustomEmoji = Node.create({
  name: 'customEmoji',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-custom-emoji'),
        renderHTML: (a) => ({ 'data-custom-emoji': a.id }),
      },
      name: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-name') || '',
        renderHTML: (a) => ({ 'data-name': a.name, alt: `:${a.name}:`, title: `:${a.name}:` }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'img[data-custom-emoji]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes({ class: 'hm-inline-emoji' }, HTMLAttributes)];
  },

  renderText({ node }) {
    return `:${node.attrs.name}:`;
  },

  addNodeView() {
    return ({ node }) => {
      const emoji = useApp.getState().emojis.find((e) => e.id === node.attrs.id);
      let dom;
      if (emoji && emoji.url) {
        dom = document.createElement('img');
        dom.src = emoji.url;
        dom.alt = `:${emoji.name}:`;
        dom.title = `:${emoji.name}:`;
        dom.className = 'hm-inline-emoji';
        dom.draggable = false;
      } else {
        dom = document.createElement('span');
        dom.className = 'hm-inline-emoji-missing';
        dom.textContent = `:${node.attrs.name}:`;
      }
      return { dom };
    };
  },
});
