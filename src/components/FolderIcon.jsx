import EmojiIcon from './EmojiIcon';
import { GraduationCap, Wrench, Microscope } from './icons';

/** Line icon per space kind, used whenever a course / project / research folder has no emoji set. */
export const FOLDER_KIND_ICONS = { course: GraduationCap, project: Wrench, research: Microscope };

export function folderKindIcon(kind) {
  return FOLDER_KIND_ICONS[kind] || Wrench;
}

/**
 * A folder's emoji (native or custom) when set. With `fallback` (sidebar only), a folder without an emoji shows its
 * kind's line icon in the same style as page-type icons; everywhere else it shows nothing.
 */
export default function FolderIcon({ folder, size = 15, className = '', fallback = false }) {
  if (folder?.icon) return <EmojiIcon value={folder.icon} size={size} />;
  if (!fallback) return null;
  const Icon = folderKindIcon(folder?.kind);
  return <Icon size={Math.round(size * 0.93)} strokeWidth={size >= 40 ? 1.5 : 2} className={`folder-kind-icon ${className}`} aria-hidden="true" />;
}
