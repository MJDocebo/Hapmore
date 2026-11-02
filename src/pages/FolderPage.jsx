import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../store/useApp';
import { FOLDER_KINDS } from '../lib/defaults';
import { useDebouncedCallback, usePageWidth, useSpaceBackground } from '../lib/hooks';
import { resolveBg } from '../lib/backgrounds';
import GradientPicker from '../components/GradientPicker';
import Popover from '../components/Popover';
import PageHeader from '../components/PageHeader';
import Editor from '../editor/Editor';
import TasksWidget from '../components/TasksWidget';
import FlaggedAnnotations from '../components/FlaggedAnnotations';
import NoteCard from '../components/NoteCard';
import FolderIcon from '../components/FolderIcon';
import Breadcrumbs from '../components/Breadcrumbs';
import Menu from '../components/Menu';
import { LayoutGrid, More, Trash, Plus, ChevronDown, Paintbrush } from '../components/icons';
import { noteTypeMenuItems } from '../lib/noteTypes';

export default function FolderPage() {
  const pageWidth = usePageWidth();
  const { folderId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const folder = useApp((s) => s.folders.find((f) => f.id === folderId));
  const allNotes = useApp((s) => s.notes);
  const updateFolder = useApp((s) => s.updateFolder);
  const deleteFolder = useApp((s) => s.deleteFolder);
  const createNote = useApp((s) => s.createNote);
  const toast = useApp((s) => s.toast);
  const [menu, setMenu] = useState(null);
  const [bgAnchor, setBgAnchor] = useState(null);
  const backgrounds = useApp((s) => s.settings.backgrounds);
  const bg = useSpaceBackground(folder?.kind || 'course', folder?.background);
  const [addMenu, setAddMenu] = useState(null);
  const [sort, setSort] = useState('manual');
  const titleRef = useRef(null);
  const menuBtn = useRef(null);
  const meta = FOLDER_KINDS.find((k) => k.kind === folder?.kind) || FOLDER_KINDS[0];

  const notes = useMemo(() => {
    const list = allNotes.filter((n) => n.folder_id === folderId);
    if (sort === 'recent') return list.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    if (sort === 'title') return list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    return list.sort((a, b) => a.position - b.position);
  }, [allNotes, folderId, sort]);

  const saveQuick = useDebouncedCallback((id, doc) => updateFolder(id, { quick_notes: doc }), 800);
  useEffect(() => () => saveQuick.flush(), [folderId, saveQuick]);
  const saveName = useDebouncedCallback((id, name) => updateFolder(id, { name }), 600);

  const onHeaderChange = (patch) => {
    if (patch.title !== undefined) {
      // Update the sidebar immediately, persist debounced.
      useApp.setState((s) => ({ folders: s.folders.map((f) => (f.id === folderId ? { ...f, name: patch.title } : f)) }));
      saveName(folderId, patch.title);
    } else updateFolder(folderId, patch);
  };

  useEffect(() => {
    if (params.get('new') && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
      params.delete('new');
      setParams(params, { replace: true });
    }
  }, [params, setParams, folderId]);

  // Annotations attach to notes; quick notes are a scratchpad.
  useEffect(() => {
    const onAnnotate = () => toast('Annotations can be added inside notes — quick notes are a scratchpad.', 'info');
    window.addEventListener('hm:annotate', onAnnotate);
    return () => window.removeEventListener('hm:annotate', onAnnotate);
  }, [toast]);

  if (!folder) {
    return (
      <div className="page" data-width={pageWidth}>
        <div className="page-inner empty-page">
          <h2>Folder not found</h2>
          <button type="button" className="btn" onClick={() => navigate('/')}>Go home</button>
        </div>
      </div>
    );
  }

  const newNote = async (type) => {
    const n = await createNote(folder.id, type);
    if (n) navigate(`/n/${n.id}`);
  };

  return (
    <div className={`page folder-page ${bg.className}`} style={bg.style} data-width={pageWidth}>
      <div className="page-toolbar">
        <Breadcrumbs
          items={[
            { key: 'kind', label: meta.label },
            { key: 'folder', label: folder.code || folder.name || meta.newName, icon: <FolderIcon folder={folder} size={13} /> },
          ]}
        />
        <button type="button" ref={menuBtn} className="icon-btn" onClick={(e) => setMenu(e.currentTarget)} title="More">
          <More size={17} />
        </button>
        {menu && (
          <Menu
            anchor={menu}
            onClose={() => setMenu(null)}
            placement="bottom-end"
            items={[
              { label: 'Background…', icon: Paintbrush, onClick: () => setBgAnchor(menuBtn.current) },
              { divider: true },
              ...FOLDER_KINDS.filter((k) => k.kind !== folder.kind).map((k) => ({
                label: `Move to ${k.label}`,
                icon: LayoutGrid,
                onClick: () => useApp.getState().moveFolder(folder.id, k.kind, null),
              })),
              { divider: true },
              {
                label: 'Delete',
                icon: Trash,
                danger: true,
                onClick: async () => {
                  if (!(await useApp.getState().confirm({ title: `Delete “${folder.name || 'Untitled'}”?`, message: `This deletes the folder and its ${notes.length} note${notes.length === 1 ? '' : 's'}, tasks and annotations. This can’t be undone.`, confirmLabel: 'Delete folder', danger: true }))) return;
                  await deleteFolder(folder.id);
                  navigate('/');
                },
              },
            ]}
          />
        )}
        {bgAnchor && (
          <Popover anchor={bgAnchor} onClose={() => setBgAnchor(null)} placement="bottom-end" className="hm-menu pad">
            <div className="grad-title">Background for this {meta.singular.toLowerCase()}</div>
            <GradientPicker
              value={folder.background || null}
              inherited={resolveBg(backgrounds, folder.kind, null)}
              inheritLabel={`${meta.label} default`}
              onChange={(g) => updateFolder(folder.id, { background: g })}
            />
            <p className="muted small grad-note">The default for all {meta.label.toLowerCase()} is set in Settings → Appearance.</p>
          </Popover>
        )}
      </div>

      <PageHeader
        cover={folder.cover}
        icon={folder.icon}
        title={folder.name}
        placeholder={meta.newName}
        titleRef={titleRef}
        onChange={onHeaderChange}
      >
        <div className="folder-meta">
          <label className="meta-field">
            <span>{folder.kind === 'course' ? 'Course code' : 'Short code'}</span>
            <input
              className="input sm"
              defaultValue={folder.code || ''}
              key={`code-${folder.id}`}
              placeholder={folder.kind === 'course' ? 'e.g. CS 6210' : 'optional'}
              onBlur={(e) => e.target.value !== (folder.code || '') && updateFolder(folder.id, { code: e.target.value.trim() || null })}
            />
          </label>
          <label className="meta-field">
            <span>{folder.kind === 'course' ? 'Term' : 'Timeframe'}</span>
            <input
              className="input sm"
              defaultValue={folder.term || ''}
              key={`term-${folder.id}`}
              placeholder={folder.kind === 'course' ? 'e.g. Fall 2026' : 'optional'}
              onBlur={(e) => e.target.value !== (folder.term || '') && updateFolder(folder.id, { term: e.target.value.trim() || null })}
            />
          </label>
        </div>
      </PageHeader>

      <div className="page-inner">
        <section className="card quick-notes">
          <header className="card-head">
            <h3>Quick notes</h3>
            <span className="muted small">Scratchpad: links, office hours, reminders…</span>
          </header>
          <Editor key={folder.id} content={folder.quick_notes} onChange={(doc) => saveQuick(folder.id, doc)} placeholder="Jot something down… type '\' for blocks" />
        </section>

        <div className="grid-2">
          <TasksWidget folderId={folder.id} />
          <FlaggedAnnotations folderId={folder.id} title="To look up" />
        </div>

        <section className="home-section">
          <div className="section-head">
            <h2 className="section-title">Notes</h2>
            <div className="row gap-sm">
              <select className="input sm" value={sort} onChange={(e) => setSort(e.target.value)} title="Sort">
                <option value="manual">Sidebar order</option>
                <option value="recent">Recently edited</option>
                <option value="title">Title</option>
              </select>
              <button type="button" className={`btn sm primary ${addMenu ? 'is-open' : ''}`} onClick={(e) => setAddMenu(e.currentTarget)} aria-haspopup="menu">
                <Plus size={14} /> Add New <ChevronDown size={13} className="btn-caret" />
              </button>
              {addMenu && <Menu anchor={addMenu} onClose={() => setAddMenu(null)} placement="bottom-end" title="Add new" items={noteTypeMenuItems(newNote)} />}
            </div>
          </div>
          {notes.length === 0 ? (
            <button type="button" className="empty-card" onClick={(e) => setAddMenu(e.currentTarget)}>
              <Plus size={16} /> Add the first note to {folder.name || 'this folder'}
            </button>
          ) : (
            <div className="note-cards">
              {notes.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
