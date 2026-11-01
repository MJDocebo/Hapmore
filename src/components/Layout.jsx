import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import EditorOverlays from '../editor/components/EditorOverlays';
import { useLocalStorage } from '../lib/hooks';
import { PanelLeftOpen } from './icons';

export default function Layout() {
  const [collapsed, setCollapsed] = useLocalStorage('hm.sidebar.collapsed', false);
  const [width, setWidth] = useLocalStorage('hm.sidebar.width', 272);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  // Editor plugins live outside React Router; they ask for navigation through this event.
  const navigate = useNavigate();
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
      <main className="main">
        <button
          type="button"
          className={`icon-btn sidebar-open ${collapsed ? 'is-visible' : ''}`}
          title="Show sidebar (Ctrl/⌘ + \)"
          onClick={() => (window.innerWidth < 860 ? setMobileOpen(true) : setCollapsed(false))}
        >
          <PanelLeftOpen size={18} />
        </button>
        <Outlet />
      </main>
      <EditorOverlays />
    </div>
  );
}
