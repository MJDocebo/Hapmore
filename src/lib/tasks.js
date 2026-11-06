// Completed-task archiving. A completed task stays in its widget for `days` days (Settings: taskArchiveDays), then
// shows only on Home → Archived tasks. Nothing is deleted or moved in the database; "archived" is derived from
// completed_at (set by a trigger; see supabase/schema.sql), falling back to updated_at on older databases.

const DAY = 86400000;

export const ARCHIVE_DAY_LABELS = { 0: 'Right away', 1: 'After 1 day', 3: 'After 3 days', 7: 'After 7 days', 14: 'After 14 days', 30: 'After 30 days' };

export const completedAt = (t) => (t && t.done ? t.completed_at || t.updated_at || t.created_at || null : null);

export function isArchived(t, days, now = Date.now()) {
  if (!t?.done) return false;
  const at = Date.parse(completedAt(t) || '');
  if (!Number.isFinite(at)) return false;
  const d = Number.isFinite(Number(days)) && days !== null ? Math.max(0, Number(days)) : 7;
  return now - at >= d * DAY;
}

/**
 * Local patch for a done/undone toggle: stamps completion time immediately so a task created weeks ago doesn't
 * vanish into the archive the instant it's checked (the database trigger sets the real value).
 */
export function localDonePatch(patch) {
  if (patch.done === undefined) return patch;
  const now = new Date().toISOString();
  return { ...patch, completed_at: patch.done ? now : null, updated_at: now };
}

export function formatCompleted(t) {
  const at = completedAt(t);
  if (!at) return '';
  const d = new Date(at);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function monthKey(t) {
  const at = completedAt(t);
  if (!at) return 'Unknown';
  return new Date(at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
