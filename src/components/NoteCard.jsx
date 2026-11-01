import { useNavigate } from 'react-router-dom';
import EmojiIcon from './EmojiIcon';
import FolderIcon from './FolderIcon';
import { tagStyle, timeAgo } from '../lib/utils';
import { useApp } from '../store/useApp';
import { noteTypeMeta } from '../lib/noteTypes';

export default function NoteCard({ note, showFolder = false }) {
  const navigate = useNavigate();
  const folder = useApp((s) => (showFolder ? s.folders.find((f) => f.id === note.folder_id) : null));
  const TypeIcon = noteTypeMeta(note.type).Icon;
  return (
    <button type="button" className="note-card" onClick={() => navigate(`/n/${note.id}`)}>
      <div className="note-card-top">
        <span className="note-card-icon">
          {note.icon ? <EmojiIcon value={note.icon} size={20} /> : <TypeIcon size={18} />}
        </span>
        <span className="note-card-type">{noteTypeMeta(note.type).badge}</span>
      </div>
      <div className="note-card-title">{note.title || 'Untitled'}</div>
      {note.subtitle && <div className="note-card-sub">{note.subtitle}</div>}
      {(note.tags || []).length > 0 && (
        <div className="note-card-tags">
          {note.tags.slice(0, 4).map((t) => (
            <span key={t} className="tag" style={tagStyle(t)}>#{t}</span>
          ))}
          {note.tags.length > 4 && <span className="muted">+{note.tags.length - 4}</span>}
        </div>
      )}
      <div className="note-card-foot muted">
        {folder && (
          <span className="note-card-folder">
            <FolderIcon folder={folder} size={11} /> {folder.code || folder.name} ·{' '}
          </span>
        )}
        Edited {timeAgo(note.updated_at)}
      </div>
    </button>
  );
}
