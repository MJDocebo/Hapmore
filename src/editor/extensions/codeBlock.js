import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { createLowlight, common } from 'lowlight';
import haskell from 'highlight.js/lib/languages/haskell';
import scala from 'highlight.js/lib/languages/scala';
import ocaml from 'highlight.js/lib/languages/ocaml';
import latex from 'highlight.js/lib/languages/latex';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import julia from 'highlight.js/lib/languages/julia';
import matlab from 'highlight.js/lib/languages/matlab';
import prolog from 'highlight.js/lib/languages/prolog';
import lisp from 'highlight.js/lib/languages/lisp';
import scheme from 'highlight.js/lib/languages/scheme';
import x86asm from 'highlight.js/lib/languages/x86asm';
import armasm from 'highlight.js/lib/languages/armasm';
import llvm from 'highlight.js/lib/languages/llvm';
import verilog from 'highlight.js/lib/languages/verilog';
import vhdl from 'highlight.js/lib/languages/vhdl';
import erlang from 'highlight.js/lib/languages/erlang';
import elixir from 'highlight.js/lib/languages/elixir';
import clojure from 'highlight.js/lib/languages/clojure';
import fsharp from 'highlight.js/lib/languages/fsharp';
import dart from 'highlight.js/lib/languages/dart';
import cmake from 'highlight.js/lib/languages/cmake';
import protobuf from 'highlight.js/lib/languages/protobuf';
import CodeBlockView from '../components/CodeBlockView';
import { TextSelection } from '@tiptap/pm/state';
import { commentSyntax, toggleLineComments } from '../codeComments';

export const lowlight = createLowlight(common);
lowlight.register({
  haskell, scala, ocaml, latex, dockerfile, julia, matlab, prolog, lisp, scheme, x86asm, armasm,
  llvm, verilog, vhdl, erlang, elixir, clojure, fsharp, dart, cmake, protobuf,
});

export { CODE_LANGUAGES } from '../languages';

export const CodeBlock = CodeBlockLowlight.extend({
  addKeyboardShortcuts() {
    return {
      ...(this.parent ? this.parent() : {}),
      Tab: () => {
        if (!this.editor.isActive('codeBlock')) return false;
        return this.editor.commands.insertContent('    ');
      },
      // New lines keep the indentation (leading spaces / tabs) of the line the cursor is on.
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        const { $from, $to } = selection;
        if ($from.parent.type.name !== this.name || !$from.sameParent($to)) return false;
        const text = $from.parent.textContent;
        const before = text.slice(0, $from.parentOffset);
        const line = before.slice(before.lastIndexOf('\n') + 1);
        const indent = /^[ \t]*/.exec(line)[0];
        // Like the default triple-Enter: two blank lines at the end leave the block. Lines holding only the
        // auto-inserted indentation count as blank.
        if (selection.empty && $from.parentOffset === text.length && this.options.exitOnTripleEnter !== false) {
          const m = /\n[ \t]*\n[ \t]*$/.exec(text);
          if (m) {
            const from = $from.start() + m.index;
            return editor
              .chain()
              .command(({ tr }) => {
                tr.delete(from, $from.pos);
                return true;
              })
              .exitCode()
              .run();
          }
        }
        return editor.commands.command(({ tr }) => {
          tr.insertText(`\n${indent}`, selection.from, selection.to);
          tr.scrollIntoView();
          return true;
        });
      },
      // Removes one indentation level (up to 4 spaces or a tab) from the current line.
      'Shift-Tab': ({ editor }) => {
        const { $from } = editor.state.selection;
        if ($from.parent.type.name !== this.name) return false;
        const text = $from.parent.textContent;
        const lineStart = text.slice(0, $from.parentOffset).lastIndexOf('\n') + 1;
        const m = /^( {1,4}|\t)/.exec(text.slice(lineStart));
        if (!m) return true; // nothing to remove; keep focus in the block
        const pos = $from.start() + lineStart;
        return editor.commands.command(({ tr }) => {
          tr.delete(pos, pos + m[0].length);
          return true;
        });
      },
      // Cmd/Ctrl + / toggles a line comment on the current (or every selected) line, using the block's language.
      // Only inside code blocks; languages without comments (plain text, JSON, diff) are left unchanged.
      'Mod-/': ({ editor }) => {
        const { $from, $to } = editor.state.selection;
        if ($from.parent.type.name !== this.name) return false;
        if (!editor.isEditable) return true;
        const block = $from.parent;
        const text = block.textContent;
        const to = $from.sameParent($to) ? $to.parentOffset : text.length;
        const edits = toggleLineComments(text, $from.parentOffset, to, block.attrs.language);
        if (!edits || !edits.length) return true;
        const start = $from.start();
        const syn = commentSyntax(block.attrs.language);
        return editor.commands.command(({ tr }) => {
          for (const e of [...edits].sort((a, b) => b.from - a.from)) {
            if (e.insert) tr.insertText(e.insert, start + e.from, start + e.to);
            else tr.delete(start + e.from, start + e.to);
          }
          // Commenting an empty line with a block-style comment ("/*  */"): put the cursor between the markers.
          if (edits.length === 1 && syn?.open && edits[0].insert === `${syn.open}  ${syn.close}`) {
            tr.setSelection(TextSelection.create(tr.doc, start + edits[0].from + syn.open.length + 1));
          }
          tr.scrollIntoView();
          return true;
        });
      },
      'Mod-a': () => {
        // first Mod-A selects just the code block's contents
        const { state } = this.editor;
        const { $from, from, to } = state.selection;
        if ($from.parent.type.name !== 'codeBlock') return false;
        const start = $from.start();
        const end = $from.end();
        if (from === start && to === end) return false;
        return this.editor.commands.setTextSelection({ from: start, to: end });
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
}).configure({ lowlight, defaultLanguage: 'plaintext' });
