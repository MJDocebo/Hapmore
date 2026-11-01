import { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '../editor/Editor';
import { useApp } from '../store/useApp';
import { pickFile, uploadFile } from '../lib/storage';
import { PDF_MAX_MB, formatBytes, isPdfFile, normalizePdfContent, removePdfIfUnused, usePdfUrl } from '../lib/pdf';
import { copyNoteLink } from '../lib/links';
import { BookOpenText, ExternalLink, FileUp, LinkIcon, Loader, Replace } from '../components/icons';

/**
 * PDF note: the document on the left (browser's built-in viewer), block notes on the right.
 * content = { pdf: { path, name, size } | null, doc, split }. Deep links: /n/<id>?page=N → `jump`.
 */
export default function PdfNote({ noteId, initial, onChange, onEditorReady, jump, onFirstUpload }) {
  const start = normalizePdfContent(initial);
  const [pdf, setPdf] = useState(start.pdf);
  const [split, setSplit] = useState(start.split);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState(() => ({ page: jump?.page || 1, nonce: 0 }));
  const [pageInput, setPageInput] = useState(String(jump?.page || 1));
  const contentRef = useRef(start);
  const splitRef = useRef(null);
  const toast = useApp((s) => s.toast);
  const fail = useApp((s) => s.fail);
  const { url, error } = usePdfUrl(pdf?.path);

  const emit = useCallback(
    (p) => {
      contentRef.current = { ...contentRef.current, ...p };
      onChange(contentRef.current);
    },
    [onChange],
  );

  const goTo = useCallback((n) => {
    const page = Math.max(1, Math.floor(Number(n)) || 1);
    setPageInput(String(page));
    setView((v) => ({ page, nonce: v.nonce + 1 })); // nonce remounts the viewer so the jump always happens
  }, []);

  // Link clicked while this note is already open (/n/<id>?page=N)
  useEffect(() => {
    if (jump && jump.page) goTo(jump.page);
  }, [jump, goTo]);

  const upload = async (file) => {
    if (!file) return;
    if (!isPdfFile(file)) {
      toast('That file isn’t a PDF.', 'error');
      return;
    }
    if (file.size > PDF_MAX_MB * 1024 * 1024) {
      toast(`That PDF is ${formatBytes(file.size)} — the limit is ${PDF_MAX_MB} MB.`, 'error');
      return;
    }
    const old = pdf;
    if (old) {
      const ok = await useApp.getState().confirm({
        title: 'Replace the PDF?',
        message: `“${old.name}” will be replaced with “${file.name}”. Your notes stay as they are.`,
        confirmLabel: 'Replace PDF',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      // Always send an explicit PDF content type (some OSes report an empty file.type).
      const typed = file.type === 'application/pdf' ? file : new File([file], file.name, { type: 'application/pdf' });
      const path = await uploadFile(typed, 'pdfs', { maxMB: PDF_MAX_MB });
      const next = { path, name: file.name || 'Document.pdf', size: file.size };
      setPdf(next);
      emit({ pdf: next });
      goTo(1);
      if (!old && onFirstUpload) onFirstUpload(next);
      if (old) removePdfIfUnused(old.path, noteId).catch(() => {});
    } catch (err) {
      fail(err, /mime|maximum allowed size|exceeded/i.test(err?.message || '') ? 'PDF uploads need a quick database update (run supabase/schema.sql again)' : 'Could not upload the PDF');
    } finally {
      setBusy(false);
    }
  };
  const choose = () => pickFile('application/pdf,.pdf').then(upload);

  const dropProps = {
    onDragOver: (e) => {
      if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: (e) => !e.currentTarget.contains(e.relatedTarget) && setDragOver(false),
    onDrop: (e) => {
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault();
      setDragOver(false);
      upload(e.dataTransfer.files[0]);
    },
  };

  // Drag the divider to resize the panes (saved with the note).
  const startResize = (e) => {
    e.preventDefault();
    const box = splitRef.current?.getBoundingClientRect();
    if (!box) return;
    setDragging(true);
    document.body.classList.add('is-resizing');
    let last = split;
    const move = (ev) => {
      last = Math.min(75, Math.max(25, ((ev.clientX - box.left) / box.width) * 100));
      setSplit(last);
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.classList.remove('is-resizing');
      setDragging(false);
      emit({ split: Math.round(last * 10) / 10 });
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  const nudge = (d) => {
    const next = Math.min(75, Math.max(25, split + d));
    setSplit(next);
    emit({ split: next });
  };

  const linkPage = Number(pageInput) > 1 ? Number(pageInput) : null;

  return (
    <div
      ref={splitRef}
      className={`pdf-split ${dragging ? 'is-dragging' : ''}`}
      style={{ gridTemplateColumns: `minmax(0, ${split}fr) 14px minmax(0, ${100 - split}fr)` }}
    >
      <section className={`pdf-pane ${dragOver ? 'is-dragover' : ''}`} {...dropProps}>
        {pdf ? (
          <>
            <div className="pdf-bar">
              <BookOpenText size={15} className="pdf-bar-icon" />
              <span className="pdf-name" title={pdf.name}>{pdf.name}</span>
              {pdf.size ? <span className="pdf-size">{formatBytes(pdf.size)}</span> : null}
              <form
                className="pdf-page"
                onSubmit={(e) => {
                  e.preventDefault();
                  goTo(pageInput);
                }}
              >
                <label htmlFor={`pdf-page-${noteId}`}>Page</label>
                <input
                  id={`pdf-page-${noteId}`}
                  className="input sm"
                  inputMode="numeric"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
                  onBlur={() => !pageInput && setPageInput(String(view.page))}
                  title="Jump to a page (Enter)"
                />
              </form>
              <button type="button" className="icon-btn sm" title={linkPage ? `Copy link to page ${linkPage}` : 'Copy link to this PDF'} onClick={() => copyNoteLink(noteId, { page: linkPage })}>
                <LinkIcon size={15} />
              </button>
              <button type="button" className="icon-btn sm" title="Open in a new tab" disabled={!url} onClick={() => url && window.open(`${url}#page=${view.page}`, '_blank', 'noopener')}>
                <ExternalLink size={15} />
              </button>
              <button type="button" className="icon-btn sm" title="Replace PDF…" onClick={choose} disabled={busy}>
                {busy ? <Loader size={15} className="spin" /> : <Replace size={15} />}
              </button>
            </div>
            <div className="pdf-frame">
              {url ? (
                <iframe key={`${url}-${view.nonce}`} title={pdf.name} src={`${url}#page=${view.page}`} />
              ) : error ? (
                <div className="pdf-state is-error">
                  <p>{error}</p>
                  <button type="button" className="btn sm" onClick={choose}>Upload it again</button>
                </div>
              ) : (
                <div className="pdf-state muted">
                  <Loader size={18} className="spin" /> Loading PDF…
                </div>
              )}
            </div>
          </>
        ) : (
          <button type="button" className="pdf-drop" onClick={choose} disabled={busy}>
            {busy ? <Loader size={26} className="spin" /> : <FileUp size={26} />}
            <strong>{busy ? 'Uploading…' : 'Add a PDF'}</strong>
            <span>Drop a file here or click to choose · up to {PDF_MAX_MB} MB</span>
          </button>
        )}
        {dragOver && <div className="pdf-dropveil">Drop to {pdf ? 'replace the' : 'add this'} PDF</div>}
      </section>

      <div
        className="pdf-divider"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize PDF and notes"
        aria-valuenow={Math.round(split)}
        aria-valuemin={25}
        aria-valuemax={75}
        tabIndex={0}
        onMouseDown={startResize}
        onDoubleClick={() => nudge(55 - split)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') nudge(-5);
          if (e.key === 'ArrowRight') nudge(5);
        }}
        title="Drag to resize · double-click to reset"
      />

      <section className="pdf-notes">
        <div className="pdf-notes-label">Notes</div>
        <Editor
          content={start.doc}
          placeholder="Take notes on this PDF… type '\' for blocks"
          onChange={(doc) => emit({ doc })}
          onReady={onEditorReady}
        />
      </section>
    </div>
  );
}
