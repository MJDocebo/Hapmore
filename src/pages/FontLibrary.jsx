import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store/useApp';
import {
  DEFAULT_GOOGLE_FONTS, FONT_GROUPS, fontsByGroup, fontStack, guessCategory, loadFont, parseGoogleFontInput,
  setFontLibrary, systemFallbackName, verifyGoogleFont,
} from '../lib/fonts';
import { Plus, Trash, RotateCcw, Loader, ExternalLink } from '../components/icons';
import { ROLE_LABELS, TYPE_ROLES } from '../lib/typography';

const ADDABLE_GROUPS = FONT_GROUPS.filter((g) => g.id !== 'system');
const SAMPLE = {
  mono: 'for (let i = 0; i < n; i++) { sum += a[i]; }',
  default: 'The quick brown fox jumps over the lazy dog — 0123456789',
};

function usageOf(name, settings) {
  const uses = [];
  TYPE_ROLES.forEach((r) => settings.fonts[r.key] === name && uses.push(ROLE_LABELS[r.key]));
  (settings.customStyles || []).forEach((s) => s.font === name && uses.push(`“${s.name}” style`));
  return uses;
}

export default function FontLibrary() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const toast = useApp((s) => s.toast);
  const library = settings.fontLibrary;
  setFontLibrary(library);
  const groups = useMemo(() => fontsByGroup(library), [library]);

  const [input, setInput] = useState('');
  const [category, setCategory] = useState('sans');
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    library.forEach((f) => loadFont(f.name));
  }, [library]);

  const parsed = parseGoogleFontInput(input);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    const name = parsed;
    if (!name) return;
    const exists = [...library].some((f) => f.name.toLowerCase() === name.toLowerCase()) || /^system (ui|serif|mono)$/i.test(name);
    if (exists) {
      setError(`“${name}” is already in your library.`);
      return;
    }
    setBusy(true);
    try {
      const { weights } = await verifyGoogleFont(name);
      const font = { name, category, weights };
      update((s) => ({ fontLibrary: [...s.fontLibrary, font] }));
      setFontLibrary([...library, font]);
      loadFont(name);
      toast(`Added ${name}`);
      setInput('');
      setCategoryTouched(false);
      setCategory('sans');
    } catch (err) {
      setError(err.message || String(err));
    }
    setBusy(false);
  };

  const remove = async (font) => {
    const uses = usageOf(font.name, settings);
    const fallback = systemFallbackName(font.category);
    const ok = await useApp.getState().confirm({
      title: `Delete ${font.name}?`,
      message: uses.length
        ? `It’s used by ${uses.join(', ')}. Those will switch to ${fallback}.`
        : 'It will be removed from your font library. You can add it again any time.',
      confirmLabel: 'Delete font',
      danger: true,
    });
    if (!ok) return;
    update((s) => {
      const fonts = { ...s.fonts };
      Object.keys(fonts).forEach((k) => fonts[k] === font.name && (fonts[k] = fallback));
      return {
        fontLibrary: s.fontLibrary.filter((f) => f.name !== font.name),
        fonts,
        customStyles: s.customStyles.map((st) => (st.font === font.name ? { ...st, font: fallback } : st)),
      };
    });
  };

  const missingDefaults = DEFAULT_GOOGLE_FONTS.filter((d) => !library.some((f) => f.name === d.name));

  return (
    <div className="settings-section">
      <h3>Add a Google Font</h3>
      <p className="muted small">
        Browse{' '}
        <a className="link" href="https://fonts.google.com" target="_blank" rel="noreferrer">
          fonts.google.com <ExternalLink size={11} />
        </a>{' '}
        and paste a font’s name (e.g. <code>Fira Sans</code>) or its page URL. The font is checked against Google Fonts before it’s added.
      </p>
      <form className="font-add" onSubmit={add}>
        <input
          className="input"
          placeholder="Font name or fonts.google.com URL"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError('');
            if (!categoryTouched) setCategory(guessCategory(parseGoogleFontInput(e.target.value)));
          }}
        />
        <select
          className="input"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setCategoryTouched(true);
          }}
          title="Which group the font appears in"
        >
          {ADDABLE_GROUPS.map((g) => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </select>
        <button type="submit" className="btn primary" disabled={!parsed || busy}>
          {busy ? <Loader size={15} className="spin" /> : <Plus size={15} />} Add font
        </button>
      </form>
      {parsed && input.trim() !== parsed && !error && <div className="muted small">Will add: <strong>{parsed}</strong></div>}
      {error && <div className="alert is-error">{error}</div>}

      <div className="section-head font-lib-head">
        <h3>Your fonts</h3>
        {missingDefaults.length > 0 && (
          <button type="button" className="btn sm ghost" onClick={() => update((s) => ({ fontLibrary: [...s.fontLibrary, ...missingDefaults] }))}>
            <RotateCcw size={14} /> Restore {missingDefaults.length} default font{missingDefaults.length === 1 ? '' : 's'}
          </button>
        )}
      </div>
      {groups.map((g) => (
        <div key={g.id} className="font-group">
          <div className="font-group-label">
            {g.label} <span className="muted">· {g.fonts.length}</span>
          </div>
          {g.fonts.map((f) => {
            const uses = usageOf(f.name, settings);
            return (
              <div key={f.name} className={`font-row ${f.system ? 'is-system' : ''}`}>
                <div className="font-row-main">
                  <div className="font-row-name">
                    {f.name}
                    {f.system && <span className="pill">Built-in · fallback for {f.fallbackFor}</span>}
                    {uses.length > 0 && <span className="pill is-accent" title={uses.join(', ')}>In use: {uses.join(', ')}</span>}
                  </div>
                  <div className="font-row-sample" style={{ fontFamily: fontStack(f.name) }}>
                    {f.category === 'mono' || f.fallbackFor === 'mono' ? SAMPLE.mono : SAMPLE.default}
                  </div>
                </div>
                {!f.system && <span className="font-row-weights muted small">{f.weights ? f.weights.split(';').join(' · ') : 'regular'}</span>}
                {f.system ? (
                  <span className="font-row-lock muted small" title="System fonts can’t be deleted">Always available</span>
                ) : (
                  <button type="button" className="icon-btn" title={`Delete ${f.name}`} onClick={() => remove(f)}>
                    <Trash size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
