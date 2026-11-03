// Line-comment toggling for code blocks (Cmd/Ctrl + /), modeled on VS Code's "Toggle Line Comment".

const LINE = (token) => ({ line: token });
const WRAP = (open, close) => ({ open, close });

const SYNTAX = {
  // "//" family
  ...Object.fromEntries(
    ['javascript', 'typescript', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'swift', 'kotlin', 'scala', 'dart', 'php', 'fsharp', 'protobuf', 'verilog'].map(
      (l) => [l, LINE('//')],
    ),
  ),
  // "#" family
  ...Object.fromEntries(
    ['python', 'python-repl', 'bash', 'shell', 'r', 'ruby', 'perl', 'yaml', 'makefile', 'cmake', 'dockerfile', 'julia', 'elixir', 'graphql', 'ini'].map(
      (l) => [l, LINE('#')],
    ),
  ),
  ...Object.fromEntries(['sql', 'lua', 'haskell', 'vhdl'].map((l) => [l, LINE('--')])),
  ...Object.fromEntries(['latex', 'matlab', 'prolog', 'erlang'].map((l) => [l, LINE('%')])),
  ...Object.fromEntries(['lisp', 'scheme', 'clojure', 'llvm', 'x86asm', 'armasm'].map((l) => [l, LINE(';')])),
  // No single-line syntax: each line is wrapped in a block comment instead.
  css: WRAP('/*', '*/'),
  xml: WRAP('<!--', '-->'),
  markdown: WRAP('<!--', '-->'),
  ocaml: WRAP('(*', '*)'),
  // plaintext, json, diff: no comments
};

const ALIASES = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', ts: 'typescript', tsx: 'typescript', 'c++': 'cpp', cc: 'cpp', h: 'c',
  hpp: 'cpp', cs: 'csharp', golang: 'go', rs: 'rust', kt: 'kotlin', py: 'python', python3: 'python', sh: 'bash', zsh: 'bash',
  console: 'shell', rb: 'ruby', pl: 'perl', yml: 'yaml', toml: 'ini', make: 'makefile', docker: 'dockerfile', ex: 'elixir',
  exs: 'elixir', jl: 'julia', hs: 'haskell', tex: 'latex', erl: 'erlang', clj: 'clojure', fs: 'fsharp', html: 'xml', svg: 'xml',
  md: 'markdown', ml: 'ocaml', postgres: 'sql', postgresql: 'sql', mysql: 'sql', scss: 'css', less: 'css', proto: 'protobuf',
};

export function commentSyntax(language) {
  const l = String(language || '').toLowerCase();
  return SYNTAX[l] || SYNTAX[ALIASES[l]] || null;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * text: the whole code block; from/to: selection offsets inside it.
 * Returns edits [{ from, to, insert }] (offsets into `text`, non-overlapping), or null if the language has no comments.
 * Every touched line is commented, or uncommented if all of its non-blank lines already are. Markers go at the
 * smallest indentation so the block stays aligned; blank lines are skipped unless only one line is involved.
 */
export function toggleLineComments(text, from, to, language) {
  const syn = commentSyntax(language);
  if (!syn) return null;

  // Lines touched by the selection (a selection ending at the very start of a line doesn't include that line).
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  const lineOf = (pos) => {
    let lo = 0;
    for (let i = 0; i < starts.length && starts[i] <= pos; i++) lo = i;
    return lo;
  };
  const first = lineOf(from);
  let last = lineOf(to);
  if (to > from && last > first && starts[last] === to) last--;

  const lines = [];
  for (let i = first; i <= last; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] - 1 : text.length;
    const content = text.slice(start, end);
    lines.push({ start, end, content, indent: /^[ \t]*/.exec(content)[0].length, blank: !content.trim() });
  }
  const targets = lines.length === 1 ? lines : lines.filter((l) => !l.blank);
  if (!targets.length) return [];

  const isCommented = (l) => {
    const body = l.content.slice(l.indent);
    if (syn.line) return body.startsWith(syn.line);
    const trimmed = body.trimEnd();
    return trimmed.startsWith(syn.open) && trimmed.endsWith(syn.close) && trimmed.length >= syn.open.length + syn.close.length;
  };
  const allCommented = targets.every((l) => !l.blank && isCommented(l));
  const edits = [];

  if (allCommented) {
    for (const l of targets) {
      const at = l.start + l.indent;
      if (syn.line) {
        const m = new RegExp(`^${escapeRe(syn.line)} ?`).exec(l.content.slice(l.indent));
        edits.push({ from: at, to: at + m[0].length, insert: '' });
      } else {
        const body = l.content.slice(l.indent);
        const open = new RegExp(`^${escapeRe(syn.open)} ?`).exec(body)[0];
        const trimmedEnd = l.start + l.indent + body.trimEnd().length;
        const closeM = new RegExp(` ?${escapeRe(syn.close)}$`).exec(body.trimEnd());
        edits.push({ from: at, to: at + open.length, insert: '' });
        edits.push({ from: trimmedEnd - closeM[0].length, to: trimmedEnd, insert: '' });
      }
    }
  } else {
    const col = Math.min(...targets.map((l) => (l.blank ? l.content.length : l.indent)));
    for (const l of targets) {
      const at = l.start + Math.min(col, l.content.length);
      if (syn.line) edits.push({ from: at, to: at, insert: `${syn.line} ` });
      else if (l.blank) edits.push({ from: at, to: at, insert: `${syn.open}  ${syn.close}` });
      else {
        edits.push({ from: at, to: at, insert: `${syn.open} ` });
        const endTrim = l.start + l.content.trimEnd().length;
        edits.push({ from: endTrim, to: endTrim, insert: ` ${syn.close}` });
      }
    }
  }
  return edits.sort((a, b) => a.from - b.from);
}

/** Applies edits to a string (for tests and previews). */
export function applyEdits(text, edits) {
  let out = text;
  for (const e of [...edits].sort((a, b) => b.from - a.from)) out = out.slice(0, e.from) + e.insert + out.slice(e.to);
  return out;
}
