import { cssId, isHex, bgTint } from './utils';

// Default Google Fonts library. Users can add/remove fonts in Settings → Fonts (stored in settings.fontLibrary).
// `weights` is the wght list requested from Google Fonts (null = family default only).
export const DEFAULT_GOOGLE_FONTS = [
  { name: 'Inter', category: 'sans', weights: '400;500;600;700' },
  { name: 'Roboto', category: 'sans', weights: '400;500;700' },
  { name: 'Open Sans', category: 'sans', weights: '400;600;700' },
  { name: 'Lato', category: 'sans', weights: '400;700' },
  { name: 'Source Sans 3', category: 'sans', weights: '400;600;700' },
  { name: 'Nunito', category: 'sans', weights: '400;600;700' },
  { name: 'Work Sans', category: 'sans', weights: '400;500;600;700' },
  { name: 'IBM Plex Sans', category: 'sans', weights: '400;500;600;700' },
  { name: 'Noto Sans', category: 'sans', weights: '400;500;600;700' },
  { name: 'Poppins', category: 'sans', weights: '400;500;600;700' },
  { name: 'Montserrat', category: 'sans', weights: '400;500;600;700' },
  { name: 'Raleway', category: 'sans', weights: '400;500;600;700' },
  { name: 'DM Sans', category: 'sans', weights: '400;500;700' },
  { name: 'Manrope', category: 'sans', weights: '400;500;600;700' },
  { name: 'Space Grotesk', category: 'sans', weights: '400;500;600;700' },
  { name: 'Outfit', category: 'sans', weights: '400;500;600;700' },
  { name: 'Plus Jakarta Sans', category: 'sans', weights: '400;500;600;700' },
  { name: 'Atkinson Hyperlegible', category: 'sans', weights: '400;700' },
  { name: 'Merriweather', category: 'serif', weights: '400;700' },
  { name: 'Lora', category: 'serif', weights: '400;500;600;700' },
  { name: 'Source Serif 4', category: 'serif', weights: '400;600;700' },
  { name: 'Libre Baskerville', category: 'serif', weights: '400;700' },
  { name: 'Playfair Display', category: 'serif', weights: '400;600;700' },
  { name: 'EB Garamond', category: 'serif', weights: '400;500;600;700' },
  { name: 'Crimson Pro', category: 'serif', weights: '400;600;700' },
  { name: 'Literata', category: 'serif', weights: '400;600;700' },
  { name: 'Newsreader', category: 'serif', weights: '400;600;700' },
  { name: 'Fraunces', category: 'serif', weights: '400;600;700' },
  { name: 'JetBrains Mono', category: 'mono', weights: '400;500;700' },
  { name: 'Fira Code', category: 'mono', weights: '400;500;700' },
  { name: 'Source Code Pro', category: 'mono', weights: '400;500;700' },
  { name: 'IBM Plex Mono', category: 'mono', weights: '400;500;700' },
  { name: 'Roboto Mono', category: 'mono', weights: '400;500;700' },
  { name: 'Space Mono', category: 'mono', weights: '400;700' },
  { name: 'Inconsolata', category: 'mono', weights: '400;500;700' },
  { name: 'Ubuntu Mono', category: 'mono', weights: '400;700' },
  { name: 'Courier Prime', category: 'mono', weights: '400;700' },
  { name: 'DM Mono', category: 'mono', weights: '400;500' },
  { name: 'Caveat', category: 'display', weights: '400;700' },
  { name: 'Patrick Hand', category: 'display', weights: '400' },
];

