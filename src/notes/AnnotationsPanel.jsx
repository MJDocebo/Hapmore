import { useEffect, useRef, useState } from 'react';
import { timeAgo } from '../lib/utils';
import { useApp } from '../store/useApp';
import { CheckCircle, Circle, Trash, X, Eye, MessageSquare } from '../components/icons';

function AnnotationItem({ a, focused, onUpdate, onDelete, onJump }) {
  const [body, setBody] = useState(a.body || '');
  const ref = useRef(null);
  useEffect(() => setBody(a.body || ''), [a.body]);
  useEffect(() => {
    if (focused && ref.current) {
      ref.current.focus();
      ref.current.closest('.anno')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focused]);
  const commit = () => body !== (a.body || '') && onUpdate(a.id, { body });

  return (
    <li className={`anno ${a.resolved ? 'is-resolved' : ''} ${focused ? 'is-focused' : ''}`}>
      {a.quote && (
        <button type="button" className="anno-quote" title="Jump to block" onClick={() => onJump(a.block_id)}>
          {a.quote}
        </button>
      )}
      <textarea
        ref={ref}
        className="anno-body"
        rows={2}
        value={body}
        placeholder="What do you need to look up / remember?"
        onChange={(e) => setBody(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
            e.currentTarget.blur();
          }
        }}
      />
      <div className="anno-foot">
        <label className="check" title="Show this on the space’s overview and the Home page">
          <input type="checkbox" checked={!!a.show_on_overview} onChange={(e) => onUpdate(a.id, { show_on_overview: e.target.checked })} />
          <Eye size={12} /> Show on overview
        </label>
        <span className="muted small">{timeAgo(a.created_at)}</span>
        <span className="grow" />
        <button type="button" className="icon-btn xs" title={a.resolved ? 'Reopen' : 'Resolve'} onClick={() => onUpdate(a.id, { resolved: !a.resolved })}>
          {a.resolved ? <Circle size={14} /> : <CheckCircle size={14} />}
        </button>
        <button
          type="button"
          className="icon-btn xs"
          title="Delete"
          onClick={async () => (!a.body || (await useApp.getState().confirm({ title: 'Delete this annotation?', message: a.body.length > 140 ? `${a.body.slice(0, 140)}…` : a.body, danger: true }))) && onDelete(a.id)}
        >
          <Trash size={14} />
        </button>
      </div>
    </li>
  );
}

export default function AnnotationsPanel({ annotations, focusId, onUpdate, onDelete, onJump, onClose }) {
  const [filter, setFilter] = useState('open');
  const list = annotations.filter((a) => (filter === 'all' ? true : filter === 'open' ? !a.resolved : a.resolved));
  const openCount = annotations.filter((a) => !a.resolved).length;

  useEffect(() => {
    const a = annotations.find((x) => x.id === focusId);
    if (a && a.resolved && filter === 'open') setFilter('all');
  }, [focusId, annotations, filter]);

  return (
    <aside className="anno-panel">
      <header className="anno-head">
        <h3>
          <MessageSquare size={15} /> Annotations
        </h3>
        <button type="button" className="icon-btn xs" onClick={onClose} title="Close">
          <X size={15} />
        </button>
      </header>
      <div className="seg sm">
        {[
          ['open', `Open (${openCount})`],
          ['resolved', `Resolved (${annotations.length - openCount})`],
          ['all', 'All'],
        ].map(([id, label]) => (
          <button type="button" key={id} className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="empty-hint">
          {annotations.length === 0 ? (
            <>Select text and press the 💬 button, or use a block’s ⋮⋮ menu → “Add annotation”.</>
          ) : (
            'Nothing here.'
          )}
        </div>
      ) : (
        <ul className="anno-list">
          {list.map((a) => (
            <AnnotationItem key={a.id} a={a} focused={a.id === focusId} onUpdate={onUpdate} onDelete={onDelete} onJump={onJump} />
          ))}
        </ul>
      )}
    </aside>
  );
}
