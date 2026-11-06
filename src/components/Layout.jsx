import { useEffect, useLayoutEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import EditorOverlays from '../editor/components/EditorOverlays';
import { useLocalStorage } from '../lib/hooks';
import { PanelLeftOpen } from './icons';
import TabBar from './TabBar';
import TabPanes from './TabPanes';
import { registerTabHost, useTabs } from '../store/useTabs';

export default function Layout() {
  const [collapsed, setCollapsed] = useLocalStorage('hm.sidebar.collapsed', false);
  const [width, setWidth] = useLocalStorage('hm.sidebar.width', 272);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  // The active tab always shows the current URL. Layout effect: runs before paint, so switching never flashes.
  useLayoutEffect(() => {
    useTabs.getState().syncActive(location.pathname + location.search);
  }, [location.pathname, location.search]);

  // Editor plugins live outside React Router; they ask for navigation through this event.
  const navigate = useNavigate();
  useEffect(() => registerTabHost({ navigate }), [navigate]);
  useEffect(() => {
    const onNav = (e) => e.detail && e.detail.to && navigate(e.detail.to);
    window.addEventListener('hm:navigate', onNav);
    return () => window.removeEventListener('hm:navigate', onNav);
  }, [navigate]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        if (window.innerWidth < 860) setMobileOpen((v) => !v);
        else setCollapsed((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCollapsed]);

  return (
    <div className={`shell ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`} style={{ '--sidebar-w': `${width}px` }}>
      <Sidebar onCollapse={() => (window.innerWidth < 860 ? setMobileOpen(false) : setCollapsed(true))} width={width} onResize={setWidth} />
      {mobileOpen && <div className="shell-scrim" onClick={() => setMobileOpen(false)} />}
      <div className="main-col">
        <TabBar />
        <main className="tab-panes-host">
          <button
            type="button"
            className={`icon-btn sidebar-open ${collapsed ? 'is-visible' : ''}`}
            title="Show sidebar (Ctrl/⌘ + \)"
            onClick={() => (window.innerWidth < 860 ? setMobileOpen(true) : setCollapsed(false))}
          >
            <PanelLeftOpen size={18} />
          </button>
          <TabPanes />
        </main>
      </div>
      <EditorOverlays />
    </div>
  );
}
