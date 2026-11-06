import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PageRoutes from './PageRoutes';
import { TabPaneContext } from '../lib/tabContext';
import { useTabs } from '../store/useTabs';

/**
 * Restores a saved scroll offset after a reload. Notes load their content asynchronously, so keep trying until
 * the page is tall enough (or ~2 s pass, or you scroll yourself).
 */
function restoreScroll(el, top) {
  let raf = 0;
  const started = performance.now();
  const stop = () => {
    cancelAnimationFrame(raf);
    el.removeEventListener('wheel', stop);
    el.removeEventListener('touchstart', stop);
  };
  const tick = () => {
    el.scrollTop = top;
    if (Math.abs(el.scrollTop - top) < 2 || performance.now() - started > 2000) return stop();
    raf = requestAnimationFrame(tick);
  };
  el.addEventListener('wheel', stop, { passive: true });
  el.addEventListener('touchstart', stop, { passive: true });
  tick();
  return stop;
}

/**
 * One tab's page. It stays mounted while another tab is in front (hidden, inert), so drafts, editor state,
 * selection and scroll position are exactly as you left them. Each pane is its own scroll container and paints its
 * own space gradient.
 */
const TabPane = memo(function TabPane({ id, path, active }) {
  const ref = useRef(null);
  const [bg, setBgState] = useState(null);
  const setBg = useCallback((css) => setBgState(css || null), []);
  const [activations, setActivations] = useState(0);
  const lastFocus = useRef(null);
  const wasActive = useRef(active);
  const pathname = path.split('?')[0];

  // Hidden tabs can't be clicked, tabbed into or read by screen readers. Coming back puts the cursor where it was.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.inert = !active;
    if (active && !wasActive.current) {
      setActivations((n) => n + 1);
      const f = lastFocus.current;
      if (f && f.isConnected && el.contains(f)) f.focus({ preventScroll: true });
    }
    wasActive.current = active;
  }, [active]);

  // After a reload, go back to where this tab was scrolled.
  useLayoutEffect(() => {
    const top = useTabs.getState().tabs.find((t) => t.id === id)?.scroll;
    return top && ref.current ? restoreScroll(ref.current, top) : undefined;
  }, [id]);

  // A different page opened in this tab starts at the top (deep links to a block scroll once the note loads).
  const lastPath = useRef(pathname);
  useLayoutEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    if (ref.current) ref.current.scrollTop = 0;
  }, [pathname]);

  const saveTimer = useRef(0);
  useEffect(() => () => clearTimeout(saveTimer.current), []);
  const onScroll = () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => ref.current && useTabs.getState().setScroll(id, ref.current.scrollTop), 400);
  };

  const ctx = useMemo(() => ({ tabId: id, active, activations, setBg }), [id, active, activations, setBg]);
  return (
    <div
      ref={ref}
      className={`main tab-pane ${active ? 'is-active' : ''} ${bg ? 'has-space-bg' : ''}`}
      style={bg ? { '--space-bg': bg } : undefined}
      aria-hidden={active ? undefined : true}
      onScroll={onScroll}
      onFocus={(e) => {
        lastFocus.current = e.target;
      }}
    >
      <TabPaneContext.Provider value={ctx}>
        <PageRoutes location={path} />
      </TabPaneContext.Provider>
    </div>
  );
});

/**
 * All open tabs' pages, stacked; only the active one is visible. A tab's page is first created when you open that
 * tab (after a reload, background tabs load the first time you switch to them). Panes are kept in the order the
 * tabs were opened, never moved, so reordering the tab strip doesn't reload anything.
 */
export default function TabPanes() {
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const mounted = useRef(new Set());
  mounted.current.add(activeId);
  for (const k of mounted.current) if (!tabs.some((t) => t.id === k)) mounted.current.delete(k);
  const panes = tabs.filter((t) => mounted.current.has(t.id)).sort((a, b) => a.seq - b.seq);
  return (
    <div className="tab-panes">
      {panes.map((t) => (
        <TabPane key={t.id} id={t.id} path={t.path} active={t.id === activeId} />
      ))}
    </div>
  );
}
