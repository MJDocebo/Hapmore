import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../store/useApp';
import { formatDue } from '../lib/utils';
import { Plus, Trash, Calendar, Bell, Flag, Check } from './icons';
import FolderIcon from './FolderIcon';
import AutoTextarea from './AutoTextarea';

export const TASK_MAX = 255;
/** Tasks are single-line text: pasted line breaks become spaces; capped at TASK_MAX characters. */
const cleanTitle = (v) => v.replace(/\s*[\r\n]+\s*/g, ' ').slice(0, TASK_MAX);

/**
 * Date input with a visible "Due date" hint while empty. iPadOS / iOS Safari draws an empty date input as a blank
 * box (no mm/dd/yyyy), so the hint overlays it until focused or filled.
 */
function DateField({ value, onChange, label = 'Due date' }) {
  return (
    <label className={`date-field ${value ? '' : 'is-empty'}`}>
      <input type="date" className="input sm" value={value} aria-label={label} onChange={onChange} />
      {!value && (
        <span className="date-field-hint" aria-hidden="true">
          <Calendar size={13} /> {label}
        </span>
      )}
    </label>
  );
}

/** Saved task text: wraps fully; click (or Enter / Space when focused) to edit in place. */
function TaskTitle({ title, done, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const ref = useRef(null);
  useEffect(() => {
    if (!editing) setValue(title);
  }, [title, editing]);
  useEffect(() => {
    if (!editing || !ref.current) return;
    const el = ref.current;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  const commit = () => {
    const next = value.trim();
    setEditing(false);
    if (next && next !== title) onSave(next);
    else setValue(title);
  };

  if (!editing) {
    return (
      <div
        className={`task-title ${done ? 'is-done' : ''}`}
        role="button"
        tabIndex={0}
        title="Click to edit"
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setEditing(true);
          }
        }}
      >
        {title}
      </div>
    );
  }
  return (
    <AutoTextarea
      ref={ref}
      className="task-title is-editing"
      value={value}
      maxLength={TASK_MAX}
      aria-label="Task text"
      onChange={(e) => setValue(cleanTitle(e.target.value))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setValue(title);
          setEditing(false);
        }
      }}
    />
  );
}

const KINDS = [
  { id: 'task', label: 'Task', Icon: Check },
  { id: 'deadline', label: 'Deadline', Icon: Flag },
  { id: 'reminder', label: 'Reminder', Icon: Bell },
];

function sortTasks(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
  if (!!a.due_date !== !!b.due_date) return a.due_date ? -1 : 1;
  return (a.created_at || '') < (b.created_at || '') ? -1 : 1;
}

function TaskRow({ t, allMode, folders, update, remove }) {
  const due = formatDue(t.due_date);
  const kind = KINDS.find((k) => k.id === t.kind) || KINDS[0];
  const folder = allMode && t.folder_id ? folders.find((f) => f.id === t.folder_id) : null;
  const dateRef = useRef(null);
  const openPicker = () => {
    const el = dateRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };
  return (
    <li className={`task ${t.done ? 'is-done' : ''}`}>
      <input type="checkbox" checked={t.done} onChange={(e) => update(t.id, { done: e.target.checked })} />
      <div className="task-main">
        <TaskTitle title={t.title} done={t.done} onSave={(title) => update(t.id, { title })} />
        <div className="task-meta">
          <span className={`task-kind is-${t.kind}`}>
            <kind.Icon size={11} /> {kind.label}
          </span>
          {due && <span className={`task-due is-${due.tone}`}><Calendar size={11} /> {due.label}</span>}
          {folder && (
            <span className="task-folder" title={folder.code ? `${folder.code} · ${folder.name}` : folder.name}>
              <FolderIcon folder={folder} size={11} /> <span className="task-folder-name">{folder.code || folder.name}</span>
            </span>
          )}
        </div>
      </div>
      {/* Fixed-width action strip: hovering only fades it in, so the row never reflows. */}
      <div className="task-actions">
        <span className="task-date-wrap">
          <button type="button" className="icon-btn sm" onClick={openPicker} title={t.due_date ? `Due ${t.due_date} — change date` : 'Set a due date'}>
            <Calendar size={14} />
          </button>
          <input
            ref={dateRef}
            type="date"
            className="task-date-input"
            tabIndex={-1}
            aria-label="Due date"
            value={t.due_date || ''}
            onChange={(e) => update(t.id, { due_date: e.target.value || null })}
          />
        </span>
        <button type="button" className="icon-btn sm" onClick={() => remove(t.id)} title="Delete">
          <Trash size={14} />
        </button>
      </div>
    </li>
  );
}

