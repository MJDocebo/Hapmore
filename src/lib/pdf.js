import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { BUCKET, removeFile } from './storage';

/** Max PDF size. Keep in sync with the bucket's file_size_limit in supabase/schema.sql (50 MB). */
export const PDF_MAX_MB = 50;

/** PDF note content: { pdf: { path, name, size } | null, doc: TipTap doc | null, split: % width of the PDF pane }. */
export function normalizePdfContent(c) {
  const src = c && typeof c === 'object' ? c : {};
  const pdf = src.pdf && typeof src.pdf.path === 'string' ? { path: src.pdf.path, name: src.pdf.name || 'Document.pdf', size: Number(src.pdf.size) || 0 } : null;
  const doc = src.doc && src.doc.type === 'doc' ? src.doc : null;
  const split = Math.min(75, Math.max(25, Number(src.split) || 55));
  return { pdf, doc, split };
}

export function isPdfFile(file) {
  return !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
}

export function formatBytes(n) {
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/*
 * PDFs are shown with the browser's built-in viewer. The file is downloaded once and served from a
 * same-origin blob: URL, which avoids cross-origin framing restrictions and makes #page=N jumps cheap.
 * A small LRU keeps the last few documents in memory.
 */
const LRU_SIZE = 3;
const blobCache = new Map(); // path -> Promise<string>

function evict() {
  while (blobCache.size > LRU_SIZE) {
    const [oldest, p] = blobCache.entries().next().value;
    blobCache.delete(oldest);
    p.then((url) => url && URL.revokeObjectURL(url)).catch(() => {});
  }
}

function loadPdfUrl(path) {
  if (blobCache.has(path)) {
    const p = blobCache.get(path);
    blobCache.delete(path); // refresh LRU position
    blobCache.set(path, p);
    return p;
  }
  const p = supabase.storage
    .from(BUCKET)
    .download(path)
    .then(({ data, error }) => {
      if (error || !data) throw error || new Error('Download failed');
      return URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    });
  p.catch(() => blobCache.delete(path));
  blobCache.set(path, p);
  evict();
  return p;
}

/** React hook: { url, error } for a stored PDF (blob: URL). */
export function usePdfUrl(path) {
  const [state, setState] = useState({ url: null, error: null });
  useEffect(() => {
    let alive = true;
    setState({ url: null, error: null });
    if (!path) return undefined;
    loadPdfUrl(path).then(
      (url) => alive && setState({ url, error: null }),
      (err) => alive && setState({ url: null, error: err?.message || 'Could not load the PDF.' }),
    );
    return () => {
      alive = false;
    };
  }, [path]);
  return state;
}

/** Deletes a stored PDF unless another note (e.g. a duplicate) still uses it. */
export async function removePdfIfUnused(path, exceptNoteId = null) {
  if (!path) return;
  let q = supabase.from('notes').select('id', { count: 'exact', head: true }).eq('content->pdf->>path', path);
  if (exceptNoteId) q = q.neq('id', exceptNoteId);
  const { count, error } = await q;
  if (error || count) return; // still referenced (or unsure) → keep the file
  const p = blobCache.get(path);
  if (p) {
    blobCache.delete(path);
    p.then((url) => url && URL.revokeObjectURL(url)).catch(() => {});
  }
  await removeFile(path);
}
