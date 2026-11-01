import { FileText, LayoutGrid, BookOpenText } from '../components/icons';

/**
 * Every note type str(notes) can create. Add an entry here (plus its editor in NotePage) and it
 * automatically appears in every "Add New" menu (folder overview, sidebar, empty states).
 */
export const NOTE_TYPES = [
  { type: 'standard', label: 'Note', badge: 'Note', description: 'A single page of blocks', Icon: FileText },
  { type: 'four_zone', label: '4-zone note', badge: '4-zone', description: 'Four customizable zones in one page', Icon: LayoutGrid },
  { type: 'pdf', label: 'PDF note', badge: 'PDF', description: 'Read a PDF on the left, take notes on the right', Icon: BookOpenText },
];

export function noteTypeMeta(type) {
  return NOTE_TYPES.find((t) => t.type === type) || NOTE_TYPES[0];
}

/** Menu items for <Menu items={…}>. */
export function noteTypeMenuItems(onPick) {
  return NOTE_TYPES.map((t) => ({ label: t.label, description: t.description, icon: t.Icon, onClick: () => onPick(t.type) }));
}
