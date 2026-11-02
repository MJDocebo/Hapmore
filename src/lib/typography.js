import { isHex, normalizeHex } from './utils';

/**
 * Typography roles shown in Settings → Typography. Every role has a font, a size in px, a color and
 * bold / italic / underline formatting. `inherit` roles default to following another role (font '' / size 0 = "same as …").
 * `bold` is the role's default weight; `styleFrom` names the role whose formatting it inherits by default.
 */
export const TYPE_ROLES = [
  { key: 'h1', label: 'Heading 1', group: 'Headings', font: 'Inter', size: 32, bold: true },
  { key: 'h2', label: 'Heading 2', group: 'Headings', font: 'Inter', size: 25, bold: true },
  { key: 'h3', label: 'Heading 3', group: 'Headings', font: 'Inter', size: 20, bold: true },
  { key: 'h4', label: 'Heading 4', group: 'Headings', font: 'Inter', size: 17, bold: true },
  { key: 'body', label: 'Body text', group: 'Text', font: 'Inter', size: 16 },
  { key: 'subtitle', label: 'Subtitle', group: 'Text', font: '', size: 17, inheritFont: 'body', defaultColor: 'secondary' },
  { key: 'quote', label: 'Quotes', group: 'Text', font: '', size: 0, inheritFont: 'body', inheritSize: 'body', styleFrom: 'body' },
  { key: 'callout', label: 'Callouts', group: 'Text', font: '', size: 0, inheritFont: 'body', inheritSize: 'body', styleFrom: 'body' },
  { key: 'code', label: 'Code blocks', group: 'Code', font: 'JetBrains Mono', size: 14 },
  { key: 'inlineCode', label: 'Inline code', group: 'Code', font: '', size: 0, inheritFont: 'code', inheritSize: 'auto' },
];
export const TYPE_GROUPS = ['Headings', 'Text', 'Code'];
export const ROLE_LABELS = Object.fromEntries(TYPE_ROLES.map((r) => [r.key, r.label]));

export const DEFAULT_FONTS = Object.fromEntries(TYPE_ROLES.map((r) => [r.key, r.font]));
export const DEFAULT_SIZES = { ...Object.fromEntries(TYPE_ROLES.map((r) => [r.key, r.size])), lineHeight: 1.65, unit: 'px' };
export const DEFAULT_TEXT_COLORS = Object.fromEntries(TYPE_ROLES.map((r) => [r.key, '']));
/** Per role: { bold?, italic?, underline? } — each true/false when set explicitly, absent = role default. */
export const DEFAULT_TEXT_STYLES = {};
export const STYLE_FLAGS = ['bold', 'italic', 'underline'];

/** Code-specific options: background colors ('' = theme default), code-block line spacing and line numbers. */
export const DEFAULT_CODE_STYLE = { blockBg: '', inlineBg: '', lineHeight: 1.6, lineNumbers: false };
export const CODE_LINE_HEIGHTS = [
  { value: 1.35, label: 'Compact' },
  { value: 1.6, label: 'Normal' },
  { value: 1.85, label: 'Relaxed' },
  { value: 2.1, label: 'Loose' },
];

/** Keeps only valid explicit flags for known roles. */
export function normalizeTextStyles(v) {
  const out = {};
  if (!v || typeof v !== 'object') return out;
  TYPE_ROLES.forEach((r) => {
    const src = v[r.key];
    if (!src || typeof src !== 'object') return;
    const clean = {};
    STYLE_FLAGS.forEach((f) => {
      if (typeof src[f] === 'boolean') clean[f] = src[f];
    });
    if (Object.keys(clean).length) out[r.key] = clean;
  });
  return out;
}

export function normalizeCodeStyle(v) {
  const s = v && typeof v === 'object' ? v : {};
  const lh = Number(s.lineHeight);
  return {
    blockBg: isHex(s.blockBg) ? normalizeHex(s.blockBg) : '',
    inlineBg: isHex(s.inlineBg) ? normalizeHex(s.inlineBg) : '',
    lineHeight: lh >= 1 && lh <= 3 ? lh : DEFAULT_CODE_STYLE.lineHeight,
    lineNumbers: !!s.lineNumbers,
  };
}

/** Effective bold / italic / underline for a role (explicit setting → inherited role → role default). */
export function effectiveStyle(textStyles, key) {
  const r = TYPE_ROLES.find((x) => x.key === key);
  const own = (textStyles || {})[key] || {};
  const base = r?.styleFrom ? effectiveStyle(textStyles, r.styleFrom) : { bold: !!r?.bold, italic: false, underline: false };
  return Object.fromEntries(STYLE_FLAGS.map((f) => [f, typeof own[f] === 'boolean' ? own[f] : base[f]]));
}

/** Sets one flag; storing nothing when it matches the default so "reset" state stays clean. */
export function withStyleFlag(textStyles, key, flag, value) {
  const r = TYPE_ROLES.find((x) => x.key === key);
  const own = { ...((textStyles || {})[key] || {}) };
  delete own[flag];
  const fallback = r?.styleFrom ? effectiveStyle(textStyles, r.styleFrom)[flag] : flag === 'bold' ? !!r?.bold : false;
  if (value !== fallback) own[flag] = value;
  const next = { ...(textStyles || {}) };
  if (Object.keys(own).length) next[key] = own;
  else delete next[key];
  return next;
}

