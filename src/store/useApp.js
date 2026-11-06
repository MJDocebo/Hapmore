import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { mergeSettings, makeFourZoneContent, randomCover } from '../lib/defaults';
import { resolveFolderKind } from '../lib/spaceKinds';
import { useTabs } from './useTabs';
import { debounce, sanitizeEmojiName } from '../lib/utils';
import { getSignedUrls, removeFile, uploadFile } from '../lib/storage';
import { normalizePdfContent, removePdfIfUnused } from '../lib/pdf';

const NOTE_META = 'id, folder_id, type, title, subtitle, icon, tags, position, created_at, updated_at';

let toastSeq = 1;
let dialogSeq = 1;

const persistSettings = debounce(async (userId, settings) => {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, settings }, { onConflict: 'user_id' });
  if (error) useApp.getState().toast(`Could not save settings: ${error.message}`, 'error');
}, 600);

export const useApp = create((set, get) => ({
  session: null,
  authReady: false,
  dataReady: false,
  settings: mergeSettings({}),
  folders: [],
  notes: [],
  emojis: [], // { id, name, storage_path, url }
  toasts: [],
  dialog: null, // { id, kind: 'confirm' | 'prompt', title, message, confirmLabel, danger, resolve }
  activeEditor: null,
  resolvedTheme: 'light',
  annotationsVersion: 0,

  // ---------------------------------------------------------------- toasts
  toast(message, kind = 'info') {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 6000 : 3000);
  },
  // ---------------------------------------------------------------- dialogs (replace window.confirm / prompt)
  /** Resolves true/false. opts: { title, message, confirmLabel, cancelLabel, danger } */
  confirm(opts) {
    return get().openDialog({ kind: 'confirm', ...opts });
  },
  /** Resolves the entered string, or null when canceled. opts: { title, message, placeholder, defaultValue, confirmLabel } */
  promptText(opts) {
    return get().openDialog({ kind: 'prompt', ...opts });
  },
  openDialog(opts) {
    const prev = get().dialog;
    if (prev) prev.resolve(prev.kind === 'prompt' ? null : false);
    return new Promise((resolve) => set({ dialog: { id: dialogSeq++, ...opts, resolve } }));
  },
  closeDialog(result) {
    const d = get().dialog;
    if (!d) return;
    set({ dialog: null });
    d.resolve(result);
  },
  fail(error, prefix = 'Something went wrong') {
    console.error(prefix, error);
    get().toast(`${prefix}: ${error?.message || error}`, 'error');
  },

  setActiveEditor(editor) {
    if (get().activeEditor !== editor) set({ activeEditor: editor });
  },
  bumpAnnotations() {
    set((s) => ({ annotationsVersion: s.annotationsVersion + 1 }));
  },

  // ---------------------------------------------------------------- auth/session
  setSession(session) {
    const prev = get().session;
    set({ session, authReady: true });
    if (session && (!prev || prev.user.id !== session.user.id)) get().loadAll();
    if (!session) set({ folders: [], notes: [], emojis: [], dataReady: false, settings: mergeSettings({}) });
  },

  async signOut() {
    persistSettings.flush();
    useTabs.getState().reset();
    await supabase.auth.signOut();
  },

  async loadAll() {
    set({ dataReady: false });
    const [s, f, n, e] = await Promise.all([
      supabase.from('user_settings').select('settings').maybeSingle(),
      supabase.from('folders').select('*').order('position'),
      supabase.from('notes').select(NOTE_META).order('position'),
      supabase.from('custom_emojis').select('*').order('name'),
    ]);
    [s, f, n, e].forEach((r) => r.error && get().fail(r.error, 'Loading failed'));
    const emojis = e.data || [];
    const urls = emojis.length ? await getSignedUrls(emojis.map((x) => x.storage_path)) : {};
    set({
      settings: mergeSettings(s.data?.settings || {}),
      folders: f.data || [],
      notes: n.data || [],
      emojis: emojis.map((x) => ({ ...x, url: urls[x.storage_path] || null })),
      dataReady: true,
    });
  },

  // ---------------------------------------------------------------- settings
  updateSettings(patch) {
    const next = mergeSettings({ ...get().settings, ...(typeof patch === 'function' ? patch(get().settings) : patch) });
    set({ settings: next });
    const uid = get().session?.user?.id;
    if (uid) persistSettings(uid, next);
  },

  // ---------------------------------------------------------------- folders
  async createFolder(kind) {
    const meta = resolveFolderKind(get().settings.spaceKinds, kind);
    const siblings = get().folders.filter((f) => f.kind === kind);
    const position = siblings.length ? Math.max(...siblings.map((f) => f.position)) + 1 : 1;
    const { data, error } = await supabase
      .from('folders')
      .insert({ kind, name: meta.newName, icon: null, position, cover: randomCover() })
      .select('*')
      .single();
    if (error) return get().fail(error, 'Could not create folder');
    set((s) => ({ folders: [...s.folders, data] }));
    return data;
  },

  async updateFolder(id, patch) {
    set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
    const { error } = await supabase.from('folders').update(patch).eq('id', id);
    if (error && 'background' in patch && /background/i.test(error.message || '')) {
      return get().toast('Per-space backgrounds need a database update: run supabase/schema.sql again in the Supabase SQL Editor.', 'error');
    }
    if (error) get().fail(error, 'Could not update folder');
  },

  async deleteFolder(id) {
    // Notes are removed by the database (on delete cascade); collect their uploaded PDFs first so the files go too.
    let pdfPaths = [];
    if (get().notes.some((n) => n.folder_id === id && n.type === 'pdf')) {
      const { data } = await supabase.from('notes').select('content').eq('folder_id', id).eq('type', 'pdf');
      pdfPaths = (data || []).map((r) => normalizePdfContent(r.content).pdf?.path).filter(Boolean);
    }
    const { error } = await supabase.from('folders').delete().eq('id', id);
    if (error) return get().fail(error, 'Could not delete folder');
    set((s) => ({ folders: s.folders.filter((f) => f.id !== id), notes: s.notes.filter((n) => n.folder_id !== id) }));
    [...new Set(pdfPaths)].forEach((p) => removePdfIfUnused(p).catch(() => {}));
  },

  // ---------------------------------------------------------------- notes
  async createNote(folderId, type = 'standard') {
    const siblings = get().notes.filter((n) => n.folder_id === folderId);
    const position = siblings.length ? Math.max(...siblings.map((n) => n.position)) + 1 : 1;
    const content = type === 'four_zone' ? makeFourZoneContent(get().settings.zoneDefaults) : type === 'pdf' ? normalizePdfContent(null) : null;
    const icon = { four_zone: '🧭', pdf: '📄' }[type] || '📝';
    const { data, error } = await supabase
      .from('notes')
      .insert({ folder_id: folderId, type, title: '', icon, position, content })
      .select(NOTE_META)
      .single();
    if (error) return get().fail(error, 'Could not create note');
    set((s) => ({
      notes: [...s.notes, data],
      folders: s.folders.map((f) => (f.id === folderId && f.collapsed ? { ...f, collapsed: false } : f)),
    }));
    return data;
  },

  /** Updates the sidebar copy of a note (title, icon…). Pass persist=true to also write to the DB. */
  patchNoteMeta(id, patch, persist = false) {
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
    if (persist) {
      supabase
        .from('notes')
        .update(patch)
        .eq('id', id)
        .then(({ error }) => error && get().fail(error, 'Could not save note'));
    }
  },

  async deleteNote(id) {
    // PDF notes own an uploaded file: remember it so it can be removed with the note.
    let pdfPath = null;
    if (get().notes.find((n) => n.id === id)?.type === 'pdf') {
      const { data } = await supabase.from('notes').select('content').eq('id', id).maybeSingle();
      pdfPath = normalizePdfContent(data?.content).pdf?.path || null;
    }
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) return get().fail(error, 'Could not delete note');
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
    if (pdfPath) removePdfIfUnused(pdfPath).catch(() => {});
  },

  async duplicateNote(id) {
    const { data: src, error } = await supabase.from('notes').select('*').eq('id', id).single();
    if (error) return get().fail(error, 'Could not duplicate');
    const { id: _id, created_at, updated_at, user_id, ...rest } = src;
    const { data, error: e2 } = await supabase
      .from('notes')
      .insert({ ...rest, title: `${src.title || 'Untitled'} (copy)`, position: src.position + 0.5 })
      .select(NOTE_META)
      .single();
    if (e2) return get().fail(e2, 'Could not duplicate');
    set((s) => ({ notes: [...s.notes, data] }));
    return data;
  },

  /** Drag & drop: move a note into folderId, placed before `beforeId` (or at end when null). */
  async moveNote(noteId, folderId, beforeId = null) {
    const all = get().notes;
    const note = all.find((n) => n.id === noteId);
    if (!note || noteId === beforeId) return;
    const siblings = all.filter((n) => n.folder_id === folderId && n.id !== noteId).sort((a, b) => a.position - b.position);
    let position;
    const idx = beforeId ? siblings.findIndex((n) => n.id === beforeId) : -1;
    if (idx === -1) position = siblings.length ? siblings[siblings.length - 1].position + 1 : 1;
    else if (idx === 0) position = siblings[0].position - 1;
    else position = (siblings[idx - 1].position + siblings[idx].position) / 2;
    const prevFolder = note.folder_id;
    set((s) => ({
      notes: s.notes.map((n) => (n.id === noteId ? { ...n, folder_id: folderId, position } : n)),
      folders: s.folders.map((f) => (f.id === folderId && f.collapsed ? { ...f, collapsed: false } : f)),
    }));
    const { error } = await supabase.from('notes').update({ folder_id: folderId, position }).eq('id', noteId);
    if (error) {
      set((s) => ({ notes: s.notes.map((n) => (n.id === noteId ? { ...n, folder_id: prevFolder, position: note.position } : n)) }));
      get().fail(error, 'Could not move note');
    } else if (prevFolder !== folderId) {
      const f = get().folders.find((x) => x.id === folderId);
      get().toast(`Moved to ${f?.name || 'folder'}`);
    }
  },

  async moveFolder(folderId, kind, beforeId = null) {
    const all = get().folders;
    const folder = all.find((f) => f.id === folderId);
    if (!folder || folderId === beforeId) return;
    const siblings = all.filter((f) => f.kind === kind && f.id !== folderId).sort((a, b) => a.position - b.position);
    const idx = beforeId ? siblings.findIndex((f) => f.id === beforeId) : -1;
    let position;
    if (idx === -1) position = siblings.length ? siblings[siblings.length - 1].position + 1 : 1;
    else if (idx === 0) position = siblings[0].position - 1;
    else position = (siblings[idx - 1].position + siblings[idx].position) / 2;
    get().updateFolder(folderId, { kind, position });
  },

  // ---------------------------------------------------------------- custom emojis
  async addEmoji(file, rawName) {
    const name = sanitizeEmojiName(rawName || file.name);
    if (!name) throw new Error('Emoji needs a name (letters, numbers, _ + -).');
    if (get().emojis.some((e) => e.name === name)) throw new Error(`:${name}: already exists.`);
    const path = await uploadFile(file, 'emojis');
    const { data, error } = await supabase.from('custom_emojis').insert({ name, storage_path: path }).select('*').single();
    if (error) {
      await removeFile(path);
      throw error;
    }
    const urls = await getSignedUrls([path]);
    set((s) => ({ emojis: [...s.emojis, { ...data, url: urls[path] }].sort((a, b) => a.name.localeCompare(b.name)) }));
    return data;
  },

  async renameEmoji(id, rawName) {
    const name = sanitizeEmojiName(rawName);
    if (!name) throw new Error('Invalid name.');
    if (get().emojis.some((e) => e.name === name && e.id !== id)) throw new Error(`:${name}: already exists.`);
    const { error } = await supabase.from('custom_emojis').update({ name }).eq('id', id);
    if (error) throw error;
    set((s) => ({ emojis: s.emojis.map((e) => (e.id === id ? { ...e, name } : e)) }));
  },

  async deleteEmoji(id) {
    const e = get().emojis.find((x) => x.id === id);
    const { error } = await supabase.from('custom_emojis').delete().eq('id', id);
    if (error) return get().fail(error, 'Could not delete emoji');
    if (e) await removeFile(e.storage_path);
    set((s) => ({ emojis: s.emojis.filter((x) => x.id !== id) }));
  },
}));

export const flushSettings = () => persistSettings.flush();
