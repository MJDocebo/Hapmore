// Helpers for opening pages in in-app tabs (see store/useTabs). Kept out of components so the editor can use them.
import { useApp } from '../store/useApp';
import { MAX_TABS, useTabs } from '../store/useTabs';

/** Opens a page in a new in-app tab (or focuses it if already open); warns when all tabs are in use. */
export function openInTab(path) {
  const result = useTabs.getState().open(path);
  if (result === 'full') useApp.getState().toast(`You can have up to ${MAX_TABS} tabs open. Close one to open another.`, 'info');
  return result;
}

/** Cmd/Ctrl-click or middle-click → open in a new tab. Returns true when handled. */
export function handleTabClick(e, path) {
  if (e.metaKey || e.ctrlKey || e.button === 1) {
    e.preventDefault();
    e.stopPropagation();
    openInTab(path);
    return true;
  }
  return false;
}
