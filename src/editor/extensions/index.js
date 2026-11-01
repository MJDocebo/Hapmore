import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { BlockAttrs, TrailingNode, LinkOpener } from './blockAttrs';
import { TextBackground, CustomStyle } from './textStyles';
import { Callout } from './callout';
import { InlineMath, MathBlock } from './math';
import { Flowchart } from './flowchart';
import { CodeBlock } from './codeBlock';
import { ImageBlock } from './image';
import { CustomEmoji } from './customEmoji';
import { AnnotationMarks } from './annotationMarks';
import { BlockHandle } from './blockHandle';
import { SlashCommand, EmojiSuggest } from './suggestions';

export function buildExtensions({ placeholder } = {}) {
  return [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: [1, 2, 3, 4] },
      dropcursor: { color: '#2383e2', width: 3 },
    }),
    Underline,
    Subscript,
    Superscript,
    TextStyle,
    Color,
    TextBackground,
    CustomStyle,
    Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true, HTMLAttributes: { class: 'hm-table' } }),
    TableRow,
    TableHeader,
    TableCell,
    CodeBlock,
    InlineMath,
    MathBlock,
    Flowchart,
    Callout,
    ImageBlock,
    CustomEmoji,
    BlockAttrs,
    TrailingNode,
    LinkOpener,
    AnnotationMarks,
    BlockHandle,
    SlashCommand,
    EmojiSuggest,
    Placeholder.configure({
      includeChildren: true,
      // Only paragraphs and headings get a hint; containers (quote, callout, list items…) return ''
      // so the hint isn't drawn twice (once on the container and once on the paragraph inside it).
      placeholder: ({ editor, node, pos }) => {
        if (node.type.name === 'heading') return `Heading ${node.attrs.level}`;
        if (node.type.name !== 'paragraph') return '';
        let parent = null;
        try {
          parent = editor.state.doc.resolve(pos).parent.type.name;
        } catch (_) {
          parent = null;
        }
        if (parent === 'listItem') return 'List';
        if (parent === 'taskItem') return 'To-do';
        if (parent === 'blockquote') return 'Quote';
        if (parent === 'callout') return 'Callout';
        if (parent === 'tableCell' || parent === 'tableHeader') return '';
        return placeholder || "Type '\\' for blocks, ':' for emoji, $…$ for math";
      },
    }),
  ];
}
