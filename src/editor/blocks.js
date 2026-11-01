import { pickFile } from '../lib/storage';
import { useApp } from '../store/useApp';
import { insertImageFile, annotateSelection, openEmojiPickerAtCursor, openPagePickerAtCursor } from './actions';

/**
 * Items for the "\" block menu. `run(editor, range)` performs the insertion.
 * Items with `variant: true` only appear once you have typed something (e.g. "\py" → Code · Python).
 */
const del = (editor, range) => editor.chain().focus().deleteRange(range);

const codeLang = (lang, title, aliases) => ({
  id: `code-${lang}`,
  title: `Code · ${title}`,
  icon: 'code',
  description: `${title} code block`,
  aliases,
  variant: true,
  run: (e, r) => del(e, r).setCodeBlock({ language: lang }).run(),
});

export const BLOCK_ITEMS = [
  { id: 'text', title: 'Text', icon: 'text', description: 'Plain paragraph', aliases: ['paragraph', 'plain', 'p'], hint: '',
    run: (e, r) => del(e, r).setParagraph().run() },
  { id: 'h1', title: 'Heading 1', icon: 'h1', description: 'Big section heading', aliases: ['h1', 'title', 'header'], hint: '#',
    run: (e, r) => del(e, r).setNode('heading', { level: 1 }).run() },
  { id: 'h2', title: 'Heading 2', icon: 'h2', description: 'Medium heading', aliases: ['h2', 'subtitle', 'header'], hint: '##',
    run: (e, r) => del(e, r).setNode('heading', { level: 2 }).run() },
  { id: 'h3', title: 'Heading 3', icon: 'h3', description: 'Small heading', aliases: ['h3', 'header'], hint: '###',
    run: (e, r) => del(e, r).setNode('heading', { level: 3 }).run() },
  { id: 'h4', title: 'Heading 4', icon: 'h4', description: 'Smallest heading', aliases: ['h4', 'header'], hint: '####',
    run: (e, r) => del(e, r).setNode('heading', { level: 4 }).run() },
  { id: 'bullet', title: 'Bulleted list', icon: 'bullet', description: 'Simple bulleted list', aliases: ['ul', 'unordered', 'list', 'bullets'], hint: '-',
    run: (e, r) => del(e, r).toggleBulletList().run() },
  { id: 'numbered', title: 'Numbered list', icon: 'numbered', description: 'List with numbering', aliases: ['ol', 'ordered', 'list', 'numbers'], hint: '1.',
    run: (e, r) => del(e, r).toggleOrderedList().run() },
  { id: 'todo', title: 'To-do list', icon: 'todo', description: 'Track tasks with checkboxes', aliases: ['task', 'checkbox', 'checklist', 'todo'], hint: '[ ]',
    run: (e, r) => del(e, r).toggleTaskList().run() },
  { id: 'quote', title: 'Quote', icon: 'quote', description: 'Capture a quotation', aliases: ['blockquote', 'cite'], hint: '>',
    run: (e, r) => del(e, r).setParagraph().toggleBlockquote().run() },
  { id: 'callout', title: 'Callout', icon: 'callout', description: 'Make text stand out with an emoji', aliases: ['note', 'info', 'tip', 'warning', 'box', 'aside'],
    run: (e, r) => del(e, r).setParagraph().setCallout().run() },
  { id: 'code', title: 'Code block', icon: 'code', description: 'Syntax-highlighted code', aliases: ['codeblock', 'pre', 'snippet', 'program'], hint: '```',
    run: (e, r) => del(e, r).setCodeBlock({ language: 'plaintext' }).run() },
  { id: 'mathblock', title: 'Math block', icon: 'math', description: 'Display equation (LaTeX / KaTeX)', aliases: ['math', 'equation', 'latex', 'tex', 'formula', 'katex', 'block'], hint: '$$',
    run: (e, r) => del(e, r).insertMathBlock('').run() },
  { id: 'inlinemath', title: 'Inline math', icon: 'math', description: 'Formula inside a line of text', aliases: ['math', 'inline', 'equation', 'formula', 'latex', 'tex'], hint: '$…$',
    run: (e, r) => del(e, r).insertInlineMath('').run() },
  { id: 'flowchart', title: 'Flowchart', icon: 'flowchart', description: 'Diagram you can edit later (Mermaid)', aliases: ['diagram', 'mermaid', 'chart', 'graph', 'flow', 'sequence', 'state', 'uml'],
    run: (e, r) => del(e, r).insertFlowchart('').run() },
  { id: 'table', title: 'Table', icon: 'table', description: 'Simple table (3 × 3)', aliases: ['grid', 'tabular', 'matrix'],
    run: (e, r) => del(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { id: 'image', title: 'Image', icon: 'image', description: 'Upload an image', aliases: ['picture', 'photo', 'img', 'upload', 'figure', 'screenshot'],
    run: (e, r) => {
      del(e, r).run();
      pickFile('image/*').then((f) => f && insertImageFile(e, f));
    } },
  { id: 'imageurl', title: 'Image from URL', icon: 'image', description: 'Embed an image by link', aliases: ['url', 'link', 'embed', 'picture'], variant: true,
    run: (e, r) => {
      del(e, r).run();
      useApp
        .getState()
        .promptText({ title: 'Embed an image from a link', message: 'Paste the address of an image (https://…).', placeholder: 'https://example.com/diagram.png', confirmLabel: 'Embed' })
        .then((src) => {
          if (!src || e.isDestroyed) return;
          if (!/^(https?:|data:image\/)/i.test(src)) {
            useApp.getState().toast('That doesn’t look like an image link (it should start with https://).', 'error');
            return;
          }
          e.chain().focus().insertContent({ type: 'image', attrs: { src } }).run();
        });
    } },
  { id: 'pagelink', title: 'Link to page', icon: 'link', description: 'Link another note by its title', aliases: ['page', 'link', 'mention', 'note', 'reference', 'pdf'],
    run: (e, r) => {
      del(e, r).run();
      openPagePickerAtCursor(e);
    } },
  { id: 'divider', title: 'Divider', icon: 'divider', description: 'Visual separator', aliases: ['hr', 'line', 'separator', 'rule'], hint: '---',
    run: (e, r) => del(e, r).setHorizontalRule().run() },
  { id: 'emoji', title: 'Emoji', icon: 'emoji', description: 'Pick an emoji (or type :name:)', aliases: ['emoji', 'icon', 'smiley', 'face'],
    run: (e, r) => {
      del(e, r).run();
      openEmojiPickerAtCursor(e);
    } },
  { id: 'annotation', title: 'Annotation', icon: 'annotation', description: 'Add a side note for this block', aliases: ['comment', 'annotate', 'lookup', 'remember', 'side'],
    run: (e, r) => {
      del(e, r).run();
      annotateSelection(e);
    } },
  codeLang('python', 'Python', ['python', 'py']),
  codeLang('java', 'Java', ['java']),
  codeLang('c', 'C', ['c', 'clang']),
  codeLang('cpp', 'C++', ['cpp', 'c++', 'cplusplus']),
  codeLang('javascript', 'JavaScript', ['javascript', 'js']),
  codeLang('typescript', 'TypeScript', ['typescript', 'ts']),
  codeLang('rust', 'Rust', ['rust', 'rs']),
  codeLang('go', 'Go', ['go', 'golang']),
  codeLang('haskell', 'Haskell', ['haskell', 'hs']),
  codeLang('sql', 'SQL', ['sql', 'query']),
  codeLang('bash', 'Bash', ['bash', 'shell', 'sh', 'terminal']),
  codeLang('x86asm', 'x86 Assembly', ['asm', 'assembly', 'x86']),
];

export function filterBlocks(query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return BLOCK_ITEMS.filter((i) => !i.variant);
  const scored = [];
  BLOCK_ITEMS.forEach((item, idx) => {
    const title = item.title.toLowerCase();
    const words = title.split(/[^a-z0-9+#]+/).filter(Boolean);
    let score = -1;
    if (title.startsWith(q)) score = 0;
    else if (words.some((w) => w.startsWith(q))) score = 1;
    else if (item.aliases.some((a) => a.startsWith(q))) score = 2;
    if (score >= 0) scored.push({ item, score, idx });
  });
  return scored.sort((a, b) => a.score - b.score || a.idx - b.idx).map((s) => s.item).slice(0, 14);
}
