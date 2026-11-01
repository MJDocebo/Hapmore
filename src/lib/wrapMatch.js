const isWordChar = (ch) => !!ch && /[\p{L}\p{N}]/u.test(ch);

/**
 * Pure matcher for text-style typing shortcuts.
 * before: block text before the cursor (inline atoms as \ufffc), text: the characters being typed,
 * wrappers: [{ id, open, close }] sorted longest-close first.
 * Returns { wrapper, openAt, innerAt, closeAt } as offsets into `before` (closeAt = where the already-typed
 * part of the closing sequence starts), or null.
 */
export function matchWrapper(before, text, wrappers) {
  const full = before + text;
  for (const w of wrappers) {
    if (!full.endsWith(w.close) || text.length > w.close.length) continue;
    const body = full.slice(0, full.length - w.close.length);
    const idx = body.lastIndexOf(w.open);
    if (idx < 0) continue;
    const inner = body.slice(idx + w.open.length);
    if (!inner || /^\s|\s$/.test(inner) || inner.includes('\ufffc')) continue;
    const charBefore = body[idx - 1];
    if (isWordChar(charBefore)) continue; // mid-word, e.g. a~b~
    // Single-char wrapper that is doubled (e.g. "~~") belongs to another syntax (strikethrough).
    if (w.open.length === 1 && w.open === w.close && (charBefore === w.open || inner.startsWith(w.open) || inner.endsWith(w.open))) continue;
    return { wrapper: w, openAt: idx, innerAt: idx + w.open.length, closeAt: body.length };
  }
  return null;
}