/**
 * Tasks, deadlines and reminders. folderId → tasks for that course/project.
 * folderId === undefined → everything (Home page), with a folder selector when adding.
 */
export default function TasksWidget({ folderId, title = 'Tasks & deadlines', horizonDays }) {
  const allMode = folderId === undefined;
  const folders = useApp((s) => s.folders);
  const fail = useApp((s) => s.fail);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [draft, setDraft] = useState({ title: '', kind: 'task', due_date: '', folder_id: '' });

  useEffect(() => {
    let alive = true;
    let q = supabase.from('tasks').select('*').order('created_at');
    if (!allMode) q = q.eq('folder_id', folderId);
    q.then(({ data, error }) => {
      if (!alive) return;
      if (error) fail(error, 'Could not load tasks');
      setTasks(data || []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [folderId, allMode, fail]);

  const visible = useMemo(() => {
    let list = [...tasks].sort(sortTasks);
    if (allMode && horizonDays) {
      list = list.filter((t) => t.done || !t.due_date || (formatDue(t.due_date)?.diff ?? 0) <= horizonDays);
    }
    return list;
  }, [tasks, allMode, horizonDays]);
  const open = visible.filter((t) => !t.done);
  const done = visible.filter((t) => t.done);

  const folderLabel = (f) => (f.code ? `${f.code} · ${f.name}` : f.name);
  const pickedFolder = draft.folder_id ? folders.find((f) => f.id === draft.folder_id) : null;

  const add = async (e) => {
    e.preventDefault();
    const titleText = cleanTitle(draft.title).trim();
    if (!titleText) return;
    const row = {
      title: titleText,
      kind: draft.kind,
      due_date: draft.due_date || null,
      folder_id: allMode ? draft.folder_id || null : folderId,
    };
    const { data, error } = await supabase.from('tasks').insert(row).select('*').single();
    if (error) return fail(error, 'Could not add task');
    setTasks((t) => [...t, data]);
    setDraft((d) => ({ ...d, title: '', due_date: '' }));
  };

  const update = async (id, patch) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { error } = await supabase.from('tasks').update(patch).eq('id', id);
    if (error) fail(error, 'Could not update task');
  };

  const remove = async (id) => {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) fail(error, 'Could not delete task');
  };

  return (
    <section className="card tasks">
      <header className="card-head">
        <h3>{title}</h3>
        <span className="muted">{open.length} open</span>
      </header>
      <form className="task-add" onSubmit={add}>
        <div className="task-input-wrap">
          <AutoTextarea
            className="input task-input"
            placeholder="Add a task, deadline or reminder…"
            value={draft.title}
            maxLength={TASK_MAX}
            aria-label="New task"
            onChange={(e) => setDraft({ ...draft, title: cleanTitle(e.target.value) })}
            onKeyDown={(e) => {
              // Enter adds (tasks are single-line); the text still wraps so long entries stay fully visible.
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          {draft.title.length >= TASK_MAX - 55 && (
            <span className={`task-count ${draft.title.length >= TASK_MAX ? 'is-max' : ''}`} aria-live="polite">
              {draft.title.length}/{TASK_MAX}
            </span>
          )}
        </div>
        <div className="task-add-row">
          <select className="input sm" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>{k.label}</option>
            ))}
          </select>
          <DateField value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
          {allMode && (
            <select
              className="input sm task-folder-select"
              value={draft.folder_id}
              title={pickedFolder ? folderLabel(pickedFolder) : 'General (no course or project)'}
              aria-label="Course or project"
              onChange={(e) => setDraft({ ...draft, folder_id: e.target.value })}
            >
              <option value="">General</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{folderLabel(f)}</option>
              ))}
            </select>
          )}
          <button className="btn sm primary" type="submit" disabled={!draft.title.trim()}>
            <Plus size={14} /> Add
          </button>
        </div>
      </form>
      {loading ? (
        <div className="muted pad">Loading…</div>
      ) : (
        <>
          {open.length === 0 && <div className="empty-hint">Nothing pending 🎉</div>}
          <ul className="task-list">
            {open.map((t) => (
              <TaskRow key={t.id} t={t} allMode={allMode} folders={folders} update={update} remove={remove} />
            ))}
          </ul>
          {done.length > 0 && (
            <button type="button" className="link-btn" onClick={() => setShowDone((v) => !v)}>
              {showDone ? 'Hide' : 'Show'} completed ({done.length})
            </button>
          )}
          {showDone && (
            <ul className="task-list">
              {done.map((t) => (
                <TaskRow key={t.id} t={t} allMode={allMode} folders={folders} update={update} remove={remove} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
