import { DEFAULT_GOOGLE_FONTS } from './fonts';
import { DEFAULT_CODE_STYLE, DEFAULT_FONTS, DEFAULT_SIZES, DEFAULT_TEXT_COLORS, DEFAULT_TEXT_STYLES, migrateTypography, normalizeCodeStyle, normalizeTextStyles } from './typography';
import { DEFAULT_BACKGROUNDS, mergeBackgrounds } from './backgrounds';
import { BG_INTENSITIES } from './utils';

export const DEFAULT_ZONES = [
  { title: 'Core Concepts & Definitions', emoji: '📘', color: '#337ea9' },
  { title: 'Code & Implementation', emoji: '💻', color: '#448361' },
  { title: 'Step-by-step Trace', emoji: '🔍', color: '#cb912f' },
  { title: 'Edge Cases & Other Considerations', emoji: '⚠️', color: '#d44c47' },
];

export const ZONE_TEMPLATES = [
  { id: 'applied', name: 'Applied / systems course', zones: DEFAULT_ZONES },
  {
    id: 'theory',
    name: 'Theory course',
    zones: [
      { title: 'Definitions & Theorems', emoji: '📐', color: '#337ea9' },
      { title: 'Proofs & Derivations', emoji: '✍️', color: '#9065b0' },
      { title: 'Worked Examples', emoji: '🧮', color: '#448361' },
      { title: 'Intuition & Open Questions', emoji: '💭', color: '#cb912f' },
    ],
  },
  {
    id: 'paper',
    name: 'Research paper reading',
    zones: [
      { title: 'Problem & Motivation', emoji: '🎯', color: '#d9730d' },
      { title: 'Method & Contributions', emoji: '🧪', color: '#337ea9' },
      { title: 'Results & Evaluation', emoji: '📊', color: '#448361' },
      { title: 'Critique & Follow-ups', emoji: '🧐', color: '#c14c8a' },
    ],
  },
  {
    id: 'project',
    name: 'Project planning',
    zones: [
      { title: 'Goals & Requirements', emoji: '🏁', color: '#448361' },
      { title: 'Design & Architecture', emoji: '🏗️', color: '#337ea9' },
      { title: 'Tasks & Progress', emoji: '✅', color: '#cb912f' },
      { title: 'Risks & Questions', emoji: '❓', color: '#d44c47' },
    ],
  },
  {
    id: 'algorithms',
    name: 'Algorithms',
    zones: [
      { title: 'Problem & Intuition', emoji: '💡', color: '#cb912f' },
      { title: 'Pseudocode / Code', emoji: '💻', color: '#448361' },
      { title: 'Correctness & Complexity', emoji: '📈', color: '#337ea9' },
      { title: 'Examples & Edge Cases', emoji: '🧩', color: '#d44c47' },
    ],
  },
];

export const DEFAULT_COLORS = [
  { id: 'gray', name: 'Gray', hex: '#787774' },
  { id: 'brown', name: 'Brown', hex: '#9f6b53' },
  { id: 'orange', name: 'Orange', hex: '#d9730d' },
  { id: 'yellow', name: 'Yellow', hex: '#cb912f' },
  { id: 'green', name: 'Green', hex: '#448361' },
  { id: 'blue', name: 'Blue', hex: '#337ea9' },
  { id: 'purple', name: 'Purple', hex: '#9065b0' },
  { id: 'pink', name: 'Pink', hex: '#c14c8a' },
  { id: 'red', name: 'Red', hex: '#d44c47' },
];

export const BLANK_STYLE = {
  name: 'New style', font: '', weight: 600, italic: false, underline: false, uppercase: false, smallCaps: false,
  sizePx: 0, // 0 = same size as the surrounding text
  letterSpacingPx: 0,
  color: '#2383e2', bg: '',
  wrapOpen: '', // typing shortcut, e.g. "~" → ~my text~ ; empty = no shortcut
  wrapClose: '', // empty = same as wrapOpen
};

