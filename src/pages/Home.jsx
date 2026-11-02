import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store/useApp';
import { FOLDER_KINDS } from '../lib/defaults';
import { emailToUsername } from '../lib/supabase';
import TasksWidget from '../components/TasksWidget';
import FlaggedAnnotations from '../components/FlaggedAnnotations';
import NoteCard from '../components/NoteCard';
import FolderIcon from '../components/FolderIcon';
import FolderCardCover from '../components/FolderCardCover';
import GradientPicker from '../components/GradientPicker';
import Popover from '../components/Popover';
import { Plus, Paintbrush } from '../components/icons';
import { usePageWidth, useSpaceBackground } from '../lib/hooks';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Greeting whose letters bounce up one by one, followed by a waving hand. Screen readers get the plain text. */
function Greeting({ text }) {
  let i = 0;
  const words = text.split(' ');
  return (
    <h1 className="home-greet" aria-label={text}>
      {words.map((w, wi) => (
        <span key={wi} aria-hidden="true">
          <span className="greet-word">
            {Array.from(w).map((ch, ci) => (
              <span key={ci} className="greet-ch" style={{ '--i': Math.min(i++, 40) }}>
                {ch}
              </span>
            ))}
          </span>
          {wi < words.length - 1 ? ' ' : ''}
        </span>
      ))}{' '}
      {/* Outer span: one-time entrance. Inner span: hover wave — kept separate so hovering never restarts the entrance. */}
      <span className="greet-wave" aria-hidden="true" style={{ '--i': Math.min(i, 40) }}>
        <span className="greet-wave-hand">👋</span>
      </span>
    </h1>
  );
}

export default function Home() {
  const pageWidth = usePageWidth();
  const notes = useApp((s) => s.notes);
  const folders = useApp((s) => s.folders);
  const session = useApp((s) => s.session);
  const createFolder = useApp((s) => s.createFolder);
  const navigate = useNavigate();
  const bg = useSpaceBackground('home');
  const homeBg = useApp((s) => s.settings.backgrounds.home);
  const updateSettings = useApp((s) => s.updateSettings);
  const [bgAnchor, setBgAnchor] = useState(null);
  const recent = useMemo(() => [...notes].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).slice(0, 8), [notes]);

  return (
    <div className={`page home ${bg.className}`} style={bg.style} data-width={pageWidth}>
      <div className="page-inner">
        <header className="home-head">
          <Greeting text={`${greeting()}, ${emailToUsername(session?.user?.email)}`} />
          <p className="muted home-date">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <button type="button" className="btn ghost sm home-bg-btn" title="Home background" onClick={(e) => setBgAnchor(e.currentTarget)}>
            <Paintbrush size={14} /> Background
          </button>
          {bgAnchor && (
            <Popover anchor={bgAnchor} onClose={() => setBgAnchor(null)} placement="bottom-end" className="hm-menu pad">
              <div className="grad-title">Home background</div>
              <GradientPicker value={homeBg} onChange={(g) => updateSettings((st) => ({ backgrounds: { ...st.backgrounds, home: g || { off: true } } }))} />
              <p className="muted small grad-note">Spaces have their own defaults in Settings → Appearance.</p>
            </Popover>
          )}
        </header>

        {folders.length === 0 && (
          <section className="card onboarding float-in" style={{ '--base': '300ms' }}>
            <h3>Welcome to str(notes) 👋</h3>
            <p>Start by creating a course, project or research topic. Each one gets quick notes, tasks and deadlines, and its own notes.</p>
            <div className="row gap">
              {FOLDER_KINDS.map((k) => (
                <button
                  type="button"
                  key={k.kind}
                  className="btn"
                  onClick={async () => {
                    const f = await createFolder(k.kind);
                    if (f) navigate(`/f/${f.id}?new=1`);
                  }}
                >
                  <Plus size={14} /> {k.singular}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="grid-2 float-group" style={{ '--base': '350ms' }}>
          <TasksWidget title="Upcoming tasks & deadlines" />
          <FlaggedAnnotations title="Flagged annotations" />
        </div>

        {folders.length > 0 && (
          <section className="home-section">
            <h2 className="section-title float-title" style={{ '--base': '500ms' }}>Your spaces</h2>
            <div className="folder-cards float-group" style={{ '--base': '560ms' }}>
              {FOLDER_KINDS.flatMap((k) =>
                folders
                  .filter((f) => f.kind === k.kind)
                  .sort((a, b) => a.position - b.position)
                  .map((f) => (
                    <button type="button" key={f.id} className="folder-card" onClick={() => navigate(`/f/${f.id}`)}>
                      <FolderCardCover folder={f} />
                      <div className="folder-card-body">
                        <FolderIcon folder={f} size={22} />
                        <div>
                          <div className="folder-card-title">{f.name}</div>
                          <div className="muted small">
                            {k.singular}
                            {f.code ? ` · ${f.code}` : ''} · {notes.filter((n) => n.folder_id === f.id).length} notes
                          </div>
                        </div>
                      </div>
                    </button>
                  )),
              )}
            </div>
          </section>
        )}

        {recent.length > 0 && (
          <section className="home-section">
            <h2 className="section-title float-title" style={{ '--base': '750ms' }}>Recently edited</h2>
            <div className="note-cards float-group" style={{ '--base': '810ms' }}>
              {recent.map((n) => (
                <NoteCard key={n.id} note={n} showFolder />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
