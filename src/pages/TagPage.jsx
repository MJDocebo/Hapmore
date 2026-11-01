import { useParams } from 'react-router-dom';
import { useApp } from '../store/useApp';
import NoteCard from '../components/NoteCard';
import { tagStyle } from '../lib/utils';
import { usePageWidth } from '../lib/hooks';

export default function TagPage() {
  const pageWidth = usePageWidth();
  const { tag } = useParams();
  const notes = useApp((s) => s.notes);
  const list = notes.filter((n) => (n.tags || []).includes(tag)).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  return (
    <div className="page" data-width={pageWidth}>
      <div className="page-inner">
        <header className="home-head">
          <h1>
            <span className="tag big" style={tagStyle(tag)}>#{tag}</span>
          </h1>
          <p className="muted">{list.length} note{list.length === 1 ? '' : 's'}</p>
        </header>
        <div className="note-cards">
          {list.map((n) => (
            <NoteCard key={n.id} note={n} showFolder />
          ))}
        </div>
      </div>
    </div>
  );
}
