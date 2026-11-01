export function shortId() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

export function isHex(c) {
  return typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c.trim());
}

export function normalizeHex(c) {
  let v = (c || '').trim();
  if (!v.startsWith('#')) v = `#${v}`;
  if (/^#[0-9a-f]{3}$/i.test(v)) v = `#${v.slice(1).split('').map((x) => x + x).join('')}`;
  return v.toLowerCase();
}

/** Translucent version of a hex color that works on both light and dark backgrounds. */
export function tint(c, pct) {
  if (!isHex(c)) return 'transparent';
  return `color-mix(in srgb, ${c} ${pct}%, transparent)`;
}

/**
 * Background tint scaled by the user's "Background intensity" setting (`--tint-k`, 0.3–1 on :root).
 * `pct` is the strongest (darkest) amount; lighter settings shrink it.
 */
export function bgTint(c, pct) {
  if (!isHex(c)) return 'transparent';
  return `color-mix(in srgb, ${c} calc(${pct}% * var(--tint-k, 1)), transparent)`;
}

/** Background intensity levels for user-chosen background colors (k scales every tint; 1 = previous default). */
export const BG_INTENSITIES = [
  { id: 'xlight', label: 'Very light', k: 0.35 },
  { id: 'light', label: 'Light', k: 0.55 },
  { id: 'medium', label: 'Medium', k: 0.78 },
  { id: 'strong', label: 'Strong', k: 1 },
];

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

const TAG_COLORS = ['#337ea9', '#448361', '#9065b0', '#c14c8a', '#d9730d', '#cb912f', '#d44c47', '#9f6b53', '#2a9d8f'];

export function tagColor(tag) {
  let h = 0;
  for (const ch of String(tag).toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TAG_COLORS[h % TAG_COLORS.length];
}

export function tagStyle(tag) {
  const c = tagColor(tag);
  return { background: tint(c, 18), color: c };
}

function parseLocalDate(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Human label + tone for a YYYY-MM-DD due date. */
export function formatDue(dateStr) {
  if (!dateStr) return null;
  const due = parseLocalDate(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due - today) / 86400000);
  const pretty = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (diff < 0) return { label: `Overdue · ${pretty}`, tone: 'danger', diff };
  if (diff === 0) return { label: 'Today', tone: 'warn', diff };
  if (diff === 1) return { label: 'Tomorrow', tone: 'warn', diff };
  if (diff < 7) return { label: `${due.toLocaleDateString(undefined, { weekday: 'short' })} · ${pretty}`, tone: 'soon', diff };
  return { label: pretty, tone: 'normal', diff };
}

export function timeAgo(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function sanitizeEmojiName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[^a-z0-9_+-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export function cssId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '');
}

export function debounce(fn, ms) {
  let t = null;
  let lastArgs = null;
  const d = (...args) => {
    lastArgs = args;
    clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...lastArgs);
    }, ms);
  };
  d.flush = () => {
    if (t) {
      clearTimeout(t);
      t = null;
      fn(...lastArgs);
    }
  };
  d.cancel = () => {
    clearTimeout(t);
    t = null;
  };
  return d;
}
