import { Node, InputRule, mergeAttributes } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { InlineMathView, MathBlockView } from '../components/MathViews';

export const InlineMath = Node.create({
  name: 'inlineMath',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-latex') || '',
        renderHTML: (a) => ({ 'data-latex': a.latex }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-inline-math]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-inline-math': '' }), `$${node.attrs.latex}$`];
  },

  renderText({ node }) {
    return `$${node.attrs.latex}$`;
  },

  addCommands() {
    return {
      insertInlineMath:
        (latex = '') =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { latex } }),
      /** Turns the selected text into inline math (or inserts an empty formula). */
      toggleInlineMath:
        () =>
        ({ state, chain }) => {
          const { from, to, empty } = state.selection;
          const latex = empty ? '' : state.doc.textBetween(from, to, ' ');
          return chain().insertContentAt({ from, to }, { type: this.name, attrs: { latex } }).run();
        },
    };
  },

  addKeyboardShortcuts() {
    return { 'Mod-Shift-m': () => this.editor.commands.toggleInlineMath() };
  },

  addInputRules() {
    return [
      // $x^2$  → inline math. Content may not start/end with whitespace, so "$5 and $10" stays text.
      new InputRule({
        find: /(?<![\\$\w])\$([^\s$](?:[^$]*[^\s$])?)\$$/,
        handler: ({ state, range, match }) => {
          const latex = match[1];
          if (!latex) return null;
          state.tr.replaceWith(range.from, range.to, this.type.create({ latex }));
          return undefined;
        },
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineMathView);
  },
});

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-latex') ?? '',
        renderHTML: (a) => ({ 'data-latex': a.latex }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-math-block]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-math-block': '' }), `$$${node.attrs.latex}$$`];
  },

  renderText({ node }) {
    return `$$${node.attrs.latex}$$`;
  },

  addCommands() {
    return {
      insertMathBlock:
        (latex = '') =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { latex } }),
    };
  },

  addInputRules() {
    return [
      // "$$ " at the start of an empty paragraph → math block
      new InputRule({
        find: /^\$\$\s$/,
        handler: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          if ($from.parent.type.name !== 'paragraph' || $from.parent.textContent !== '$$') return null;
          const start = $from.before();
          const end = $from.after();
          const { tr } = state;
          tr.replaceWith(start, end, this.type.create({ latex: '' }));
          tr.setSelection(NodeSelection.create(tr.doc, start));
          return undefined;
        },
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView);
  },
});
