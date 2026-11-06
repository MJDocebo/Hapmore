// The three space types (kinds). Their stored ids stay 'course' | 'project' | 'research' forever; only the names
// and icons shown in the app are customizable (Settings → Spaces), so renaming never touches existing data.
/** Built-in space types: stored ids and default names. */
export const FOLDER_KINDS = [
  { kind: 'course', label: 'Courses', singular: 'Course', newName: 'New course' },
  { kind: 'project', label: 'Projects', singular: 'Project', newName: 'New project' },
  { kind: 'research', label: 'Research', singular: 'Research topic', newName: 'New research topic' },
];

export const KIND_DEFAULT_ICONS = { course: 'lucide:GraduationCap', project: 'lucide:Wrench', research: 'lucide:Microscope' };
export const NAME_MAX = 32;

/** Lowercases the first letter for use mid-sentence ("New course"), but leaves acronyms alone ("New OKR"). */
export function lowerFirst(s) {
  if (!s) return s;
  return s.length > 1 && s[1] === s[1].toUpperCase() && s[1] !== s[1].toLowerCase() ? s : s[0].toLowerCase() + s.slice(1);
}

const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '');

/** Normalizes the saved overrides: { course: { label?, singular?, icon? }, ... }. Empty values = default. */
export function normalizeSpaceKinds(saved) {
  const out = {};
  for (const k of FOLDER_KINDS) {
    const s = saved && typeof saved === 'object' ? saved[k.kind] || {} : {};
    const icon = typeof s.icon === 'string' && s.icon ? s.icon : '';
    out[k.kind] = { label: clean(s.label), singular: clean(s.singular), icon };
  }
  return out;
}

/** Best-guess singular for a renamed section: "Clients" → "Client", "Stories" → "Story", "Classes" → "Class". */
export function guessSingular(label) {
  const w = label.trim();
  if (/[^aeiou]ies$/i.test(w)) return `${w.slice(0, -3)}y`;
  if (/(ss|sh|ch|x|z)es$/i.test(w)) return w.slice(0, -2);
  if (/[^s']s$/i.test(w) && !/(us|is|ous)$/i.test(w)) return w.slice(0, -1);
  return w;
}

/**
 * Effective kinds, in sidebar order: [{ kind, label, singular, newName, icon, isCustom }].
 * `spaceKinds` is settings.spaceKinds (already normalized by mergeSettings).
 */
export function resolveFolderKinds(spaceKinds) {
  const custom = normalizeSpaceKinds(spaceKinds);
  return FOLDER_KINDS.map((k) => {
    const c = custom[k.kind];
    const label = c.label || k.label;
    // A renamed section without its own singular gets one derived from the new name.
    const singular = c.singular || (c.label ? guessSingular(c.label) : k.singular);
    const singularChanged = !!(c.singular || c.label);
    return {
      kind: k.kind,
      label,
      singular,
      // Keep the hand-written default ("New research topic") unless the name was changed.
      newName: singularChanged ? `New ${lowerFirst(singular)}` : k.newName,
      icon: c.icon || KIND_DEFAULT_ICONS[k.kind],
      isCustom: !!(c.label || c.singular || c.icon),
    };
  });
}

export function resolveFolderKind(spaceKinds, kind) {
  const all = resolveFolderKinds(spaceKinds);
  return all.find((k) => k.kind === kind) || all[0];
}

/** "a course, a project or a research topic" style list, for help text. */
export function kindsSentence(kinds, joiner = 'or') {
  const names = kinds.map((k) => lowerFirst(k.singular));
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} ${joiner} ${names[names.length - 1]}` : names[0] || '';
}
