import { useEffect } from 'react';
import { useApp } from '../store/useApp';
import { buildCustomStyleCss, fontStack, loadFont, setFontLibrary } from './fonts';
import { TYPE_ROLES, typographyVars } from './typography';
import { BG_INTENSITIES } from './utils';

function systemDark() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Applies theme, typography and custom inline styles from settings to the document. */
export function useAppearance() {
  const settings = useApp((s) => s.settings);
  const { theme, fonts, sizes, textColors, customStyles, fontLibrary, bgIntensity } = settings;
  const resolvedTheme = useApp((s) => s.resolvedTheme);
  setFontLibrary(fontLibrary); // keep the font registry in sync before stacks are computed

  useEffect(() => {
    const apply = () => {
      const resolved = theme === 'system' ? (systemDark() ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
      if (useApp.getState().resolvedTheme !== resolved) useApp.setState({ resolvedTheme: resolved });
    };
    apply();
    if (theme !== 'system' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement.style;
    TYPE_ROLES.forEach((r) => fonts[r.key] && loadFont(fonts[r.key]));
    Object.entries(typographyVars({ fonts, sizes, textColors }, fontStack, resolvedTheme)).forEach(([k, v]) => {
      if (v === null) root.removeProperty(k);
      else root.setProperty(k, v);
    });
  }, [fonts, sizes, textColors, fontLibrary, resolvedTheme]);

  useEffect(() => {
    // Scales every user-chosen background tint (highlights, block backgrounds, callouts, zones, text styles).
    const k = (BG_INTENSITIES.find((x) => x.id === bgIntensity) || BG_INTENSITIES[BG_INTENSITIES.length - 1]).k;
    document.documentElement.style.setProperty('--tint-k', String(k));
  }, [bgIntensity]);

  useEffect(() => {
    (customStyles || []).forEach((s) => s.font && loadFont(s.font));
    let el = document.getElementById('hm-custom-styles');
    if (!el) {
      el = document.createElement('style');
      el.id = 'hm-custom-styles';
      document.head.appendChild(el);
    }
    el.textContent = buildCustomStyleCss(customStyles);
  }, [customStyles, fontLibrary]);
}
