// In-app page tabs (not browser tabs). The active tab always shows the current URL, so normal navigation changes
// the page in the current tab, just like a browser. Every tab's page stays mounted while you work in another one
// (see components/TabPanes), so unsaved typing, cursor position and scroll survive switching tabs.
// Tabs persist in localStorage, so they survive reloads on this device.
import { create } from 'zustand';

export const MAX_TABS = 5;
const KEY = 'hm.tabs.v1';
const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Notes and spaces can only be open in one tab at a time (two live editors on the same note would overwrite each
 * other's changes). Returns '/n/<id>' or '/f/<id>' for those pages, else null.
 */
export function pageKey(path) {
  const m = /^\/(n|f)\/([^/?#]+)/.exec(path || '');
  return m ? `/${m[1]}/${m[2]}` : null;
}
const samePage = (a, b) => {
  const k = pageKey(a);
  return k ? k === pageKey(b) : a === b;
};

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    const tabs = [];
    for (const t of Array.isArray(v?.tabs) ? v.tabs : []) {
      if (!t || typeof t.path !== 'string' || !t.path.startsWith('/') || tabs.length >= MAX_TABS) continue;
      if (pageKey(t.path) && tabs.some((x) => samePage(x.path, t.path))) continue;
      tabs.push({ id: typeof t.id === 'string' ? t.id : uid(), seq: tabs.length, path: t.path, scroll: Number(t.scroll) || 0 });
    }
    if (tabs.length) return { tabs, activeId: tabs.some((t) => t.id === v.activeId) ? v.activeId : tabs[0].id };
  } catch (_) {
    /* ignore corrupt storage */
  }
  const id = uid();
  return { tabs: [{ id, seq: 0, path: '/', scroll: 0 }], activeId: id };
}

// Registered by Layout: the router's navigate().
let navigateFn = null;
export function registerTabHost({ navigate }) {
  if (navigate) navigateFn = navigate;
}

const nextSeq = (tabs) => tabs.reduce((m, t) => Math.max(m, t.seq), -1) + 1;

export const useTabs = create((set, get) => ({
  ...load(),

  /**
   * Called whenever the URL changes. The active tab shows the new page, unless that note/space is already open in
   * another tab: then that tab comes to the front instead (so browser Back/Forward also moves between tabs).
   */
  syncActive(path) {
    const { tabs, activeId } = get();
    const cur = tabs.find((t) => t.id === activeId);
    if (!cur || cur.path === path) return;
    const other = pageKey(path) && tabs.find((t) => t.id !== activeId && samePage(t.path, path));
    if (other) {
      set({ activeId: other.id, tabs: tabs.map((t) => (t.id === other.id ? { ...t, path } : t)) });
      return;
    }
    set({ tabs: tabs.map((t) => (t.id === activeId ? { ...t, path, scroll: 0 } : t)) });
  },

  /** Remembers a tab's scroll position for the next reload (while the app is open, tabs keep their own). */
  setScroll(id, top) {
    const { tabs } = get();
    const t = tabs.find((x) => x.id === id);
    if (!t || Math.abs(t.scroll - top) < 1) return;
    set({ tabs: tabs.map((x) => (x.id === id ? { ...x, scroll: top } : x)) });
  },

  activate(id) {
    const { tabs, activeId } = get();
    const next = tabs.find((t) => t.id === id);
    if (!next || id === activeId) return;
    set({ activeId: id });
    navigateFn?.(next.path, { replace: true });
  },

  /**
   * Opens `path` in a new tab and switches to it. A page that's already open just gets focused (unless
   * `duplicate`, which only applies to pages without an editor, e.g. a second Home tab).
   * Returns 'opened' | 'focused' | 'full'.
   */
  open(path, { duplicate = false } = {}) {
    const { tabs, activeId } = get();
    const existing = (!duplicate || pageKey(path)) && tabs.find((t) => samePage(t.path, path));
    if (existing) {
      set({ activeId: existing.id, tabs: tabs.map((t) => (t.id === existing.id ? { ...t, path } : t)) });
      navigateFn?.(path, existing.id === activeId ? undefined : { replace: true });
      return 'focused';
    }
    if (tabs.length >= MAX_TABS) return 'full';
    const tab = { id: uid(), seq: nextSeq(tabs), path, scroll: 0 };
    const i = tabs.findIndex((t) => t.id === activeId);
    const nextTabs = [...tabs];
    nextTabs.splice(i + 1, 0, tab);
    set({ tabs: nextTabs, activeId: tab.id });
    navigateFn?.(path);
    return 'opened';
  },

  close(id) {
    const { tabs, activeId } = get();
    if (tabs.length <= 1) return;
    const i = tabs.findIndex((t) => t.id === id);
    if (i < 0) return;
    const rest = tabs.filter((t) => t.id !== id);
    if (id !== activeId) return set({ tabs: rest });
    const next = rest[Math.min(i, rest.length - 1)];
    set({ tabs: rest, activeId: next.id });
    navigateFn?.(next.path, { replace: true });
  },

  /** Drops background tabs whose page no longer exists (e.g. a deleted note). The active tab is left alone. */
  prune(isValid) {
    const { tabs, activeId } = get();
    const keep = tabs.filter((t) => t.id === activeId || isValid(t.path));
    if (keep.length !== tabs.length) set({ tabs: keep });
  },

  /** Reorders the tab strip only; the pages themselves stay put, so nothing reloads (e.g. an open PDF). */
  move(id, toIndex) {
    const tabs = [...get().tabs];
    const from = tabs.findIndex((t) => t.id === id);
    if (from < 0) return;
    const [t] = tabs.splice(from, 1);
    tabs.splice(Math.max(0, Math.min(toIndex, tabs.length)), 0, t);
    set({ tabs });
  },

  /** Back to a single tab (on sign-out, so the next account doesn't inherit open pages). */
  reset(path = '/') {
    const id = uid();
    set({ tabs: [{ id, seq: 0, path, scroll: 0 }], activeId: id });
  },
}));

useTabs.subscribe((s, prev) => {
  if (s.tabs === prev.tabs && s.activeId === prev.activeId) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ tabs: s.tabs, activeId: s.activeId }));
  } catch (_) {
    /* storage full / private mode */
  }
});

// Opened from a link or a reload: line the tabs up with the URL before anything renders.
if (typeof window !== 'undefined' && window.location) useTabs.getState().syncActive(window.location.pathname + window.location.search);
