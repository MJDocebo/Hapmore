import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useApp } from '../store/useApp';
import { normalizeFourZone, FOLDER_KINDS } from '../lib/defaults';
import { useLocalStorage, usePageWidth, PAGE_WIDTHS } from '../lib/hooks';
import { scrollToBlock } from '../editor/actions';
import { useNoteSaver } from '../notes/useNoteSaver';
import Editor from '../editor/Editor';
import FourZone from '../notes/FourZone';
import PdfNote from '../notes/PdfNote';
import { copyNoteLink } from '../lib/links';
import AnnotationsPanel from '../notes/AnnotationsPanel';
import PageHeader from '../components/PageHeader';
import TagInput from '../components/TagInput';
import FolderIcon from '../components/FolderIcon';
import Breadcrumbs from '../components/Breadcrumbs';
import Menu from '../components/Menu';
import { MessageSquare, More, Copy, Trash, LayoutGrid, FileText, Loader, Check, Move, MoveHorizontal, LinkIcon } from '../components/icons';

function SaveStatus({ status }) {
  if (status === 'saving' || status === 'dirty')
    return (
      <span className="save-status muted">
        <Loader size={13} className="spin" /> Saving…
      </span>
    );
  if (status === 'error') return <span className="save-status is-error">Not saved</span>;
  return (
    <span className="save-status muted">
      <Check size={13} /> Saved
    </span>
  );
}

/** 4-zone → single doc: each zone becomes an H2 section. */
function zonesToDoc(content) {
  const out = [];
  content.zones.forEach((z) => {
    out.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: `${z.emoji && !z.emoji.startsWith('custom:') ? `${z.emoji} ` : ''}${z.title || 'Zone'}` }] });
    if (z.doc && Array.isArray(z.doc.content)) out.push(...z.doc.content);
  });
  return { type: 'doc', content: out.length ? out : [{ type: 'paragraph' }] };
}

