import { useEffect, useMemo, useRef, useState } from 'react';
import Popover from './Popover';
import EmojiIcon from './EmojiIcon';
import { useApp } from '../store/useApp';
import { searchNotes } from '../lib/links';
import { noteTypeMeta } from '../lib/noteTypes';
import { Search } from './icons';

/** Hook: ranked notes for a title query. */
export function usePageSearch(query, excludeId) {
  const notes = useApp((s) => s.notes);
  return useMemo(() => searchNotes(notes, query, { excludeId }), [notes, query, excludeId]);
}

/** Result rows for a page search (shared by the link box and the "Link to page" picker). */
export function PageResults({ results, active, onPick, onHover, emptyText = 'No pages match' }) {
  const folders = useApp((s) => s.folders);
  const listRef = useRef(null);
  useEffect(() => {
    const el = listRef.current && listRef.current.querySelector(`[data-idx="${active}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [active]);
  if (!results.length) return <div className="page-results-empty">{emptyText}</div>;
  return (
    <div className="page-results" ref={listRef} role="listbox">
      {results.map((n, i) => {
        const meta = noteTypeMeta(n.type);
        const f = folders.find((x) => x.id === n.folder_id);
        return (
          <button
            type="button"
            key={n.id}
            data-idx={i}
            role="option"
            aria-selected={i === active}
            className={`page-result ${i === active ? 'is-active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => onHover && onHover(i)}
            onClick={() => onPick(n)}
          >
            <span className="page-result-icon">{n.icon ? <EmojiIcon value={n.icon} size={15} /> : <meta.Icon size={15} />}</span>
            <span className="page-result-title">{n.title || 'Untitled'}</span>
            {n.type !== 'standard' && <span className="page-result-badge">{meta.badge}</span>}
            {f && <span className="page-result-folder">{f.code || f.name}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Popover for picking a page by title. onPick(note). */
export function PagePickerPopover({ anchor, onClose, onPick, excludeId, title = 'Link to page' }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const results = usePageSearch(q, excludeId);
  useEffect(() => setActive(0), [q]);

  return (
    <Popover anchor={anchor} onClose={onClose} className="hm-menu page-picker" placement="bottom-start">
      <div className="hm-menu-label">{title}</div>
      <div className="page-picker-search">
        <Search size={14} />
        <input
          autoFocus
          value={q}
          placeholder="Search pages by title…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (results[active]) onPick(results[active]);
            }
          }}
        />
      </div>
      <PageResults results={results} active={active} onHover={setActive} onPick={onPick} />
    </Popover>
  );
}