export const DEFAULT_CUSTOM_STYLES = [
  { ...BLANK_STYLE, id: 'term', name: 'Key term', weight: 650, color: '#337ea9', wrapOpen: '~', wrapClose: '' },
  { ...BLANK_STYLE, id: 'exam', name: 'Exam alert', weight: 700, uppercase: true, letterSpacingPx: 0.5, color: '#d44c47', bg: '#d44c47', wrapOpen: '!!', wrapClose: '' },
  { ...BLANK_STYLE, id: 'aside', name: 'Aside', font: 'Caveat', sizePx: 20, weight: 400, color: '#9065b0', wrapOpen: '<<', wrapClose: '>>' },
];

// ── Text-style typing shortcuts ──────────────────────────────────────────────
// Characters already used by the editor (or too common in prose) can't be wrappers.
const RESERVED_CHARS = {
  '\\': 'opens the block menu',
  ':': 'is used for emoji',
  $: 'is used for math',
  '`': 'is used for inline code',
  '*': 'is used for **bold** / *italic*',
  _: 'is used for __bold__ / _italic_',
  '#': 'is used for headings and #tags',
  '-': 'is used for lists and dividers',
  '[': 'is used for task lists',
  ']': 'is used for task lists',
  '/': 'is too common in normal text (URLs, and/or)',
  "'": 'is too common in normal text',
  '"': 'is too common in normal text',
  '.': 'is too common in normal text',
  ',': 'is too common in normal text',
  ';': 'is too common in normal text',
  '?': 'is too common in normal text',
  '(': 'is too common in normal text',
  ')': 'is too common in normal text',
};
const RESERVED_SEQUENCES = { '~~': 'is used for ~~strikethrough~~' };

/** Returns an error message, or '' when the wrapper pair is usable. */
export function validateWrapper(open, close, styles = [], selfId = null) {
  const o = open || '';
  const c = close || o;
  if (!o && !close) return '';
  if (!o) return 'Set the opening characters first.';
  for (const part of [o, c]) {
    if (part.length > 3) return 'Use at most 3 characters.';
    if (/\s/.test(part)) return 'Spaces aren’t allowed.';
    if (/[\p{L}\p{N}]/u.test(part)) return 'Letters and numbers aren’t allowed (they would trigger while typing words).';
    for (const ch of part) if (RESERVED_CHARS[ch]) return `“${ch}” ${RESERVED_CHARS[ch]}.`;
    for (const [seq, why] of Object.entries(RESERVED_SEQUENCES)) if (part.includes(seq)) return `“${seq}” ${why}.`;
  }
  const clash = styles.find((s) => s.id !== selfId && s.wrapOpen && s.wrapOpen === o && (s.wrapClose || s.wrapOpen) === c);
  if (clash) return `“${clash.name}” already uses ${o}…${c}.`;
  return '';
}


export const DEFAULT_SETTINGS = {
  theme: 'system', // 'light' | 'dark' | 'system'
  pageWidth: 'normal', // 'normal' | 'wide' | 'full'
  fonts: DEFAULT_FONTS, // per typography role ('' = same as the role it follows)
  sizes: DEFAULT_SIZES, // px per role (0 = same as the role it follows) + lineHeight
  textColors: DEFAULT_TEXT_COLORS, // hex per role ('' = theme default)
  textStyles: DEFAULT_TEXT_STYLES, // per role { bold?, italic?, underline? } (absent = role default)
  codeStyle: DEFAULT_CODE_STYLE, // code backgrounds, code-block line spacing and line numbers
  colorPresets: DEFAULT_COLORS,
  customStyles: DEFAULT_CUSTOM_STYLES,
  zoneDefaults: DEFAULT_ZONES,
  fontLibrary: DEFAULT_GOOGLE_FONTS,
  backgrounds: DEFAULT_BACKGROUNDS, // gradient per scope: home | course | project | research
  bgIntensity: 'strong', // how light highlight / block / callout / zone backgrounds are: xlight | light | medium | strong
};