export default function NotePage() {
  const { noteId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const settings = useApp((s) => s.settings);
  const folders = useApp((s) => s.folders);
  const noteMeta = useApp((s) => s.notes.find((n) => n.id === noteId));
  const fail = useApp((s) => s.fail);
  const toast = useApp((s) => s.toast);
  const bumpAnnotations = useApp((s) => s.bumpAnnotations);
  const [note, setNote] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [version, setVersion] = useState(0);
  const [annotations, setAnnotations] = useState([]);
  const [focusAnno, setFocusAnno] = useState(null);
  const [panelOpen, setPanelOpen] = useLocalStorage('hm.annotations.open', false);
  const [menu, setMenu] = useState(null);
  const [moveMenu, setMoveMenu] = useState(null);
  const [widthMenu, setWidthMenu] = useState(null);
  const [pdfJump, setPdfJump] = useState(null); // { page } from a /n/<id>?page=N link
  const globalWidth = useApp((s) => s.settings.pageWidth);
  const editors = useRef(new Set());
  const contentRef = useRef(null); // latest editor content (editors are uncontrolled, so state.content goes stale)
  const { save, flush, status } = useNoteSaver(noteId);
  const folder = folders.find((f) => f.id === note?.folder_id);
  const kind = FOLDER_KINDS.find((k) => k.kind === folder?.kind);
  const pageWidth = usePageWidth(note?.page_width);

  // ------------------------------------------------------------ load
  useEffect(() => {
    let alive = true;
    setNote(null);
    setLoadError(null);
    setAnnotations([]);
    setPdfJump(null);
    editors.current = new Set();
    Promise.all([
      supabase.from('notes').select('*').eq('id', noteId).maybeSingle(),
      supabase.from('annotations').select('*').eq('note_id', noteId).order('created_at'),
    ]).then(([n, a]) => {
      if (!alive) return;
      if (n.error || !n.data) {
        setLoadError(n.error?.message || 'This note doesn’t exist or was deleted.');
        return;
      }
      if (a.error) fail(a.error, 'Could not load annotations');
      contentRef.current = n.data.content;
      setNote(n.data);
      setAnnotations(a.data || []);
    });
    return () => {
      alive = false;
    };
  }, [noteId, fail]);

  const patch = useCallback(
    (p) => {
      if ('content' in p) contentRef.current = p.content;
      setNote((n) => (n ? { ...n, ...p } : n));
      save(p);
    },
    [save],
  );
  const saveContent = useCallback(
    (content) => {
      contentRef.current = content;
      save({ content });
    },
    [save],
  );

  // ------------------------------------------------------------ annotations ⇄ editors
  const openIds = useMemo(() => annotations.filter((a) => !a.resolved && a.block_id).map((a) => a.block_id), [annotations]);
  const openIdsRef = useRef(openIds);
  openIdsRef.current = openIds;

  useEffect(() => {
    editors.current.forEach((ed) => !ed.isDestroyed && ed.commands.setAnnotatedBlocks(openIds));
  }, [openIds]);

  const onEditorReady = useCallback((ed, old) => {
    if (ed) {
      editors.current.add(ed);
      setTimeout(() => !ed.isDestroyed && ed.commands.setAnnotatedBlocks(openIdsRef.current), 0);
    } else if (old) editors.current.delete(old);
  }, []);

  useEffect(() => {
    const onAnnotate = async (e) => {
      const { editor, blockId, quote } = e.detail || {};
      if (!editors.current.has(editor)) return;
      e.stopImmediatePropagation();
      const { data, error } = await supabase
        .from('annotations')
        .insert({ note_id: noteId, block_id: blockId, quote, body: '' })
        .select('*')
        .single();
      if (error) return fail(error, 'Could not add annotation');
      setAnnotations((list) => [...list, data]);
      setPanelOpen(true);
      setFocusAnno(data.id);
    };
    window.addEventListener('hm:annotate', onAnnotate);
    return () => window.removeEventListener('hm:annotate', onAnnotate);
  }, [noteId, fail, setPanelOpen]);

  // Gutter marker clicked → open the panel on that block's first open annotation.
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;
  useEffect(() => {
    const onShow = (e) => {
      const { editor, blockId } = e.detail || {};
      if (!editors.current.has(editor)) return;
      const a = annotationsRef.current.find((x) => x.block_id === blockId && !x.resolved);
      setPanelOpen(true);
      if (a) {
        setFocusAnno(null); // reset so focusing the same annotation twice still scrolls to it
        requestAnimationFrame(() => setFocusAnno(a.id));
      }
    };
    window.addEventListener('hm:show-annotations', onShow);
    return () => window.removeEventListener('hm:show-annotations', onShow);
  }, [setPanelOpen]);

  // Deep link to a PDF page: /n/:id?page=N (also works when this note is already open)
  useEffect(() => {
    const pg = Number(params.get('page'));
    if (!pg) return;
    setPdfJump({ page: pg });
    const next = new URLSearchParams(params);
    next.delete('page');
    setParams(next, { replace: true });
  }, [params, setParams]);

  // Deep link: /n/:id?block=…&a=…
  useEffect(() => {
    if (!note) return undefined;
    const block = params.get('block');
    const a = params.get('a');
    if (!block && !a) return undefined;
    const t = setTimeout(() => {
      if (block) scrollToBlock(block);
      if (a) {
        setPanelOpen(true);
        setFocusAnno(a);
      }
      setParams({}, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [note, params, setParams, setPanelOpen]);

  const updateAnnotation = async (id, p) => {
    setAnnotations((list) => list.map((a) => (a.id === id ? { ...a, ...p } : a)));
    const { error } = await supabase.from('annotations').update(p).eq('id', id);
    if (error) fail(error, 'Could not update annotation');
    bumpAnnotations();
  };
  const deleteAnnotation = async (id) => {
    setAnnotations((list) => list.filter((a) => a.id !== id));
    const { error } = await supabase.from('annotations').delete().eq('id', id);
    if (error) fail(error, 'Could not delete annotation');
    bumpAnnotations();
  };
  const jump = (blockId) => {
    if (!scrollToBlock(blockId)) toast('That block no longer exists in this note.', 'error');
  };

  // ------------------------------------------------------------ actions
  const convert = async () => {
    await flush();
    if (note.type === 'four_zone') {
      const content = zonesToDoc(normalizeFourZone(contentRef.current, settings.zoneDefaults));
      patch({ type: 'standard', content });
    } else {
      const fz = normalizeFourZone(null, settings.zoneDefaults);
      const cur = contentRef.current;
      fz.zones[0].doc = cur && cur.type === 'doc' ? cur : null;
      patch({ type: 'four_zone', content: fz });
    }
    editors.current = new Set();
    setVersion((v) => v + 1);
    await flush();
  };

  /** Per-note width override (null = follow Settings → Appearance). Saved directly so a missing column can't block content saves. */
  const setNoteWidth = async (w) => {
    const prev = note.page_width ?? null;
    setNote((n) => ({ ...n, page_width: w }));
    const { error } = await supabase.from('notes').update({ page_width: w }).eq('id', note.id);
    if (error) {
      setNote((n) => ({ ...n, page_width: prev }));
      if (/page_width/.test(error.message || '')) toast('Per-note page width needs a quick database update: run supabase/schema.sql again in the Supabase SQL editor.', 'error');
      else fail(error, 'Could not change page width');
    }
  };

  const remove = async () => {
    if (!(await useApp.getState().confirm({ title: `Delete “${note.title || 'Untitled'}”?`, message: 'The note and its annotations will be permanently deleted. This can’t be undone.', confirmLabel: 'Delete note', danger: true }))) return;
    const fid = note.folder_id;
    await useApp.getState().deleteNote(note.id);
    navigate(`/f/${fid}`);
  };

  if (loadError) {
    return (
      <div className="page">
        <div className="page-inner empty-page">
          <h2>Note not found</h2>
          <p className="muted">{loadError}</p>
          <button type="button" className="btn" onClick={() => navigate('/')}>Go home</button>
        </div>
      </div>
    );
  }
  if (!note) {
    return (
      <div className="page">
        <div className="page-inner empty-page muted">
          <Loader size={20} className="spin" />
        </div>
      </div>
    );
  }

  const openCount = annotations.filter((a) => !a.resolved).length;
  const isFour = note.type === 'four_zone';
  const isPdf = note.type === 'pdf';
  const isWide = isFour || isPdf;

  return (
    <div className={`note-layout ${panelOpen ? 'has-panel' : ''}`}>
      <div className={`page note-page ${isFour ? 'is-fourzone' : ''} ${isPdf ? 'is-pdf' : ''}`} data-width={pageWidth}>
        <div className="page-toolbar">
          <Breadcrumbs
            items={[
              kind && { key: 'kind', label: kind.label },
              folder && { key: 'folder', label: folder.code || folder.name || 'Untitled', to: `/f/${folder.id}`, icon: <FolderIcon folder={folder} size={13} /> },
              { key: 'note', label: noteMeta?.title || note.title || 'Untitled' },
            ]}
          />
          <SaveStatus status={status} />
          <button type="button" className={`btn ghost sm ${panelOpen ? 'is-active' : ''}`} onClick={() => setPanelOpen(!panelOpen)} title="Annotations">
            <MessageSquare size={15} /> {openCount || ''}
          </button>
          <button type="button" className="icon-btn" onClick={(e) => setMenu(e.currentTarget)} title="More">
            <More size={17} />
          </button>
          {menu && (
            <Menu
              anchor={menu}
              onClose={() => setMenu(null)}
              placement="bottom-end"
              items={[
                { label: 'Copy link', icon: LinkIcon, onClick: () => copyNoteLink(note.id) },
                { label: 'Move to…', icon: Move, onClick: () => setMoveMenu(menu) },
                {
                  label: 'Page width',
                  icon: MoveHorizontal,
                  hint: note.page_width ? PAGE_WIDTHS.find((p) => p.id === note.page_width)?.label : 'Default',
                  onClick: () => setWidthMenu(menu),
                },
                {
                  label: 'Duplicate',
                  icon: Copy,
                  onClick: async () => {
                    await flush();
                    const n = await useApp.getState().duplicateNote(note.id);
                    if (n) navigate(`/n/${n.id}`);
                  },
                },
                !isPdf && { label: isFour ? 'Convert to standard note' : 'Convert to 4-zone note', icon: isFour ? FileText : LayoutGrid, onClick: convert },
                { divider: true },
                { label: 'Delete note', icon: Trash, danger: true, onClick: remove },
              ]}
            />
          )}
          {widthMenu && (
            <Menu
              anchor={widthMenu}
              onClose={() => setWidthMenu(null)}
              placement="bottom-end"
              title="Page width for this note"
              items={[
                {
                  label: `Default (${PAGE_WIDTHS.find((p) => p.id === (globalWidth || 'normal'))?.label || 'Comfortable'})`,
                  description: 'Follow Settings → Appearance',
                  checked: !note.page_width,
                  onClick: () => setNoteWidth(null),
                },
                { divider: true },
                ...PAGE_WIDTHS.filter((p) => !isWide || p.id !== 'normal').map((p) => ({
                  label: p.label,
                  checked: note.page_width === p.id,
                  onClick: () => setNoteWidth(p.id),
                })),
              ]}
            />
          )}
          {moveMenu && (
            <Menu
              anchor={moveMenu}
              onClose={() => setMoveMenu(null)}
              placement="bottom-end"
              title="Move to"
              items={folders
                .filter((f) => f.id !== note.folder_id)
                .sort((a, b) => a.kind.localeCompare(b.kind) || a.position - b.position)
                .map((f) => ({
                  label: `${f.code ? `${f.code} · ` : ''}${f.name}`,
                  onClick: async () => {
                    await flush();
                    await useApp.getState().moveNote(note.id, f.id, null);
                    setNote((n) => ({ ...n, folder_id: f.id }));
                  },
                }))}
            />
          )}
        </div>

        <PageHeader cover={note.cover} icon={note.icon} title={note.title} onChange={patch} onTitleEnter={() => [...editors.current][0]?.commands.focus('start')}>
          <input className="page-subtitle" value={note.subtitle || ''} placeholder="Add a subtitle (lecture, chapter, paper…)" onChange={(e) => patch({ subtitle: e.target.value })} />
          <TagInput tags={note.tags || []} onChange={(tags) => patch({ tags })} />
        </PageHeader>

        <div className={`page-inner note-body ${isWide ? 'is-wide' : ''}`}>
          {isPdf ? (
            <PdfNote
              key={`${note.id}-${version}`}
              noteId={note.id}
              initial={note.content}
              onChange={saveContent}
              onEditorReady={onEditorReady}
              jump={pdfJump}
              onFirstUpload={(f) => {
                if (!(noteMeta?.title || note.title)) patch({ title: f.name.replace(/\.pdf$/i, '') });
              }}
            />
          ) : isFour ? (
            <FourZone
              key={`${note.id}-${version}`}
              initial={normalizeFourZone(note.content, settings.zoneDefaults)}
              onChange={saveContent}
              onEditorReady={onEditorReady}
            />
          ) : (
            <Editor key={`${note.id}-${version}`} content={note.content} onChange={saveContent} onReady={onEditorReady} autofocus={!note.title} />
          )}
        </div>
      </div>
      {panelOpen && (
        <AnnotationsPanel
          annotations={annotations}
          focusId={focusAnno}
          onUpdate={updateAnnotation}
          onDelete={deleteAnnotation}
          onJump={jump}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </div>
  );
}
