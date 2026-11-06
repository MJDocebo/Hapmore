import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../store/useApp';
import { usePageWidth, useSpaceBackground } from '../lib/hooks';
import { ARCHIVE_DAY_OPTIONS } from '../lib/defaults';
import { ARCHIVE_DAY_LABELS, completedAt, isArchived, localDonePatch, monthKey } from '../lib/tasks';
import Breadcrumbs from '../components/Breadcrumbs';
import { TaskRow } from '../components/TasksWidget';
import { Archive, Search, Trash, X } from '../components/icons';
import { useTabActivation } from '../lib/tabContext';

async function loadDoneTasks() {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('tasks').select('*').eq('done', true).order('updated_at', { ascending: false }).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** Home → Archived tasks: completed tasks older than the auto-archive window, across all spaces. */
export default function ArchivePage() {
  const pageWidth = usePageWidth();
  const bg = useSpaceBackground('home');
  const folders = useApp((s) => s.folders);
  const fail = useApp((s) => s.fail);
  const archiveDays = useApp((s) => s.settings.taskArchiveDays);
  const updateSettings = useApp((s) => s.updateSettings);
  const [params, setParams] = useSearchParams();
  const rawSpace = params.get('space') || 'all'; // 'all' | 'general' | <folder id>
  const space = rawSpace === 'all' || rawSpace === 'general' || folders.some((f) => f.id === rawSpace) ? rawSpace : 'all';
  const [query, setQuery] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0); // bumped after a failed write to resync with the server
  const activations = useTabActivation(); // coming back to this tab picks up tasks changed in other tabs

  useEffect(() => {
    let alive = true;
    loadDoneTasks()
      .then((rows) => alive && setTasks(rows))
      .catch((e) => alive && fail(e, 'Could not load archived tasks'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [fail, reloadKey, activations]);

  const setSpace = (v) => {
    const next = new URLSearchParams(params);
    if (v === 'all') next.delete('space');
    else next.set('space', v);
    setParams(next, { replace: true });
  };

  const now = Date.now();
  const archived = useMemo(
    () => tasks.filter((t) => isArchived(t, archiveDays, now)).sort((a, b) => (completedAt(a) < completedAt(b) ? 1 : -1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, archiveDays],
  );
  const q = query.trim().toLowerCase();
  const shown = archived.filter(
    (t) => (space === 'all' || (space === 'general' ? !t.folder_id : t.folder_id === space)) && (!q || t.title.toLowerCase().includes(q)),
  );
  const groups = useMemo(() => {
    const m = new Map();
    shown.forEach((t) => {
      const k = monthKey(t);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(t);
    });
    return [...m];
  }, [shown]);

  const update = async (id, patch) => {
    const local = localDonePatch(patch);
    // Un-checking a task restores it to its list, so it leaves the archive.
    setTasks((ts) => (patch.done === false ? ts.filter((t) => t.id !== id) : ts.map((t) => (t.id === id ? { ...t, ...local } : t))));
    const { error } = await supabase.from('tasks').update(patch).eq('id', id);
    if (error) {
      fail(error, 'Could not update task');
      setReloadKey((k) => k + 1);
    } else if (patch.done === false) useApp.getState().toast('Task restored.');
  };

  const remove = async (id) => {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) {
      fail(error, 'Could not delete task');
      setReloadKey((k) => k + 1);
    }
  };

  const removeShown = async () => {
    const ids = shown.map((t) => t.id);
    if (!ids.length) return;
    const ok = await useApp.getState().confirm({
      title: `Delete ${ids.length} archived task${ids.length === 1 ? '' : 's'}?`,
      message: 'They will be permanently deleted. This can’t be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    setTasks((ts) => ts.filter((t) => !ids.includes(t.id)));
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from('tasks').delete().in('id', ids.slice(i, i + 200));
      if (error) {
        fail(error, 'Could not delete tasks');
        return setReloadKey((k) => k + 1);
      }
    }
  };

  const spaceFolder = space !== 'all' && space !== 'general' ? folders.find((f) => f.id === space) : null;
  const folderLabel = (f) => (f.code ? `${f.code} · ${f.name}` : f.name || 'Untitled');

  return (
    <div className={`page archive-page ${bg.className}`} style={bg.style} data-width={pageWidth}>
      <div className="page-toolbar">
        <Breadcrumbs
          items={[
            { key: 'archive', label: 'Archived tasks', icon: <Archive size={13} /> },
          ]}
        />
      </div>
      <div className="page-inner">
        <header className="home-head archive-head">
          <h1>Archived tasks</h1>
          <p className="muted">
            Completed tasks, deadlines and reminders move here from Home and each space’s list{' '}
            {archiveDays === 0 ? 'as soon as you check them off' : `${archiveDays} day${archiveDays === 1 ? '' : 's'} after you check them off`}. Un-check one
            to put it back.
          </p>
        </header>

        <div className="archive-controls">
          <div className="archive-search">
            <Search size={14} />
            <input className="input sm" placeholder="Search archived tasks" value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && (
              <button type="button" className="icon-btn xs" title="Clear" onClick={() => setQuery('')}>
                <X size={13} />
              </button>
            )}
          </div>
          <select className="input sm" value={space} onChange={(e) => setSpace(e.target.value)} aria-label="Space">
            <option value="all">All spaces</option>
            <option value="general">General</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {folderLabel(f)}
              </option>
            ))}
          </select>
          <label className="archive-days">
            <span className="muted small">Archive completed</span>
            <select
              className="input sm"
              value={archiveDays}
              onChange={(e) => updateSettings({ taskArchiveDays: Number(e.target.value) })}
              aria-label="When completed tasks are archived"
            >
              {ARCHIVE_DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {ARCHIVE_DAY_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <section className="card tasks archive-card">
          <header className="card-head">
            <h3>{spaceFolder ? folderLabel(spaceFolder) : space === 'general' ? 'General' : 'All spaces'}</h3>
            <span className="muted">
              {shown.length} task{shown.length === 1 ? '' : 's'}
            </span>
            {shown.length > 0 && (
              <button type="button" className="btn ghost sm danger archive-clear" onClick={removeShown}>
                <Trash size={13} /> Delete {q || space !== 'all' ? 'shown' : 'all'}
              </button>
            )}
          </header>
          {loading ? (
            <div className="muted pad">Loading…</div>
          ) : shown.length === 0 ? (
            <div className="empty-hint">{archived.length ? 'No archived tasks match.' : 'Nothing archived yet.'}</div>
          ) : (
            groups.map(([month, list]) => (
              <div key={month} className="archive-group">
                <h4 className="archive-month">{month}</h4>
                <ul className="task-list">
                  {list.map((t) => (
                    <TaskRow key={t.id} t={t} allMode={space === 'all'} folders={folders} update={update} remove={remove} showCompleted />
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
