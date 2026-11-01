import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import CalloutView from '../components/CalloutView';

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      emoji: {
        default: '💡',
        parseHTML: (el) => el.getAttribute('data-emoji') || '💡',
        renderHTML: (a) => ({ 'data-emoji': a.emoji }),
      },
      color: {
        default: '#cb912f',
        parseHTML: (el) => el.getAttribute('data-color') || '#cb912f',
        renderHTML: (a) => ({ 'data-color': a.color }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]', contentElement: '.hm-callout-content' }, { tag: 'aside[data-callout]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-callout': '', class: 'hm-callout' }),
      ['span', { class: 'hm-callout-icon', contenteditable: 'false' }, node.attrs.emoji?.startsWith('custom:') ? '★' : node.attrs.emoji],
      ['div', { class: 'hm-callout-content' }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attrs),
      toggleCallout:
        (attrs) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, attrs),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});
