// Per-tab context for pages rendered inside an in-app tab (see components/TabPanes).
import { createContext, useContext, useEffect, useRef } from 'react';

export const TabPaneContext = createContext({ tabId: null, active: true, activations: 0, setBg: null });

export const useTabPane = () => useContext(TabPaneContext);

/** True while this page's tab is the one on screen. */
export const useIsActiveTab = () => useContext(TabPaneContext).active;

/** Ref version of useIsActiveTab, for window-level event handlers. */
export function useIsActiveTabRef() {
  const active = useIsActiveTab();
  const ref = useRef(active);
  useEffect(() => {
    ref.current = active;
  }, [active]);
  return ref;
}

/**
 * Counter that goes up each time you come back to this page's tab. Add it to a data-loading effect's
 * dependencies so lists (tasks, flagged annotations…) pick up changes made in other tabs, without remounting
 * the page and losing what you were typing.
 */
export const useTabActivation = () => useContext(TabPaneContext).activations;
