import { useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../store/useApp';
import { FOLDER_KINDS } from '../lib/defaults';
import { emailToUsername } from '../lib/supabase';
import { useLocalStorage } from '../lib/hooks';
import { clamp, tagStyle } from '../lib/utils';
import EmojiIcon from './EmojiIcon';
import FolderIcon from './FolderIcon';
import Menu from './Menu';
import {
  ChevronDown, ChevronRight, Plus, More, Home, Settings, LogOut, PanelLeftClose, Search, X, FileText, LayoutGrid, Trash, Copy, Pencil, LinkIcon,
} from './icons';
import { noteTypeMenuItems, noteTypeMeta } from '../lib/noteTypes';
import { copyNoteLink } from '../lib/links';

const NOTE_MIME = 'application/x-hapmore-note';

/** Active ids from the URL (/n/:noteId, /f/:folderId) — the sidebar lives outside those routes. */
function useActiveIds() {
  const { pathname } = useLocation();
  const m = pathname.match(/^\/(n|f)\/([^/?#]+)/);
  return { noteId: m && m[1] === 'n' ? m[2] : null, folderId: m && m[1] === 'f' ? m[2] : null };
}
const FOLDER_MIME = 'application/x-hapmore-folder';

function hasType(e, mime) {
  return Array.from(e.dataTransfer?.types || []).includes(mime);
}

function NoteRow({ note, depthClass = '', onDropNote, dropState, setDropState }) {
  const navigate = useNavigate();
  const { noteId } = useActiveIds();
  const duplicateNote = useApp((s) => s.duplicateNote);
  const deleteNote = useApp((s) => s.deleteNote);
  const [menu, setMenu] = useState(null);
  const TypeIcon = noteTypeMeta(note.type).Icon;
  const active = noteId === note.id;
  const isTarget = dropState?.type === 'note' && dropState.id === note.id;

  return (
    <div
      className={`nav-row note-row ${depthClass} ${active ? 'is-active' : ''} ${isTarget ? 'is-drop-before' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(NOTE_MIME, note.id);
        e.dataTransfer.setData('text/plain', note.title || 'Untitled');
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => setDropState(null)}
      onDragOver={(e) => {
        if (!hasType(e, NOTE_MIME)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        if (!isTarget) setDropState({ type: 'note', id: note.id });
      }}
      onDrop={(e) => {
        if (!hasType(e, NOTE_MIME)) return;
        e.preventDefault();
        e.stopPropagation();
        setDropState(null);
        onDropNote(e.dataTransfer.getData(NOTE_MIME), note.folder_id, note.id);
      }}
      onClick={() => navigate(`/n/${note.id}`)}
      title={note.title || 'Untitled'}
    >
      <span className="nav-icon">
        {note.icon ? <EmojiIcon value={note.icon} size={15} /> : <TypeIcon size={15} />}
      </span>
      <span className="nav-label">{note.title || 'Untitled'}</span>
      <span className="nav-actions">
        <button type="button" className="icon-btn xs" title="More" onClick={(e) => { e.stopPropagation(); setMenu(e.currentTarget); }}>
          <More size={14} />
        </button>
      </span>
      {menu && (
        <Menu
          anchor={menu}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Copy link', icon: LinkIcon, onClick: () => copyNoteLink(note.id) },
            { label: 'Duplicate', icon: Copy, onClick: async () => { const n = await duplicateNote(note.id); if (n) navigate(`/n/${n.id}`); } },
            { divider: true },
            {
              label: 'Delete',
              icon: Trash,
              danger: true,
              onClick: async () => {
                if (!(await useApp.getState().confirm({ title: `Delete “${note.title || 'Untitled'}”?`, message: 'The note and its annotations will be permanently deleted. This can’t be undone.', confirmLabel: 'Delete note', danger: true }))) return;
                await deleteNote(note.id);
                if (active) navigate(`/f/${note.folder_id}`);
              },
            },
          ]}
        />
      )}
    </div>
  );
}

function FolderRow({ folder, notes, onDropNote, onDropFolder, dropState, setDropState }) {
  const navigate = useNavigate();
  const { folderId } = useActiveIds();
  const updateFolder = useApp((s) => s.updateFolder);
  const deleteFolder = useApp((s) => s.deleteFolder);
  const createNote = useApp((s) => s.createNote);
  const [addMenu, setAddMenu] = useState(null);
  const [moreMenu, setMoreMenu] = useState(null);
  const expandTimer = useRef(null);
  const active = folderId === folder.id;
  const isNoteTarget = dropState?.type === 'folder-into' && dropState.id === folder.id;
  const isFolderTarget = dropState?.type === 'folder-before' && dropState.id === folder.id;

  const newNote = async (type) => {
    const n = await createNote(folder.id, type);
    if (n) navigate(`/n/${n.id}`);
  };

  const clearTimer = () => {
    clearTimeout(expandTimer.current);
    expandTimer.current = null;
  };

  return (
    <div className="nav-folder">
      <div
        className={`nav-row folder-row ${active ? 'is-active' : ''} ${isNoteTarget ? 'is-drop-into' : ''} ${isFolderTarget ? 'is-drop-before' : ''}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(FOLDER_MIME, folder.id);
          e.dataTransfer.setData('text/plain', folder.name);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => setDropState(null)}
        onDragOver={(e) => {
          if (hasType(e, NOTE_MIME)) {
            e.preventDefault();
            e.stopPropagation();
            if (!isNoteTarget) setDropState({ type: 'folder-into', id: folder.id });
            // Hovering a collapsed folder while dragging a note expands it.
            if (folder.collapsed && !expandTimer.current) {
              expandTimer.current = setTimeout(() => {
                updateFolder(folder.id, { collapsed: false });
                expandTimer.current = null;
              }, 700);
            }
          } else if (hasType(e, FOLDER_MIME)) {
            e.preventDefault();
            e.stopPropagation();
            if (!isFolderTarget) setDropState({ type: 'folder-before', id: folder.id });
          }
        }}
        onDragLeave={clearTimer}
        onDrop={(e) => {
          clearTimer();
          setDropState(null);
          if (hasType(e, NOTE_MIME)) {
            e.preventDefault();
            e.stopPropagation();
            onDropNote(e.dataTransfer.getData(NOTE_MIME), folder.id, null);
          } else if (hasType(e, FOLDER_MIME)) {
            e.preventDefault();
            e.stopPropagation();
            onDropFolder(e.dataTransfer.getData(FOLDER_MIME), folder.kind, folder.id);
          }
        }}
        onClick={() => navigate(`/f/${folder.id}`)}
        title={folder.code ? `${folder.code} · ${folder.name}` : folder.name}
      >
        <button
          type="button"
          className="icon-btn xs nav-chevron"
          title={folder.collapsed ? 'Expand' : 'Collapse'}
          onClick={(e) => {
            e.stopPropagation();
            updateFolder(folder.id, { collapsed: !folder.collapsed });
          }}
        >
          {folder.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <span className="nav-icon">
          <FolderIcon folder={folder} size={15} fallback />
        </span>
        <span className="nav-label">
          {folder.code && <span className="nav-code">{folder.code}</span>}
          {folder.name || 'Untitled'}
        </span>
        <span className="nav-count">{notes.length || ''}</span>
        <span className="nav-actions">
          <button type="button" className="icon-btn xs" title="More" onClick={(e) => { e.stopPropagation(); setMoreMenu(e.currentTarget); }}>
            <More size={14} />
          </button>
          <button type="button" className="icon-btn xs" title="Add new" onClick={(e) => { e.stopPropagation(); setAddMenu(e.currentTarget); }}>
            <Plus size={14} />
          </button>
        </span>
      </div>
      {addMenu && (
        <Menu
          anchor={addMenu}
          onClose={() => setAddMenu(null)}
          title="Add new"
          items={noteTypeMenuItems(newNote)}
        />
      )}
      {moreMenu && (
        <Menu
          anchor={moreMenu}
          onClose={() => setMoreMenu(null)}
          items={[
            { label: 'Open & edit details', icon: Pencil, onClick: () => navigate(`/f/${folder.id}`) },
            ...FOLDER_KINDS.filter((k) => k.kind !== folder.kind).map((k) => ({
              label: `Move to ${k.label}`,
              icon: ChevronRight,
              onClick: () => onDropFolder(folder.id, k.kind, null),
            })),
            { divider: true },
            {
              label: 'Delete folder',
              icon: Trash,
              danger: true,
              onClick: async () => {
                if (!(await useApp.getState().confirm({ title: `Delete “${folder.name || 'Untitled'}”?`, message: `This deletes the folder and its ${notes.length} note${notes.length === 1 ? '' : 's'}, tasks and annotations. This can’t be undone.`, confirmLabel: 'Delete folder', danger: true }))) return;
                await deleteFolder(folder.id);
                if (active) navigate('/');
              },
            },
          ]}
        />
      )}
      {!folder.collapsed && (
        <div
          className="nav-children"
          onDragOver={(e) => {
            if (hasType(e, NOTE_MIME)) {
              e.preventDefault();
              if (!isNoteTarget) setDropState({ type: 'folder-into', id: folder.id });
            }
          }}
          onDrop={(e) => {
            if (!hasType(e, NOTE_MIME)) return;
            e.preventDefault();
            setDropState(null);
            onDropNote(e.dataTransfer.getData(NOTE_MIME), folder.id, null);
          }}
        >
          {notes.length === 0 && (
            <button type="button" className="nav-empty" onClick={() => newNote('standard')}>
              <Plus size={13} /> Add a note
            </button>
          )}
          {notes.map((n) => (
            <NoteRow key={n.id} note={n} depthClass="depth-1" onDropNote={onDropNote} dropState={dropState} setDropState={setDropState} />
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ meta, folders, notesByFolder, onDropNote, onDropFolder, dropState, setDropState }) {
  const [open, setOpen] = useLocalStorage(`hm.section.${meta.kind}`, true);
  const createFolder = useApp((s) => s.createFolder);
  const navigate = useNavigate();
  const isTarget = dropState?.type === 'section' && dropState.id === meta.kind;

  return (
    <section className="nav-section">
      <div
        className={`nav-section-head ${isTarget ? 'is-drop-into' : ''}`}
        onDragOver={(e) => {
          if (!hasType(e, FOLDER_MIME)) return;
          e.preventDefault();
          if (!isTarget) setDropState({ type: 'section', id: meta.kind });
        }}
        onDrop={(e) => {
          if (!hasType(e, FOLDER_MIME)) return;
          e.preventDefault();
          setDropState(null);
          onDropFolder(e.dataTransfer.getData(FOLDER_MIME), meta.kind, null);
          setOpen(true);
        }}
      >
        <button type="button" className="nav-section-toggle" onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <span>{meta.label}</span>
        </button>
        <button
          type="button"
          className="icon-btn xs"
          title={`New ${meta.singular.toLowerCase()}`}
          onClick={async () => {
            const f = await createFolder(meta.kind);
            setOpen(true);
            if (f) navigate(`/f/${f.id}?new=1`);
          }}
        >
          <Plus size={14} />
        </button>
      </div>
      {open && (
        <div className="nav-section-body">
          {folders.length === 0 && <div className="nav-hint">No {meta.label.toLowerCase()} yet</div>}
          {folders.map((f) => (
            <FolderRow
              key={f.id}
              folder={f}
              notes={notesByFolder[f.id] || []}
              onDropNote={onDropNote}
              onDropFolder={onDropFolder}
              dropState={dropState}
              setDropState={setDropState}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SearchResults({ query }) {
  const notes = useApp((s) => s.notes);
  const folders = useApp((s) => s.folders);
  const navigate = useNavigate();
  const q = query.trim().toLowerCase();
  const tagQuery = q.startsWith('#') ? q.slice(1) : null;
  const matchNotes = notes
    .filter((n) =>
      tagQuery !== null
        ? (n.tags || []).some((t) => t.includes(tagQuery))
        : (n.title || 'untitled').toLowerCase().includes(q) || (n.subtitle || '').toLowerCase().includes(q) || (n.tags || []).some((t) => t.includes(q)),
    )
    .slice(0, 40);
  const matchFolders = tagQuery !== null ? [] : folders.filter((f) => `${f.code || ''} ${f.name}`.toLowerCase().includes(q)).slice(0, 10);
  const tags = useMemo(() => {
    const set = new Set();
    notes.forEach((n) => (n.tags || []).forEach((t) => (t.includes(tagQuery ?? q) ? set.add(t) : null)));
    return [...set].slice(0, 12);
  }, [notes, q, tagQuery]);

  return (
    <div className="nav-search-results">
      {tags.length > 0 && (
        <div className="nav-tags">
          {tags.map((t) => (
            <button type="button" key={t} className="tag" style={tagStyle(t)} onClick={() => navigate(`/tags/${encodeURIComponent(t)}`)}>
              #{t}
            </button>
          ))}
        </div>
      )}
      {matchFolders.map((f) => (
        <div key={f.id} className="nav-row" onClick={() => navigate(`/f/${f.id}`)}>
          <span className="nav-icon"><FolderIcon folder={f} size={15} fallback /></span>
          <span className="nav-label">{f.code && <span className="nav-code">{f.code}</span>}{f.name}</span>
        </div>
      ))}
      {matchNotes.map((n) => {
        const f = folders.find((x) => x.id === n.folder_id);
        return (
          <div key={n.id} className="nav-row" onClick={() => navigate(`/n/${n.id}`)}>
            <span className="nav-icon">{n.icon ? <EmojiIcon value={n.icon} size={15} /> : (() => { const I = noteTypeMeta(n.type).Icon; return <I size={15} />; })()}</span>
            <span className="nav-label">
              {n.title || 'Untitled'}
              {f && <span className="nav-sub"> · {f.code || f.name}</span>}
            </span>
          </div>
        );
      })}
      {!matchNotes.length && !matchFolders.length && !tags.length && <div className="nav-hint">No matches</div>}
    </div>
  );
}

export default function Sidebar({ onCollapse, width, onResize }) {
  const folders = useApp((s) => s.folders);
  const notes = useApp((s) => s.notes);
  const session = useApp((s) => s.session);
  const signOut = useApp((s) => s.signOut);
  const moveNote = useApp((s) => s.moveNote);
  const moveFolder = useApp((s) => s.moveFolder);
  const [query, setQuery] = useState('');
  const [dropState, setDropState] = useState(null);
  const location = useLocation();

  const byKind = useMemo(() => {
    const out = {};
    FOLDER_KINDS.forEach((k) => (out[k.kind] = []));
    [...folders].sort((a, b) => a.position - b.position).forEach((f) => (out[f.kind] || (out[f.kind] = [])).push(f));
    return out;
  }, [folders]);

  const notesByFolder = useMemo(() => {
    const out = {};
    [...notes].sort((a, b) => a.position - b.position).forEach((n) => (out[n.folder_id] || (out[n.folder_id] = [])).push(n));
    return out;
  }, [notes]);

  const onDropNote = (noteId, folderId, beforeId) => noteId && moveNote(noteId, folderId, beforeId);
  const onDropFolder = (folderId, kind, beforeId) => folderId && moveFolder(folderId, kind, beforeId);

  const startResize = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const move = (ev) => onResize(clamp(startW + ev.clientX - startX, 220, 440));
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.classList.remove('is-resizing');
    };
    document.body.classList.add('is-resizing');
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <aside className="sidebar" onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setDropState(null)}>
      <div className="sidebar-top">
        <NavLink to="/" className="brand">
          <img src="/logo.png" alt="" width="22" height="22" />
          <span className="brand-name">str(notes)</span>
        </NavLink>
        <button type="button" className="icon-btn" title="Hide sidebar (Ctrl/⌘ + \)" onClick={onCollapse}>
          <PanelLeftClose size={17} />
        </button>
      </div>

      <div className="nav-search">
        <Search size={14} />
        <input placeholder="Search notes or #tag" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setQuery('')} />
        {query && (
          <button type="button" className="icon-btn xs" onClick={() => setQuery('')}>
            <X size={13} />
          </button>
        )}
      </div>

      <div className="sidebar-scroll">
        {query.trim() ? (
          <SearchResults query={query} />
        ) : (
          <>
            <NavLink to="/" end className={({ isActive }) => `nav-row nav-link ${isActive ? 'is-active' : ''}`}>
              <span className="nav-icon"><Home size={15} /></span>
              <span className="nav-label">Home</span>
            </NavLink>
            {FOLDER_KINDS.map((k) => (
              <Section
                key={k.kind}
                meta={k}
                folders={byKind[k.kind] || []}
                notesByFolder={notesByFolder}
                onDropNote={onDropNote}
                onDropFolder={onDropFolder}
                dropState={dropState}
                setDropState={setDropState}
              />
            ))}
          </>
        )}
      </div>

      <div className="sidebar-bottom">
        <NavLink to="/settings" className={`nav-row nav-link ${location.pathname.startsWith('/settings') ? 'is-active' : ''}`}>
          <span className="nav-icon"><Settings size={15} /></span>
          <span className="nav-label">Settings</span>
        </NavLink>
        <div className="nav-user">
          <span className="avatar">{emailToUsername(session?.user?.email).slice(0, 1).toUpperCase()}</span>
          <span className="nav-label">{emailToUsername(session?.user?.email)}</span>
          <button type="button" className="icon-btn xs" title="Sign out" onClick={signOut}>
            <LogOut size={14} />
          </button>
        </div>
      </div>
      <div className="sidebar-resize" onMouseDown={startResize} onDoubleClick={() => onResize(272)} title="Drag to resize" />
    </aside>
  );
}
