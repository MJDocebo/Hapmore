import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import FlowchartView from '../components/FlowchartView';

/** Flowchart / diagram block. Stores Mermaid source in `code`; the node view renders it and edits it in place. */
export const Flowchart = Node.create({
  name: 'flowchart',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      code: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-code') ?? el.textContent ?? '',
        renderHTML: (a) => ({ 'data-code': a.code }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-flowchart]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-flowchart': '' }), ['pre', {}, node.attrs.code || '']];
  },

  renderText({ node }) {
    return `\`\`\`mermaid\n${node.attrs.code || ''}\n\`\`\``;
  },

  addCommands() {
    return {
      insertFlowchart:
        (code = '') =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { code } }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(FlowchartView);
  },
});
