import { useApp } from '../store/useApp';

/**
 * Internal page links. Notes are linked with app-relative hrefs ("/n/<id>", optionally "?page=N" for a
 * PDF page) so they keep working across deployments and are recognizable in the editor.
 */
const NOTE_PATH = /^\/n\/([0-9a-f-]{8,})\/?(?:\?([^#]*))?(?:#.*)?$/i;

export function noteHref(id, { page } = {}) {
  const p = Number(page);
  return `/n/${id}${Number.isInteger(p) && p > 0 ? `?page=${p}` : ''}`;
}

export function noteUrl(id, opts) {
  return `${window.location.origin}${noteHref(id, opts)}`;
}

/** Returns { id, page, href } when `href` points at a note in this app (relative or same-origin absolute), else null. */
export function parseNoteHref(href) {
  if (!href || typeof href !== 'string') return null;
  let path = href.trim();
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      if (u.origin !== window.location.origin) return null;
      path = u.pathname + u.search + u.hash;
    } catch (_) {
      return null;
    }
  }
  const m = NOTE_PATH.exec(path);
  if (!m) return null;
  const page = Number(new URLSearchParams(m[2] || '').get('page')) || null;
  return { id: m[1], page, href: noteHref(m[1], { page }) };
}

export function noteTitle(id) {
  const n = useApp.getState().notes.find((x) => x.id === id);
  return n ? n.title || 'Untitled' : null;
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    // Fallback for browsers/contexts without the async clipboard API
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (_e) {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** Copies a full link to a note and confirms with a toast. Paste it into any note to get a titled page link. */
export async function copyNoteLink(id, opts) {
  const { toast } = useApp.getState();
  const ok = await writeClipboard(noteUrl(id, opts));
  if (ok) toast(opts && opts.page ? `Link to page ${opts.page} copied — paste it into any note.` : 'Link copied — paste it into any note.');
  else toast('Couldn’t copy the link. Your browser blocked clipboard access.', 'error');
}

/** Ask the app shell to route (used by editor plugins, which live outside React Router). */
export function navigateTo(to) {
  window.dispatchEvent(new CustomEvent('hm:navigate', { detail: { to } }));
}

/** Rank notes for a title search: prefix > word-prefix > substring, then most recently edited. */
export function searchNotes(notes, query, { excludeId, limit = 8 } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const scored = [];
  notes.forEach((n) => {
    if (n.id === excludeId) return;
    const t = (n.title || 'Untitled').toLowerCase();
    let score;
    if (!q) score = 3;
    else if (t.startsWith(q)) score = 0;
    else if (t.split(/[^a-z0-9]+/).some((w) => w.startsWith(q))) score = 1;
    else if (t.includes(q)) score = 2;
    else return;
    scored.push({ n, score, at: Date.parse(n.updated_at || n.created_at || 0) || 0 });
  });
  return scored
    .sort((a, b) => a.score - b.score || b.at - a.at)
    .slice(0, limit)
    .map((s) => s.n);
}

/** Heuristic: does the link-box text look like a URL (rather than a page title search)? */
export function looksLikeUrl(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  return /^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith('/') || s.startsWith('#') || /^[^\s]+\.[a-z]{2,}(\/|$|\?|#|:)/i.test(s);
}
