import { useMemo, useState } from 'react';
import { useApp } from '../store/useApp';
import { tagStyle } from '../lib/utils';
import { X, Tag } from './icons';

export default function TagInput({ tags = [], onChange }) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const notes = useApp((s) => s.notes);
  const allTags = useMemo(() => {
    const set = new Set();
    notes.forEach((n) => (n.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [notes]);
  const q = draft.trim().toLowerCase().replace(/^#/, '');
  const suggestions = focused && q ? allTags.filter((t) => t.includes(q) && !tags.includes(t)).slice(0, 6) : [];

  const add = (raw) => {
    const t = String(raw).trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').slice(0, 40);
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setDraft('');
  };

  return (
    <div className="tag-input">
      <Tag size={14} className="tag-input-icon" />
      {tags.map((t) => (
        <span key={t} className="tag" style={tagStyle(t)}>
          #{t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} title="Remove tag">
            <X size={11} />
          </button>
        </span>
      ))}
      <div className="tag-input-field">
        <input
          value={draft}
          placeholder={tags.length ? 'Add tag' : 'Add tags…'}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
              if (draft.trim()) {
                e.preventDefault();
                add(draft);
              }
            } else if (e.key === 'Backspace' && !draft && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
        />
        {suggestions.length > 0 && (
          <div className="tag-suggest">
            {suggestions.map((t) => (
              <button type="button" key={t} onMouseDown={(e) => e.preventDefault()} onClick={() => add(t)}>
                <span className="tag" style={tagStyle(t)}>#{t}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
