import { useApp } from '../store/useApp';
import { useEffect, useLayoutEffect, useState, useRef, useMemo } from 'react';
import { debounce } from './utils';
import { bgCss, resolveBg } from './backgrounds';
import { resolveFolderKind, resolveFolderKinds } from './spaceKinds';
import { useTabPane } from './tabContext';

export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw);
    } catch (_) {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      /* ignore quota */
    }
  }, [key, value]);
  return [value, setValue];
}

/** Stable debounced callback that always calls the latest `fn`; flushed on unmount. */
export function useDebouncedCallback(fn, ms) {
  const ref = useRef(fn);
  ref.current = fn;
  const d = useMemo(() => debounce((...a) => ref.current(...a), ms), [ms]);
  useEffect(() => () => d.flush(), [d]);
  return d;
}

export const PAGE_WIDTHS = [
  { id: 'normal', label: 'Comfortable' },
  { id: 'wide', label: 'Wide' },
  { id: 'full', label: 'Full width' },
];

/**
 * Page width for workspace pages (home, folders, tags, notes) — Settings pages don't use it.
 * `override` is a per-note choice; falls back to the global setting. Use as <div className="page" data-width={…}>.
 */
export function usePageWidth(override) {
  const global = useApp((s) => s.settings.pageWidth);
  const w = override || global || 'normal';
  return PAGE_WIDTHS.some((p) => p.id === w) ? w : 'normal';
}

/**
 * Gradient background for Home (scope 'home') or a space (scope = folder kind, override = folder.background).
 * The gradient is painted by the tab's scroll container (see TabPanes), not the page: a scroll container's own
 * background stays put while content scrolls, which gives a "fixed" backdrop without `background-attachment:
 * fixed` — iPadOS / iOS Safari doesn't support that and cut the gradient off partway down the page.
 * Returns props to spread on the `.page` element (a class for styling tweaks only).
 */
export function useSpaceBackground(scope, override) {
  const backgrounds = useApp((s) => s.settings.backgrounds);
  const css = bgCss(resolveBg(backgrounds, scope, override));
  const { setBg } = useTabPane(); // each in-app tab paints its own background
  useLayoutEffect(() => {
    if (!setBg) return undefined;
    setBg(css || null);
    return () => setBg(null);
  }, [css, setBg]);
  return css ? { className: 'has-space-bg', style: undefined } : { className: '', style: undefined };
}

/** Space types with the user's custom names and icons (Settings → Spaces). */
export function useFolderKinds() {
  const spaceKinds = useApp((st) => st.settings.spaceKinds);
  return useMemo(() => resolveFolderKinds(spaceKinds), [spaceKinds]);
}

/** One space type's effective { kind, label, singular, newName, icon }. */
export function useFolderKind(kind) {
  const spaceKinds = useApp((st) => st.settings.spaceKinds);
  return useMemo(() => resolveFolderKind(spaceKinds, kind), [spaceKinds, kind]);
}
