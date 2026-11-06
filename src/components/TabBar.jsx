import { useEffect, useState } from 'react';
import { useApp } from '../store/useApp';
import { MAX_TABS, useTabs } from '../store/useTabs';

export { handleTabClick, openInTab } from '../lib/tabs';
import EmojiIcon from './EmojiIcon';
import FolderIcon from './FolderIcon';
import { noteTypeMeta } from '../lib/noteTypes';
import { Archive, Hash, Home, Plus, Settings, X } from './icons';

function useTabInfo(path) {
  const notes = useApp((s) => s.notes);
  const folders = useApp((s) => s.folders);
  const [pathname] = path.split('?');
  let m = pathname.match(/^\/n\/([^/]+)/);
  if (m) {
    const n = notes.find((x) => x.id === m[1]);
    if (!n) return { label: 'Page not found', icon: null };
    const TypeIcon = noteTypeMeta(n.type).Icon;
    return { label: n.title || 'Untitled', icon: n.icon ? <EmojiIcon value={n.icon} size={14} /> : <TypeIcon size={14} /> };
  }
  m = pathname.match(/^\/f\/([^/]+)/);
  if (m) {
    const f = folders.find((x) => x.id === m[1]);
    if (!f) return { label: 'Space not found', icon: null };
    return { label: f.code || f.name || 'Untitled', icon: <FolderIcon folder={f} size={14} fallback /> };
  }
  m = pathname.match(/^\/tags\/([^/]+)/);
  if (m) return { label: `#${decodeURIComponent(m[1])}`, icon: <Hash size={14} /> };
  if (pathname.startsWith('/settings')) return { label: 'Settings', icon: <Settings size={14} /> };
  if (pathname.startsWith('/archive')) return { label: 'Archived tasks', icon: <Archive size={14} /> };
  return { label: 'Home', icon: <Home size={14} /> };
}

// Middle-click closes a tab; stop the browser's autoscroll from starting on mousedown.
const noAutoscroll = (e) => e.button === 1 && e.preventDefault();

function Tab({ tab, index, active, onlyTab, dragId, setDragId }) {
  const { label, icon } = useTabInfo(tab.path);
  const { activate, close, move } = useTabs.getState();
  const [over, setOver] = useState(false);
  return (
    <div
      role="tab"
      tabIndex={0}
      aria-selected={active}
      className={`app-tab ${active ? 'is-active' : ''} ${over ? 'is-drop' : ''}`}
      title={label}
      draggable
      onDragStart={(e) => {
        setDragId(tab.id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', label);
      }}
      onDragEnd={() => setDragId(null)}
      onDragOver={(e) => {
        if (!dragId || dragId === tab.id) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (dragId && dragId !== tab.id) move(dragId, index);
        setDragId(null);
      }}
      onClick={() => activate(tab.id)}
      onMouseDown={noAutoscroll}
      onAuxClick={(e) => e.button === 1 && !onlyTab && close(tab.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate(tab.id);
        }
      }}
    >
      <span className="app-tab-icon">{icon}</span>
      <span className="app-tab-label">{label}</span>
      {!onlyTab && (
        <button
          type="button"
          className="app-tab-close"
          title="Close tab"
          aria-label={`Close ${label}`}
          onClick={(e) => {
            e.stopPropagation();
            close(tab.id);
          }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

/** Tab strip above the page. Hidden while only one tab is open. */
export default function TabBar() {
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const notes = useApp((s) => s.notes);
  const folders = useApp((s) => s.folders);
  const dataReady = useApp((s) => s.dataReady);
  const [dragId, setDragId] = useState(null);

  // Close background tabs whose note / space was deleted.
  useEffect(() => {
    if (!dataReady) return;
    const noteIds = new Set(notes.map((n) => n.id));
    const folderIds = new Set(folders.map((f) => f.id));
    useTabs.getState().prune((path) => {
      const m = path.match(/^\/(n|f)\/([^/?#]+)/);
      if (!m) return true;
      return m[1] === 'n' ? noteIds.has(m[2]) : folderIds.has(m[2]);
    });
  }, [notes, folders, dataReady]);

  if (tabs.length < 2) return null;
  return (
    <div className="app-tabs" role="tablist" aria-label="Open pages">
      {tabs.map((t, i) => (
        <Tab key={t.id} tab={t} index={i} active={t.id === activeId} onlyTab={tabs.length === 1} dragId={dragId} setDragId={setDragId} />
      ))}
      {tabs.length < MAX_TABS && (
        <button type="button" className="icon-btn xs app-tab-new" title="New tab" onClick={() => useTabs.getState().open('/', { duplicate: true })}>
          <Plus size={14} />
        </button>
      )}
    </div>
  );
}
