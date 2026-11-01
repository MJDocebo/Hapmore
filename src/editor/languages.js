/** Languages shown in the code block picker (value = highlight.js id). */
const byLabel = (a, b) => a[1].localeCompare(b[1], 'en', { sensitivity: 'base' });

// Kept alphabetical (and re-sorted at load, so new entries can go anywhere); "Plain text" stays pinned first.
export const CODE_LANGUAGES = [
  ['plaintext', 'Plain text'],
  ...[
    ['armasm', 'ARM Assembly'], ['bash', 'Bash'], ['c', 'C'], ['csharp', 'C#'], ['cpp', 'C++'],
    ['clojure', 'Clojure'], ['cmake', 'CMake'], ['css', 'CSS'], ['dart', 'Dart'], ['diff', 'Diff'],
    ['dockerfile', 'Dockerfile'], ['elixir', 'Elixir'], ['erlang', 'Erlang'], ['fsharp', 'F#'], ['go', 'Go'],
    ['graphql', 'GraphQL'], ['haskell', 'Haskell'], ['xml', 'HTML / XML'], ['ini', 'INI / TOML'],
    ['java', 'Java'], ['javascript', 'JavaScript'], ['json', 'JSON'], ['julia', 'Julia'], ['kotlin', 'Kotlin'],
    ['latex', 'LaTeX'], ['lisp', 'Lisp'], ['llvm', 'LLVM IR'], ['lua', 'Lua'], ['makefile', 'Makefile'],
    ['markdown', 'Markdown'], ['matlab', 'MATLAB'], ['ocaml', 'OCaml'], ['perl', 'Perl'], ['php', 'PHP'],
    ['prolog', 'Prolog'], ['protobuf', 'Protocol Buffers'], ['python', 'Python'],
    ['python-repl', 'Python REPL'], ['r', 'R'], ['ruby', 'Ruby'], ['rust', 'Rust'], ['scala', 'Scala'],
    ['scheme', 'Scheme'], ['shell', 'Shell session'], ['sql', 'SQL'], ['swift', 'Swift'],
    ['typescript', 'TypeScript'], ['verilog', 'Verilog'], ['vhdl', 'VHDL'], ['x86asm', 'x86 Assembly'],
    ['yaml', 'YAML'],
  ].sort(byLabel),
];
