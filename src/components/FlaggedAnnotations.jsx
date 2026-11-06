import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../store/useApp';
import { timeAgo } from '../lib/utils';
import EmojiIcon from './EmojiIcon';
import { EyeOff, ExternalLink } from './icons';
import { useTabActivation } from '../lib/tabContext';

/** Annotations ticked "Show on overview" that aren't resolved yet. folderId undefined → all folders. */
export default function FlaggedAnnotations({ folderId, title = 'To look up' }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const version = useApp((s) => s.annotationsVersion);
  const activations = useTabActivation(); // refresh when you come back to this tab
  const fail = useApp((s) => s.fail);
  const bump = useApp((s) => s.bumpAnnotations);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    let q = supabase
      .from('annotations')
      .select('id, body, quote, block_id, note_id, created_at, notes!inner(id, title, icon, folder_id)')
      .eq('show_on_overview', true)
      .eq('resolved', false)
      .order('created_at', { ascending: false });
    if (folderId) q = q.eq('notes.folder_id', folderId);
    q.then(({ data, error }) => {
      if (!alive) return;
      if (error) fail(error, 'Could not load annotations');
      setItems(data || []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [folderId, version, fail, activations]);

  const update = async (id, patch) => {
    setItems((list) => list.filter((a) => a.id !== id));
    const { error } = await supabase.from('annotations').update(patch).eq('id', id);
    if (error) fail(error, 'Could not update annotation');
    bump();
  };

  return (
    <section className="card flagged">
      <header className="card-head">
        <h3>{title}</h3>
        <span className="muted">{items.length}</span>
      </header>
      {loading ? (
        <div className="muted pad">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty-hint">No flagged annotations. Tick “Show on overview” on an annotation to pin it here.</div>
      ) : (
        <ul className="flag-list">
          {items.map((a) => (
            <li key={a.id} className="flag">
              <input type="checkbox" title="Mark resolved" onChange={() => update(a.id, { resolved: true })} />
              <div className="flag-main">
                <div className="flag-body">{a.body || <span className="muted">(no text)</span>}</div>
                {a.quote && <div className="flag-quote">“{a.quote}”</div>}
                <div className="flag-meta">
                  <button type="button" className="link-btn flag-note" title={a.notes?.title || 'Untitled'} onClick={() => navigate(`/n/${a.note_id}?block=${encodeURIComponent(a.block_id || '')}&a=${a.id}`)}>
                    <EmojiIcon value={a.notes?.icon} size={12} /> <span className="flag-note-title">{a.notes?.title || 'Untitled'}</span> <ExternalLink size={11} />
                  </button>
                  <span className="muted flag-time">· {timeAgo(a.created_at)}</span>
                </div>
              </div>
              <button type="button" className="icon-btn" title="Remove from overview" onClick={() => update(a.id, { show_on_overview: false })}>
                <EyeOff size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
