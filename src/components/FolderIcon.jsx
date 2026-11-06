import * as L from 'lucide-react';
import EmojiIcon from './EmojiIcon';
import { useApp } from '../store/useApp';
import { resolveFolderKind } from '../lib/spaceKinds';

/** Line icons offered for space types in Settings → Spaces (any emoji or custom emoji works too). */
export const KIND_ICON_CHOICES = [
  'GraduationCap', 'BookOpen', 'Library', 'NotebookPen', 'School', 'Wrench', 'Hammer', 'Briefcase', 'Building2', 'Rocket',
  'Target', 'ClipboardList', 'Microscope', 'FlaskConical', 'Atom', 'Brain', 'Lightbulb', 'Search', 'Code', 'Terminal',
  'Palette', 'PenTool', 'Camera', 'Music', 'Users', 'Heart', 'HeartPulse', 'Dumbbell', 'Leaf', 'Globe',
  'Plane', 'Home', 'Star', 'Calendar', 'Folder', 'Archive',
].filter((n) => L[n]);

const lucide = (name) => (name && L[name]) || null;

/**
 * A space type's icon: "lucide:<Name>" draws a line icon; anything else is an emoji (native or "custom:<id>").
 */
export function KindIcon({ icon, size = 15, className = '' }) {
  if (icon && icon.startsWith('lucide:')) {
    const Icon = lucide(icon.slice(7)) || L.Folder;
    return <Icon size={Math.round(size * 0.93)} strokeWidth={size >= 40 ? 1.5 : 2} className={`folder-kind-icon ${className}`} aria-hidden="true" />;
  }
  return <EmojiIcon value={icon} size={size} className={className} />;
}

/**
 * A folder's emoji (native or custom) when set. With `fallback` (sidebar, tabs), a folder without an emoji shows its
 * space type's icon (customizable in Settings → Spaces); everywhere else it shows nothing.
 */
export default function FolderIcon({ folder, size = 15, className = '', fallback = false }) {
  const spaceKinds = useApp((s) => s.settings.spaceKinds);
  if (folder?.icon) return <EmojiIcon value={folder.icon} size={size} />;
  if (!fallback) return null;
  return <KindIcon icon={resolveFolderKind(spaceKinds, folder?.kind).icon} size={size} className={className} />;
}