export const SIZE_OPTIONS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24, 26, 28, 30, 32, 36, 40, 44, 48, 56, 64, 72];
export const LINE_HEIGHTS = [
  { value: 1.3, label: 'Tight' },
  { value: 1.45, label: 'Snug' },
  { value: 1.65, label: 'Normal' },
  { value: 1.8, label: 'Relaxed' },
  { value: 2, label: 'Loose' },
];

const cssName = (key) => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
export const roleVar = (prop, key) => `--${prop}-${cssName(key)}`;

/** Converts settings saved by earlier versions (em multipliers) to px and fills new roles. */
export function migrateTypography(fonts = {}, sizes = {}) {
  const f = { ...DEFAULT_FONTS, ...fonts };
  let s;
  if (sizes && Object.keys(sizes).length && sizes.unit !== 'px') {
    const body = Number(sizes.body) || 16;
    const em = (v, d) => (Number(v) > 0 ? Math.round(Number(v) * body) : d);
    s = {
      ...DEFAULT_SIZES,
      h1: em(sizes.h1, DEFAULT_SIZES.h1),
      h2: em(sizes.h2, DEFAULT_SIZES.h2),
      h3: em(sizes.h3, DEFAULT_SIZES.h3),
      h4: em(sizes.h4, DEFAULT_SIZES.h4),
      body: Math.round(body),
      code: em(sizes.code, DEFAULT_SIZES.code),
      lineHeight: Number(sizes.lineHeight) || DEFAULT_SIZES.lineHeight,
    };
  } else s = { ...DEFAULT_SIZES, ...(sizes || {}) };
  return { fonts: f, sizes: s };
}

function luminance(hex) {
  const h = normalizeHex(hex).slice(1, 7);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Keeps a chosen color readable in the current theme (very dark text is lifted in dark mode and vice versa). */
export function readableColor(hex, theme) {
  if (!isHex(hex)) return '';
  const L = luminance(hex);
  if (theme === 'dark' && L < 0.06) return `color-mix(in srgb, ${hex} 35%, #e6e5e2)`;
  if (theme !== 'dark' && L > 0.8) return `color-mix(in srgb, ${hex} 40%, #2b2a27)`;
  return hex;
}

/** 'dark' | 'light' text tone that stays readable on a background color. */
export function toneFor(hex) {
  if (!isHex(hex)) return '';
  return luminance(hex) < 0.22 ? 'dark' : 'light';
}

/**
 * CSS custom properties for every role: --font-*, --size-*, --color-*, plus --weight-*, --style-*, --decoration-*
 * when formatting is set explicitly (otherwise CSS falls back to the role default), and the code options.
 */
export function typographyVars({ fonts, sizes, textColors, textStyles, codeStyle }, fontStack, theme) {
  const vars = {};
  TYPE_ROLES.forEach((r) => {
    const font = fonts[r.key];
    vars[roleVar('font', r.key)] = font ? fontStack(font) : r.inheritFont ? `var(${roleVar('font', r.inheritFont)})` : fontStack(r.font);
    const size = Number(sizes[r.key]);
    if (size > 0) vars[roleVar('size', r.key)] = `${size}px`;
    else if (r.inheritSize === 'auto') vars[roleVar('size', r.key)] = '0.88em';
    else if (r.inheritSize) vars[roleVar('size', r.key)] = '1em';
    else vars[roleVar('size', r.key)] = `${r.size}px`;
    const c = readableColor((textColors || {})[r.key], theme);
    vars[roleVar('color', r.key)] = c || null; // null → removed, CSS falls back to the theme color
    const st = (textStyles || {})[r.key] || {};
    vars[roleVar('weight', r.key)] = typeof st.bold === 'boolean' ? (st.bold ? '700' : '400') : null;
    vars[roleVar('style', r.key)] = typeof st.italic === 'boolean' ? (st.italic ? 'italic' : 'normal') : null;
    vars[roleVar('decoration', r.key)] = typeof st.underline === 'boolean' ? (st.underline ? 'underline' : 'none') : null;
  });
  const code = normalizeCodeStyle(codeStyle);
  // Backgrounds are used exactly as chosen; the default text / syntax colors switch to a readable palette for them.
  vars['--code-block-bg'] = code.blockBg || null;
  vars['--code-block-fg'] = code.blockBg ? (toneFor(code.blockBg) === 'dark' ? '#e6edf3' : '#24292f') : null;
  vars['--inline-code-bg'] = code.inlineBg || null;
  vars['--inline-code-fg'] = code.inlineBg
    ? toneFor(code.inlineBg) === 'dark' ? 'color-mix(in srgb, #ff7b72 80%, #ffffff)' : 'color-mix(in srgb, #cf222e 85%, #24292f)'
    : null;
  vars['--code-chrome'] = code.blockBg ? `color-mix(in srgb, ${vars['--code-block-fg']} 65%, transparent)` : null;
  vars['--code-line-height'] = String(code.lineHeight);
  vars['--line-height'] = String(Number(sizes.lineHeight) || DEFAULT_SIZES.lineHeight);
  return vars;
}
