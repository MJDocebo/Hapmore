// Converts Tiptap / ProseMirror JSON (as stored in notes.content) to GitHub-flavored Markdown for exports.
// Unknown node types fall back to their text so nothing is silently dropped.

const escapeText = (s) => s.replace(/([\\`*_[\]])/g, '\\$1');
// Characters that would turn the start of a line into a heading, quote, list or rule.
const escapeLineStart = (s) =>
  s.replace(/^(\s*)([#>+-])(?=\s|$)/, '$1\\$2').replace(/^(\s*)(\d+)([.)])(?=\s|$)/, '$1$2\\$3');

const MARK_WRAP = {
  bold: ['**', '**'],
  italic: ['*', '*'],
  strike: ['~~', '~~'],
  underline: ['<u>', '</u>'],
  subscript: ['<sub>', '</sub>'],
  superscript: ['<sup>', '</sup>'],
};

function fence(text, info = '') {
  const longest = Math.max(2, ...(text.match(/`+/g) || []).map((m) => m.length));
  const f = '`'.repeat(longest + 1);
  return `${f}${info}\n${text.replace(/\n$/, '')}\n${f}`;
}

function inlineCode(text) {
  const longest = Math.max(0, ...(text.match(/`+/g) || []).map((m) => m.length));
  const f = '`'.repeat(longest + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${f}${pad}${text}${pad}${f}`;
}

function textNode(node, ctx) {
  const marks = node.marks || [];
  const raw = node.text || '';
  if (marks.some((m) => m.type === 'code')) return inlineCode(raw);
  // Keep leading/trailing spaces outside emphasis markers (`** a**` would not render as bold).
  const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
  if (!core) return raw;
  let out = escapeText(core);
  for (const m of marks) {
    const w = MARK_WRAP[m.type];
    if (w) out = `${w[0]}${out}${w[1]}`;
  }
  const link = marks.find((m) => m.type === 'link');
  if (link?.attrs?.href) out = `[${out}](${ctx.resolveHref(link.attrs.href)})`;
  return `${lead}${out}${trail}`;
}

function inline(nodes = [], ctx) {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
          return textNode(n, ctx);
        case 'hardBreak':
          return '\\\n';
        case 'inlineMath':
          return `$${n.attrs?.latex || ''}$`;
        case 'customEmoji':
          return `:${n.attrs?.name || 'emoji'}:`;
        case 'image':
          return imageMd(n, ctx);
        default:
          return n.content ? inline(n.content, ctx) : n.text || '';
      }
    })
    .join('');
}

function imageMd(n, ctx) {
  const a = n.attrs || {};
  const alt = (a.alt || a.caption || 'image').replace(/[[\]]/g, '');
  const target = ctx.resolveImage(a.path, a.src);
  const img = target ? `![${alt}](${target})` : `*[image: ${alt}]*`;
  return a.caption ? `${img}\n*${escapeText(a.caption)}*` : img;
}

const indent = (text, prefix) =>
  text
    .split('\n')
    .map((l, i) => (i === 0 || !l ? l : prefix + l))
    .join('\n');

const prefixLines = (text, prefix) =>
  text
    .split('\n')
    .map((l) => (l ? prefix + l : prefix.trimEnd()))
    .join('\n');

function listItems(node, ctx, marker) {
  return (node.content || [])
    .map((item, i) => {
      const m = marker(item, i);
      const body = blocks(item.content || [], ctx, true) || '';
      return `${m}${indent(body, ' '.repeat(Math.min(m.length, 4)))}`;
    })
    .join('\n');
}

function cellText(cell, ctx) {
  return (cell.content || [])
    .map((b) => (b.type === 'paragraph' || b.type === 'heading' ? inline(b.content, ctx) : block(b, ctx)))
    .join('<br>')
    .replace(/\n/g, '<br>')
    .replace(/\|/g, '\\|');
}

function table(node, ctx) {
  const rows = (node.content || []).map((r) => (r.content || []).map((c) => cellText(c, ctx)));
  if (!rows.length) return '';
  const cols = Math.max(...rows.map((r) => r.length));
  const pad = (r) => [...r, ...Array(cols - r.length).fill('')];
  const line = (r) => `| ${pad(r).join(' | ')} |`;
  return [line(rows[0]), `| ${Array(cols).fill('---').join(' | ')} |`, ...rows.slice(1).map(line)].join('\n');
}

function block(node, ctx) {
  switch (node.type) {
    case 'paragraph':
      return escapeLineStart(inline(node.content, ctx));
    case 'heading':
      return `${'#'.repeat(Math.min(6, Math.max(1, node.attrs?.level || 1)))} ${inline(node.content, ctx)}`;
    case 'bulletList':
      return listItems(node, ctx, () => '- ');
    case 'orderedList': {
      const start = Number(node.attrs?.start) || 1;
      return listItems(node, ctx, (_, i) => `${start + i}. `);
    }
    case 'taskList':
      return listItems(node, ctx, (item) => `- [${item.attrs?.checked ? 'x' : ' '}] `);
    case 'blockquote':
      return prefixLines(blocks(node.content, ctx), '> ');
    case 'callout': {
      const emoji = node.attrs?.emoji && !String(node.attrs.emoji).startsWith('custom:') ? `${node.attrs.emoji} ` : '';
      return prefixLines(`${emoji}${blocks(node.content, ctx)}`, '> ');
    }
    case 'codeBlock': {
      const lang = node.attrs?.language && node.attrs.language !== 'plaintext' ? node.attrs.language : '';
      return fence((node.content || []).map((t) => t.text || '').join(''), lang);
    }
    case 'flowchart':
      return fence(node.attrs?.code || '', 'mermaid');
    case 'mathBlock':
      return `$$\n${node.attrs?.latex || ''}\n$$`;
    case 'horizontalRule':
      return '---';
    case 'image':
      return imageMd(node, ctx);
    case 'table':
      return table(node, ctx);
    default:
      if (node.content) return node.content.some((c) => c.type === 'text') ? inline(node.content, ctx) : blocks(node.content, ctx);
      return node.text || '';
  }
}

function blocks(nodes = [], ctx, tight = false) {
  const out = nodes.map((n) => block(n, ctx)).filter((s, i, arr) => s !== '' || (i > 0 && i < arr.length - 1));
  return out.join(tight ? '\n' : '\n\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * doc: ProseMirror JSON ({ type: 'doc', content }) or null.
 * opts.resolveImage(path, src) → link target or null; opts.resolveHref(href) → rewritten href.
 */
export function docToMarkdown(doc, opts = {}) {
  if (!doc || !Array.isArray(doc.content)) return '';
  const ctx = {
    resolveImage: opts.resolveImage || ((path, src) => src || null),
    resolveHref: opts.resolveHref || ((h) => h),
  };
  return blocks(doc.content, ctx).trim();
}