// Always available, can't be deleted — they are the fallback for every font.
export const SYSTEM_FONTS = [
  { name: 'System UI', category: 'system', system: true, fallbackFor: 'sans', css: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif' },
  { name: 'System Serif', category: 'system', system: true, fallbackFor: 'serif', css: 'ui-serif, Georgia, Cambria, "Times New Roman", serif' },
  { name: 'System Mono', category: 'system', system: true, fallbackFor: 'mono', css: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
];
const ALIASES = { Georgia: 'System Serif' }; // names used by earlier versions

export const FONT_GROUPS = [
  { id: 'sans', label: 'Sans serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'mono', label: 'Monospace' },
  { id: 'display', label: 'Handwriting & display' },
  { id: 'system', label: 'System (built-in)' },
];

const FALLBACK = {
  sans: SYSTEM_FONTS[0].css,
  serif: SYSTEM_FONTS[1].css,
  mono: SYSTEM_FONTS[2].css,
  display: `cursive, ${SYSTEM_FONTS[0].css}`,
};

/** The system font that replaces a deleted font of the given category. */
export function systemFallbackName(category) {
  return (SYSTEM_FONTS.find((f) => f.fallbackFor === category) || SYSTEM_FONTS[0]).name;
}

// Current user library — set from settings by useAppearance (and by Settings while editing).
let library = DEFAULT_GOOGLE_FONTS;
export function setFontLibrary(list) {
  library = Array.isArray(list) ? list : DEFAULT_GOOGLE_FONTS;
}

/** All fonts (user library + system), each group sorted alphabetically. */
export function allFonts(lib = library) {
  return [...lib, ...SYSTEM_FONTS];
}

export function fontsByGroup(lib = library) {
  return FONT_GROUPS.map((g) => ({
    ...g,
    fonts: allFonts(lib)
      .filter((f) => f.category === g.id)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
  })).filter((g) => g.fonts.length);
}

export function findFont(name, lib = library) {
  const n = ALIASES[name] || name;
  return allFonts(lib).find((x) => x.name === n) || null;
}

export function fontStack(name) {
  const f = findFont(name);
  if (!f) return FALLBACK.sans; // deleted / unknown font → system fallback
  if (f.css) return f.css;
  return `"${f.name}", ${FALLBACK[f.category] || FALLBACK.sans}`;
}

export function googleFontsCssUrl(name, weights) {
  const fam = name.trim().replace(/ /g, '+');
  return `https://fonts.googleapis.com/css2?family=${fam}${weights ? `:wght@${weights}` : ''}&display=swap`;
}

const loaded = new Set();
export function loadFont(name) {
  const f = findFont(name);
  if (!f || f.css) return;
  const key = `${f.name}|${f.weights || ''}`;
  if (loaded.has(key)) return;
  loaded.add(key);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = googleFontsCssUrl(f.name, f.weights);
  document.head.appendChild(link);
}

/** Accepts a family name, a fonts.google.com specimen URL, or a fonts.googleapis.com CSS URL. */
export function parseGoogleFontInput(input) {
  let v = String(input || '').trim();
  if (!v) return '';
  try {
    if (/^https?:\/\//i.test(v)) {
      const u = new URL(v);
      const fam = u.searchParams.get('family');
      if (fam) v = fam.split(':')[0];
      else {
        const m = u.pathname.match(/\/specimen\/([^/]+)/);
        if (m) v = m[1];
      }
    }
  } catch (_) {
    /* not a URL */
  }
  v = decodeURIComponent(v.replace(/\+/g, ' ')).split(':')[0];
  return v.replace(/\s+/g, ' ').trim();
}

export function guessCategory(name) {
  const n = name.toLowerCase();
  if (/mono|code|courier|console/.test(n)) return 'mono';
  if (/serif|garamond|baskerville|times|caslon|bodoni|didot|slab/.test(n) && !/sans/.test(n)) return 'serif';
  if (/hand|script|caveat|marker|brush|pacifico|lobster|dancing|kalam|indie/.test(n)) return 'display';
  return 'sans';
}

/**
 * Checks the family exists on Google Fonts and finds a weight set it supports.
 * Resolves { weights } or throws. Google answers 400 for unknown families / unsupported weights.
 */
export async function verifyGoogleFont(name) {
  const candidates = ['400;500;600;700', '400;600;700', '400;700', '400', null];
  let reachable = false;
  for (const w of candidates) {
    try {
      const res = await fetch(googleFontsCssUrl(name, w));
      reachable = true;
      if (res.ok) {
        const css = await res.text();
        if (css.includes('@font-face')) return { weights: w };
      }
    } catch (_) {
      /* network / CORS problem — try the next candidate */
    }
  }
  if (!reachable) throw new Error('Could not reach Google Fonts to check this font. Check your connection and try again.');
  throw new Error(`“${name}” wasn’t found on Google Fonts. Check the spelling (it must match the name on fonts.google.com).`);
}

/** CSS for user-defined inline text styles (Settings → Typography → Custom styles). */
export function buildCustomStyleCss(styles = []) {
  return styles
    .map((s) => {
      const r = [];
      if (s.font) r.push(`font-family: ${fontStack(s.font)}`);
      if (Number(s.sizePx) > 0) r.push(`font-size: ${Number(s.sizePx)}px`);
      if (s.weight) r.push(`font-weight: ${Number(s.weight)}`);
      if (s.italic) r.push('font-style: italic');
      if (s.underline) r.push('text-decoration: underline');
      if (s.uppercase) r.push('text-transform: uppercase');
      if (s.smallCaps) r.push('font-variant: small-caps');
      if (Number(s.letterSpacingPx)) r.push(`letter-spacing: ${Number(s.letterSpacingPx)}px`);
      if (isHex(s.color)) r.push(`color: ${s.color}`);
      if (isHex(s.bg)) r.push(`background-color: ${bgTint(s.bg, 28)}; border-radius: 3px; padding: 0 .15em`);
      return `.hm-cs-${cssId(s.id)} { ${r.join('; ')} }`;
    })
    .join('\n');
}
