// Account-level data tools: export everything as a ZIP of Markdown + JSON, and delete all of the user's data.
import { supabase } from './supabase';
import { BUCKET } from './storage';
import { makeZip } from './zip';
import { docToMarkdown } from './markdown';

const KIND_DIR = { course: 'Courses', project: 'Projects', research: 'Research' };
const TYPE_LABEL = { standard: 'Note', four_zone: '4-Zone note', pdf: 'PDF note' };
const TABLES_IN_DELETE_ORDER = ['annotations', 'tasks', 'notes', 'folders', 'custom_emojis', 'user_settings'];

async function selectAll(table, columns = '*', order = 'created_at') {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select(columns).order(order).range(from, from + PAGE - 1);
    if (error) throw new Error(`Could not read ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** File/folder-safe name (Windows + macOS + iPadOS Files), unique within `used`. */
function safeName(raw, used, fallback = 'Untitled') {
  let base = (raw || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  if (!base) base = fallback;
  base = base.slice(0, 80);
  let name = base;
  for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base} (${i})`;
  used.add(name.toLowerCase());
  return name;
}

const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');
const toArchivePath = (storagePath) => `files/${storagePath.split('/').slice(1).join('/')}`; // drop "<user-id>/"
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');
const emojiText = (icon) => (icon && !String(icon).startsWith('custom:') ? `${icon} ` : '');

/** Every storage path referenced by a TipTap doc (images). */
function collectDocPaths(doc, out) {
  if (!doc || typeof doc !== 'object') return;
  if (doc.type === 'image' && doc.attrs?.path) out.add(doc.attrs.path);
  (doc.content || []).forEach((c) => collectDocPaths(c, out));
}

function noteDocs(note) {
  const c = note.content;
  if (!c) return [];
  if (note.type === 'four_zone') return (c.zones || []).map((z) => z.doc);
  if (note.type === 'pdf') return [c.doc];
  return [c];
}

/**
 * Builds the export ZIP. opts.includeFiles: also bundle images, PDFs, covers and custom emojis.
 * onProgress(text) receives status updates. Returns { blob, filename, counts, missing }.
 */
export async function exportAllData({ includeFiles = true, onProgress = () => {} } = {}) {
  onProgress('Reading your notes…');
  const [folders, notes, tasks, annotations, emojis, settingsRows] = await Promise.all([
    selectAll('folders', '*', 'position'),
    selectAll('notes', '*', 'position'),
    selectAll('tasks'),
    selectAll('annotations'),
    selectAll('custom_emojis'),
    selectAll('user_settings', '*', 'updated_at'),
  ]);

  // ---- archive paths for folders and notes (Kind/Space/Note.md)
  const usedByDir = new Map();
  const uniqueIn = (dir, raw, fb) => {
    if (!usedByDir.has(dir)) usedByDir.set(dir, new Set(['files', 'readme.md', 'tasks.md', 'backup.json', '_quick notes']));
    return safeName(raw, usedByDir.get(dir), fb);
  };
  const folderDir = new Map();
  for (const f of folders) {
    const kindDir = KIND_DIR[f.kind] || 'Other';
    folderDir.set(f.id, `${kindDir}/${uniqueIn(kindDir, [f.code, f.name].filter(Boolean).join(' - '), 'Untitled space')}`);
  }
  const notePath = new Map();
  for (const n of notes) {
    const dir = folderDir.get(n.folder_id) || 'Unfiled';
    notePath.set(n.id, `${dir}/${uniqueIn(dir, n.title, 'Untitled')}.md`);
  }

  // ---- files referenced by the data
  const filePaths = new Set();
  if (includeFiles) {
    for (const n of notes) {
      noteDocs(n).forEach((d) => collectDocPaths(d, filePaths));
      if (n.type === 'pdf' && n.content?.pdf?.path) filePaths.add(n.content.pdf.path);
      if (n.cover?.path) filePaths.add(n.cover.path);
    }
    for (const f of folders) {
      collectDocPaths(f.quick_notes, filePaths);
      if (f.cover?.path) filePaths.add(f.cover.path);
    }
    emojis.forEach((e) => e.storage_path && filePaths.add(e.storage_path));
  }

  const relFrom = (fromFile) => '../'.repeat(fromFile.split('/').length - 1);
  const mdOpts = (fromFile) => ({
    resolveImage: (path, src) =>
      path && includeFiles ? encodePath(relFrom(fromFile) + toArchivePath(path)) : src && /^https?:/i.test(src) ? src : null,
    resolveHref: (href) => {
      const m = /^\/n\/([0-9a-f-]{36})/i.exec(href || '');
      if (m && notePath.has(m[1])) return encodePath(relFrom(fromFile) + notePath.get(m[1]));
      return href;
    },
  });

  const annotationsByNote = new Map();
  annotations.forEach((a) => {
    if (!annotationsByNote.has(a.note_id)) annotationsByNote.set(a.note_id, []);
    annotationsByNote.get(a.note_id).push(a);
  });

  // ---- Markdown per note
  const files = [];
  for (const n of notes) {
    const path = notePath.get(n.id);
    const opts = mdOpts(path);
    const out = [`# ${emojiText(n.icon)}${n.title || 'Untitled'}`];
    if (n.subtitle) out.push(`*${n.subtitle}*`);
    const meta = [`${TYPE_LABEL[n.type] || 'Note'}`, `Created ${fmtDate(n.created_at)}`, `Updated ${fmtDate(n.updated_at)}`];
    if (n.tags?.length) meta.unshift(n.tags.map((t) => `#${t.replace(/\s+/g, '-')}`).join(' '));
    out.push(meta.join(' · '), '---');

    if (n.type === 'four_zone') {
      for (const z of n.content?.zones || []) {
        out.push(`## ${emojiText(z.emoji)}${z.title || 'Zone'}`, docToMarkdown(z.doc, opts) || '*(empty)*');
      }
    } else if (n.type === 'pdf') {
      const pdf = n.content?.pdf;
      if (pdf?.path) {
        out.push(
          includeFiles
            ? `📄 **PDF:** [${pdf.name || 'document.pdf'}](${encodePath(relFrom(path) + toArchivePath(pdf.path))})`
            : `📄 **PDF:** ${pdf.name || 'document.pdf'} *(file not included in this export)*`,
        );
      }
      const body = docToMarkdown(n.content?.doc, opts);
      if (body) out.push('## Notes', body);
    } else {
      out.push(docToMarkdown(n.content, opts));
    }

    const anns = annotationsByNote.get(n.id) || [];
    if (anns.length) {
      out.push('---', '## Margin notes');
      out.push(
        anns
          .map((a) => {
            const flags = [a.resolved && 'resolved', a.show_on_overview && 'pinned to overview'].filter(Boolean).join(', ');
            const quote = a.quote ? `> ${a.quote.replace(/\n/g, ' ')}\n\n` : '';
            return `${quote}${a.body || ''}${flags ? ` *(${flags})*` : ''}`;
          })
          .join('\n\n'),
      );
    }
    files.push({ name: path, data: `${out.filter(Boolean).join('\n\n')}\n`, date: new Date(n.updated_at) });
  }

  // ---- Quick notes per space
  for (const f of folders) {
    const md = docToMarkdown(f.quick_notes, mdOpts(`${folderDir.get(f.id)}/x`));
    if (md) files.push({ name: `${folderDir.get(f.id)}/_Quick notes.md`, data: `# Quick notes — ${f.name || 'Untitled'}\n\n${md}\n` });
  }

  // ---- Tasks
  const folderName = new Map(folders.map((f) => [f.id, f.name || 'Untitled']));
  const taskLine = (t) =>
    `- [${t.done ? 'x' : ' '}] ${t.title}${t.kind !== 'task' ? ` *(${t.kind})*` : ''}${t.due_date ? ` — due ${t.due_date}` : ''}`;
  const groups = new Map();
  tasks.forEach((t) => {
    const g = t.folder_id ? folderName.get(t.folder_id) || 'Other' : 'General';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(t);
  });
  if (tasks.length) {
    const body = [...groups].map(([g, list]) => `## ${g}\n\n${list.map(taskLine).join('\n')}`).join('\n\n');
    files.push({ name: 'Tasks.md', data: `# Tasks, deadlines & reminders\n\n${body}\n` });
  }

  // ---- Files
  const missing = [];
  if (filePaths.size) {
    const list = [...filePaths];
    let done = 0;
    const worker = async () => {
      while (list.length) {
        const p = list.shift();
        const { data, error } = await supabase.storage.from(BUCKET).download(p);
        if (error || !data) missing.push(p);
        else files.push({ name: toArchivePath(p), data: new Uint8Array(await data.arrayBuffer()) });
        done++;
        onProgress(`Downloading files… ${done}/${filePaths.size}`);
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
  }

  // ---- Full-fidelity backup + README
  const exportedAt = new Date();
  files.push({
    name: 'backup.json',
    data: JSON.stringify(
      {
        app: 'str(notes)',
        format: 1,
        exported_at: exportedAt.toISOString(),
        folders,
        notes,
        tasks,
        annotations,
        custom_emojis: emojis,
        settings: settingsRows[0]?.settings || {},
      },
      null,
      2,
    ),
  });
  const counts = { spaces: folders.length, notes: notes.length, tasks: tasks.length, files: filePaths.size - missing.length };
  files.push({
    name: 'README.md',
    data: [
      '# str(notes) export',
      `Exported ${fmtDate(exportedAt.toISOString())}.`,
      `- ${counts.spaces} spaces, ${counts.notes} notes, ${counts.tasks} tasks${includeFiles ? `, ${counts.files} files` : ''}`,
      '- Notes are Markdown files organized as `Courses|Projects|Research/<space>/<note>.md`; each space\'s quick notes are in `_Quick notes.md`.',
      '- `Tasks.md` lists tasks, deadlines and reminders.',
      includeFiles ? '- `files/` holds images, PDFs, covers and custom emojis referenced by your notes.' : '- Images and PDFs were not included in this export.',
      '- `backup.json` is a complete copy of the raw data (including formatting Markdown can\'t express, such as colors and layouts).',
      missing.length ? `\n**${missing.length} file(s) could not be downloaded:**\n${missing.map((m) => `- ${m}`).join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
      .concat('\n'),
  });

  onProgress('Building ZIP…');
  const stamp = exportedAt.toISOString().slice(0, 10);
  const root = `str-notes-export-${stamp}`;
  const blob = makeZip(files.map((f) => ({ ...f, name: `${root}/${f.name}` })));
  return { blob, filename: `${root}.zip`, counts, missing };
}

/** Saves a Blob as a download (works in desktop browsers and iPadOS Safari). */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Recursively lists every object path under `prefix` in the bucket. */
async function listAllFiles(prefix) {
  const out = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`Could not list files: ${error.message}`);
    for (const item of data || []) {
      const full = `${prefix}/${item.name}`;
      if (item.id == null) out.push(...(await listAllFiles(full))); // folder placeholder
      else out.push(full);
    }
    if (!data || data.length < PAGE) return out;
  }
}

/**
 * Permanently deletes every note, space, task, margin note, custom emoji, setting and uploaded file belonging to the
 * signed-in user. The sign-in account itself is kept. Returns { rows, files }.
 */
export async function deleteAllData({ onProgress = () => {} } = {}) {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id;
  if (!uid) throw new Error('You need to be signed in.');

  onProgress('Finding uploaded files…');
  const paths = await listAllFiles(uid);
  let removedFiles = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { error } = await supabase.storage.from(BUCKET).remove(chunk);
    if (error) throw new Error(`Could not delete files: ${error.message}`);
    removedFiles += chunk.length;
    onProgress(`Deleting files… ${removedFiles}/${paths.length}`);
  }

  let rows = 0;
  for (const table of TABLES_IN_DELETE_ORDER) {
    onProgress(`Deleting ${table.replace('_', ' ')}…`);
    const { error, count } = await supabase.from(table).delete({ count: 'exact' }).eq('user_id', uid);
    if (error) throw new Error(`Could not delete ${table}: ${error.message}`);
    rows += count || 0;
  }
  return { rows, files: removedFiles };
}