/** Fills new fields on saved styles; built-in styles saved before shortcuts existed get their default shortcut. */
function upgradeStyle(x, bodyPx = 16) {
  const builtIn = x.wrapOpen === undefined && DEFAULT_CUSTOM_STYLES.find((d) => d.id === x.id);
  const out = { ...BLANK_STYLE, ...(builtIn ? { wrapOpen: builtIn.wrapOpen, wrapClose: builtIn.wrapClose } : {}), ...x };
  // Earlier versions stored em multipliers; convert once to px.
  if (x.sizePx === undefined && x.size !== undefined) out.sizePx = Number(x.size) && Number(x.size) !== 1 ? Math.round(Number(x.size) * bodyPx) : 0;
  if (x.letterSpacingPx === undefined && x.letterSpacing !== undefined) out.letterSpacingPx = Math.round(Number(x.letterSpacing || 0) * bodyPx * 2) / 2;
  delete out.size;
  delete out.letterSpacing;
  return out;
}

export function mergeSettings(s = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    ...migrateTypography(s.fonts, s.sizes),
    textColors: { ...DEFAULT_TEXT_COLORS, ...(s.textColors || {}) },
    textStyles: normalizeTextStyles(s.textStyles),
    codeStyle: normalizeCodeStyle(s.codeStyle),
    colorPresets: Array.isArray(s.colorPresets) ? s.colorPresets : DEFAULT_COLORS,
    customStyles: Array.isArray(s.customStyles) ? s.customStyles.map((x) => upgradeStyle(x, Number(s.sizes?.body) || 16)) : DEFAULT_CUSTOM_STYLES,
    fontLibrary: Array.isArray(s.fontLibrary) ? s.fontLibrary.filter((f) => f && f.name && !f.system) : DEFAULT_GOOGLE_FONTS,
    zoneDefaults: Array.isArray(s.zoneDefaults) && s.zoneDefaults.length === 4 ? s.zoneDefaults : DEFAULT_ZONES,
    backgrounds: mergeBackgrounds(s.backgrounds),
    bgIntensity: BG_INTENSITIES.some((x) => x.id === s.bgIntensity) ? s.bgIntensity : 'strong',
  };
}

export const FOLDER_KINDS = [
  { kind: 'course', label: 'Courses', singular: 'Course', newName: 'New course' },
  { kind: 'project', label: 'Projects', singular: 'Project', newName: 'New project' },
  { kind: 'research', label: 'Research', singular: 'Research topic', newName: 'New research topic' },
];

export function makeFourZoneContent(zoneDefaults = DEFAULT_ZONES) {
  return {
    layout: 'grid', // 'grid' | 'primary' | 'columns' | 'stacked'
    primary: 0,
    zones: [0, 1, 2, 3].map((i) => ({
      id: `z${i + 1}`,
      title: zoneDefaults[i]?.title ?? `Zone ${i + 1}`,
      emoji: zoneDefaults[i]?.emoji ?? '',
      color: zoneDefaults[i]?.color ?? null,
      doc: null,
    })),
  };
}

export function normalizeFourZone(content, zoneDefaults) {
  const base = makeFourZoneContent(zoneDefaults);
  if (!content || !Array.isArray(content.zones)) return base;
  return {
    layout: ['grid', 'primary', 'columns', 'stacked'].includes(content.layout) ? content.layout : 'grid',
    primary: Number.isInteger(content.primary) ? Math.min(3, Math.max(0, content.primary)) : 0,
    zones: base.zones.map((z, i) => ({ ...z, ...(content.zones[i] || {}) })),
  };
}

export const COVER_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #43cea2 0%, #185a9d 100%)',
  'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  'linear-gradient(135deg, #fc5c7d 0%, #6a82fb 100%)',
  'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
  'linear-gradient(120deg, #e0c3fc 0%, #8ec5fc 100%)',
  'linear-gradient(135deg, #232526 0%, #414345 100%)',
  'radial-gradient(circle at 20% 20%, #fbc2eb 0%, #a6c1ee 60%, #6a85b6 100%)',
  'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
];

export const COVER_COLORS = ['#e3e2e0', '#eee0da', '#fadec9', '#fdecc8', '#dbeddb', '#d3e5ef', '#e8deee', '#f5e0e9', '#ffe2dd', '#2f3437'];

export function randomCover() {
  return { kind: 'gradient', value: COVER_GRADIENTS[Math.floor(Math.random() * COVER_GRADIENTS.length)], posY: 50 };
}
