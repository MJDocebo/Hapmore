// Subtle gradient backgrounds for the Home page and course / project / research spaces.
//
// A gradient is { from: '#hex', to: '#hex', angle: deg, strength: 'subtle' | 'soft' | 'bold' }, or { off: true } for a plain page.
// Settings hold one per scope (home + each folder kind). A folder's own `background` column overrides its kind:
// null = follow the kind default, { off: true } = none for this space, otherwise a gradient.
import { isHex } from './utils';

export const BG_PRESETS = [
  { id: 'sky', name: 'Sky', from: '#8ec5fc', to: '#e0c3fc' },
  { id: 'ocean', name: 'Ocean', from: '#5eead4', to: '#93c5fd' },
  { id: 'mint', name: 'Mint', from: '#86efac', to: '#a5f3fc' },
  { id: 'sage', name: 'Sage', from: '#a3c9a8', to: '#e9e4c9' },
  { id: 'peach', name: 'Peach', from: '#ffb38a', to: '#ffe29f' },
  { id: 'dawn', name: 'Dawn', from: '#f9a8d4', to: '#fcd34d' },
  { id: 'lavender', name: 'Lavender', from: '#c4b5fd', to: '#f5d0fe' },
  { id: 'graphite', name: 'Graphite', from: '#94a3b8', to: '#e2e8f0' },
];

/** How much of the gradient color is mixed into the theme background (keeps it subtle and dark-mode friendly). */
export const BG_STRENGTHS = [
  { id: 'subtle', label: 'Subtle', pct: 11 },
  { id: 'soft', label: 'Soft', pct: 18 },
  { id: 'bold', label: 'Bold', pct: 28 },
];

export const BG_ANGLES = [
  { deg: 180, label: '↓', title: 'Top to bottom' },
  { deg: 135, label: '↘', title: 'Diagonal' },
  { deg: 90, label: '→', title: 'Left to right' },
  { deg: 45, label: '↗', title: 'Diagonal up' },
];

const preset = (id, angle = 135) => {
  const p = BG_PRESETS.find((x) => x.id === id) || BG_PRESETS[0];
  return { from: p.from, to: p.to, angle, strength: 'subtle' };
};

export const BG_SCOPES = [
  { id: 'home', label: 'Home page' },
  { id: 'course', label: 'All courses' },
  { id: 'project', label: 'All projects' },
  { id: 'research', label: 'All research' },
];

export const DEFAULT_BACKGROUNDS = {
  home: preset('sky'),
  course: preset('ocean'),
  project: preset('peach'),
  research: preset('lavender'),
};

/** Coerces stored data into a valid gradient / { off: true }; returns `fallback` when unusable. */
export function normalizeBg(v, fallback = null) {
  if (!v || typeof v !== 'object') return fallback;
  if (v.off) return { off: true };
  if (!isHex(v.from) || !isHex(v.to)) return fallback;
  const angle = Number.isFinite(Number(v.angle)) ? ((Math.round(Number(v.angle)) % 360) + 360) % 360 : 135;
  const strength = BG_STRENGTHS.some((s) => s.id === v.strength) ? v.strength : 'subtle';
  return { from: v.from, to: v.to, angle, strength };
}

export function mergeBackgrounds(saved) {
  const out = {};
  for (const { id } of BG_SCOPES) out[id] = normalizeBg(saved?.[id], DEFAULT_BACKGROUNDS[id]);
  return out;
}

/** Effective gradient for a scope, applying a per-space override when present. */
export function resolveBg(backgrounds, scope, override) {
  const own = normalizeBg(override, null);
  if (own) return own;
  return normalizeBg(backgrounds?.[scope], DEFAULT_BACKGROUNDS[scope] || null);
}

/** CSS background for a gradient; colors are mixed into the theme background so dark mode stays dark. */
export function bgCss(g, pctOverride) {
  if (!g || g.off) return null;
  const pct = pctOverride ?? (BG_STRENGTHS.find((s) => s.id === g.strength) || BG_STRENGTHS[0]).pct;
  return `linear-gradient(${g.angle}deg, color-mix(in srgb, ${g.from} ${pct}%, var(--bg)) 0%, color-mix(in srgb, ${g.to} ${pct}%, var(--bg)) 100%)`;
}

export function bgLabel(g) {
  if (!g) return 'Default';
  if (g.off) return 'None';
  const p = BG_PRESETS.find((x) => x.from.toLowerCase() === g.from.toLowerCase() && x.to.toLowerCase() === g.to.toLowerCase());
  return p ? p.name : 'Custom';
}

export const sameBg = (a, b) => JSON.stringify(normalizeBg(a)) === JSON.stringify(normalizeBg(b));
