import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { useApp } from '../store/useApp';
import { supabase, emailToUsername } from '../lib/supabase';
import { DEFAULT_SETTINGS, DEFAULT_COLORS, DEFAULT_CUSTOM_STYLES, DEFAULT_ZONES, ZONE_TEMPLATES, BLANK_STYLE, validateWrapper } from '../lib/defaults';
import { fontsByGroup, fontStack, loadFont, setFontLibrary } from '../lib/fonts';
import { CODE_LINE_HEIGHTS, DEFAULT_CODE_STYLE, LINE_HEIGHTS, ROLE_LABELS, SIZE_OPTIONS, TYPE_GROUPS, TYPE_ROLES, effectiveStyle, normalizeCodeStyle, withStyleFlag } from '../lib/typography';
import FontLibrary from './FontLibrary';
import { cssId, isHex, normalizeHex, shortId, sanitizeEmojiName, bgTint, BG_INTENSITIES } from '../lib/utils';
import { pickFile } from '../lib/storage';
import ColorPicker from '../components/ColorPicker';
import EmojiIcon from '../components/EmojiIcon';
import EmojiPicker from '../components/EmojiPicker';
import Popover from '../components/Popover';
import GradientPicker from '../components/GradientPicker';
import { BG_SCOPES, DEFAULT_BACKGROUNDS, bgCss, bgLabel } from '../lib/backgrounds';
import { Sun, Moon, Monitor, Plus, Trash, RotateCcw, Upload, Smile, Bold, Italic, UnderlineIcon } from '../components/icons';

const TABS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'typography', label: 'Typography' },
  { id: 'fonts', label: 'Fonts' },
  { id: 'colors', label: 'Colors' },
  { id: 'styles', label: 'Text styles' },
  { id: 'zones', label: '4-zone defaults' },
  { id: 'emojis', label: 'Custom emojis' },
  { id: 'account', label: 'Account' },
];

function FontSelect({ value, onChange, inheritLabel, className = '' }) {
  const library = useApp((s) => s.settings.fontLibrary);
  setFontLibrary(library);
  const grouped = fontsByGroup(library);
  const known = !value || grouped.some((g) => g.fonts.some((f) => f.name === value));
  return (
    <select
      className={`input sm font-select ${className}`}
      value={value || ''}
      aria-label="Font"
      onChange={(e) => {
        loadFont(e.target.value);
        onChange(e.target.value);
      }}
      style={value ? { fontFamily: fontStack(value) } : undefined}
    >
      {inheritLabel && <option value="">{inheritLabel}</option>}
      {!known && <option value={value}>{value} (removed — using system font)</option>}
      {grouped.map((g) => (
        <optgroup key={g.id} label={g.label}>
          {g.fonts.map((f) => (
            <option key={f.name} value={f.name}>{f.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** px size dropdown. `inheritLabel` adds a "same as …" (value 0) option. */
function SizeSelect({ value, onChange, inheritLabel, options = SIZE_OPTIONS, className = '' }) {
  const v = Number(value) || 0;
  const list = v && !options.includes(v) ? [...options, v].sort((a, b) => a - b) : options;
  return (
    <select className={`input sm size-select ${className}`} value={v} aria-label="Size" onChange={(e) => onChange(Number(e.target.value))}>
      {inheritLabel && <option value={0}>{inheritLabel}</option>}
      {list.map((n) => (
        <option key={n} value={n}>{n} px</option>
      ))}
    </select>
  );
}

/** Small button showing a color swatch; opens the preset/custom color picker. */
function ColorButton({ value, onChange, presets, label, noneLabel = 'Default', title }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <button type="button" className={`swatch-btn ${value ? '' : 'is-none'}`} title={title || label} onClick={(e) => setAnchor(e.currentTarget)}>
        <span className="swatch-dot" style={value ? { background: value } : undefined} />
        <span className="swatch-text">{value ? presets.find((p) => p.hex.toLowerCase() === value.toLowerCase())?.name || value : noneLabel}</span>
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} className="hm-menu pad">
          <ColorPicker label={label} value={value} presets={presets} onChange={(c) => onChange(c || '')} onDone={() => setAnchor(null)} />
        </Popover>
      )}
    </>
  );
}

function Appearance() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  return (
    <div className="settings-section">
      <h3>Theme</h3>
      <div className="choice-row">
        {[
          ['light', 'Light', Sun],
          ['dark', 'Dark', Moon],
          ['system', 'System', Monitor],
        ].map(([id, label, Icon]) => (
          <button type="button" key={id} className={`choice ${settings.theme === id ? 'is-active' : ''}`} onClick={() => update({ theme: id })}>
            <span className={`theme-preview is-${id}`} />
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
      <h3>Page width</h3>
      <div className="seg">
        {[
          ['normal', 'Comfortable'],
          ['wide', 'Wide'],
          ['full', 'Full width'],
        ].map(([id, label]) => (
          <button type="button" key={id} className={settings.pageWidth === id ? 'is-active' : ''} onClick={() => update({ pageWidth: id })}>
            {label}
          </button>
        ))}
      </div>
      <p className="muted small">
        Applies to your home, folder and note pages (not Settings). Any note can override it from its <strong>⋯ → Page width</strong> menu. 4-zone notes
        always get at least the wide layout.
      </p>
      <h3>Backgrounds</h3>
      <p className="muted small">
        A subtle gradient behind the Home page and spaces sets them apart from notes. Set one for Home and one for each kind of space; any single
        course, project or research topic can override it from its <strong>⋯ → Background</strong> menu.
      </p>
      <div className="bg-scope-grid">
        {BG_SCOPES.map((sc) => (
          <div className="bg-scope" key={sc.id}>
            <div className="bg-scope-head">
              <h4>{sc.label}</h4>
              <span className="muted small">{bgLabel(settings.backgrounds[sc.id])}</span>
              <span className="bg-scope-swatch" style={{ background: bgCss(settings.backgrounds[sc.id]) || 'var(--bg)' }} />
              <button
                type="button"
                className="btn ghost sm"
                title="Reset to the default gradient"
                onClick={() => update((st) => ({ backgrounds: { ...st.backgrounds, [sc.id]: DEFAULT_BACKGROUNDS[sc.id] } }))}
              >
                <RotateCcw size={13} /> Reset
              </button>
            </div>
            <GradientPicker
              wide
              value={settings.backgrounds[sc.id]}
              onChange={(g) => update((st) => ({ backgrounds: { ...st.backgrounds, [sc.id]: g || { off: true } } }))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const STYLE_TOGGLES = [
  { flag: 'bold', title: 'Bold', Icon: Bold },
  { flag: 'italic', title: 'Italic', Icon: Italic },
  { flag: 'underline', title: 'Underline', Icon: UnderlineIcon },
];

function Typography() {
  const { fonts, sizes, textColors, textStyles, codeStyle: savedCode, colorPresets } = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const code = normalizeCodeStyle(savedCode);
  const setRole = (key, field, v) => update((st) => ({ [field]: { ...st[field], [key]: v } }));
  const setCode = (patch) => update((st) => ({ codeStyle: { ...normalizeCodeStyle(st.codeStyle), ...patch } }));
  const toggleStyle = (key, flag) =>
    update((st) => ({ textStyles: withStyleFlag(st.textStyles, key, flag, !effectiveStyle(st.textStyles, key)[flag]) }));
  const codeExtrasDefault = { code: !code.blockBg && code.lineHeight === DEFAULT_CODE_STYLE.lineHeight && !code.lineNumbers, inlineCode: !code.inlineBg };
  const isDefault = (r) =>
    fonts[r.key] === r.font && Number(sizes[r.key]) === r.size && !textColors[r.key] && !(textStyles || {})[r.key] && codeExtrasDefault[r.key] !== false;
  const inheritName = (k) => ROLE_LABELS[k] || k;
  return (
    <div className="settings-section">
      <h3>Fonts, sizes & colors</h3>
      <p className="muted small">
        Defaults for every note. You can still override color on any block or selection inside a note. Need another typeface?{' '}
        <NavLink to="/settings/fonts" className="link">Add Google Fonts</NavLink>.
      </p>
      <div className="type-table" role="table">
        <div className="type-row type-head" role="row">
          <span>Element</span>
          <span>Font</span>
          <span>Size</span>
          <span>Style</span>
          <span>Color</span>
          <span />
        </div>
        {TYPE_GROUPS.map((group) => (
          <div key={group} className="type-group" role="rowgroup">
            <div className="type-group-label">{group}</div>
            {TYPE_ROLES.filter((r) => r.group === group).map((r) => (
              <div key={r.key} className="type-row" role="row">
                <span className="type-label">{r.label}</span>
                <FontSelect
                  value={fonts[r.key]}
                  inheritLabel={r.inheritFont ? `Same as ${inheritName(r.inheritFont).toLowerCase()}` : undefined}
                  onChange={(v) => setRole(r.key, 'fonts', v)}
                />
                <SizeSelect
                  value={sizes[r.key]}
                  inheritLabel={r.inheritSize === 'auto' ? 'Match surrounding text' : r.inheritSize ? `Same as ${inheritName(r.inheritSize).toLowerCase()}` : undefined}
                  onChange={(v) => setRole(r.key, 'sizes', v)}
                />
                <div className="st-toggles type-style" role="group" aria-label={`${r.label} formatting`}>
                  {STYLE_TOGGLES.map(({ flag, title, Icon }) => {
                    const on = effectiveStyle(textStyles, r.key)[flag];
                    const own = typeof (textStyles || {})[r.key]?.[flag] === 'boolean';
                    return (
                      <Toggle key={flag} on={on} title={`${title}${own ? '' : ' (default)'}`} onClick={() => toggleStyle(r.key, flag)}>
                        <Icon size={14} />
                      </Toggle>
                    );
                  })}
                </div>
                <ColorButton
                  value={textColors[r.key]}
                  presets={colorPresets}
                  label={`${r.label} color`}
                  noneLabel={r.defaultColor === 'secondary' ? 'Muted (default)' : 'Default'}
                  onChange={(c) => setRole(r.key, 'textColors', c)}
                />
                <button
                  type="button"
                  className="icon-btn xs type-reset"
                  title={`Reset ${r.label.toLowerCase()}`}
                  disabled={isDefault(r)}
                  onClick={() =>
                    update((st) => {
                      const nextStyles = { ...(st.textStyles || {}) };
                      delete nextStyles[r.key];
                      const cs = normalizeCodeStyle(st.codeStyle);
                      return {
                        fonts: { ...st.fonts, [r.key]: r.font },
                        sizes: { ...st.sizes, [r.key]: r.size },
                        textColors: { ...st.textColors, [r.key]: '' },
                        textStyles: nextStyles,
                        ...(r.key === 'code' ? { codeStyle: { ...cs, blockBg: '', lineHeight: DEFAULT_CODE_STYLE.lineHeight, lineNumbers: false } } : {}),
                        ...(r.key === 'inlineCode' ? { codeStyle: { ...cs, inlineBg: '' } } : {}),
                      };
                    })
                  }
                >
                  <RotateCcw size={13} />
                </button>
              </div>
            ))}
            {group === 'Code' && (
              <>
                <div className="type-row is-extra">
                  <span className="type-label">Backgrounds</span>
                  <div className="type-extra-controls">
                    <span className="type-extra-field">
                      <span className="muted small">Code blocks</span>
                      <ColorButton value={code.blockBg} presets={colorPresets} label="Code block background" noneLabel="Default" onChange={(c) => setCode({ blockBg: c || '' })} />
                    </span>
                    <span className="type-extra-field">
                      <span className="muted small">Inline code</span>
                      <ColorButton value={code.inlineBg} presets={colorPresets} label="Inline code background" noneLabel="Default" onChange={(c) => setCode({ inlineBg: c || '' })} />
                    </span>
                  </div>
                </div>
                <div className="type-row is-extra">
                  <span className="type-label">Code line spacing</span>
                  <div className="seg sm">
                    {CODE_LINE_HEIGHTS.map((o) => (
                      <button
                        type="button"
                        key={o.value}
                        className={Math.abs(code.lineHeight - o.value) < 0.001 ? 'is-active' : ''}
                        onClick={() => setCode({ lineHeight: o.value })}
                        title={`${o.value} × code font size (code blocks only)`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="type-row is-extra">
                  <span className="type-label">Line numbers</span>
                  <div className="seg sm">
                    <button type="button" className={!code.lineNumbers ? 'is-active' : ''} onClick={() => setCode({ lineNumbers: false })}>Off</button>
                    <button type="button" className={code.lineNumbers ? 'is-active' : ''} onClick={() => setCode({ lineNumbers: true })}>On</button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
        <div className="type-group">
          <div className="type-group-label">Spacing</div>
          <div className="type-row is-line-height">
            <span className="type-label" title="Text, headings, quotes and callouts. Code blocks have their own setting above.">Line height</span>
            <div className="seg sm">
              {LINE_HEIGHTS.map((o) => (
                <button
                  type="button"
                  key={o.value}
                  className={Math.abs(Number(sizes.lineHeight) - o.value) < 0.001 ? 'is-active' : ''}
                  onClick={() => setRole('lineHeight', 'sizes', o.value)}
                  title={`${o.value} × font size`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="row gap">
        <button
          type="button"
          className="btn sm"
          onClick={() => update({ fonts: DEFAULT_SETTINGS.fonts, sizes: DEFAULT_SETTINGS.sizes, textColors: DEFAULT_SETTINGS.textColors, textStyles: DEFAULT_SETTINGS.textStyles, codeStyle: DEFAULT_SETTINGS.codeStyle })}
        >
          <RotateCcw size={14} /> Reset all typography
        </button>
      </div>
      <h3>Preview</h3>
      <div className="type-preview">
        <div className="page-subtitle type-preview-subtitle">Subtitle · Lecture 7, Silberschatz ch. 9</div>
        <div className="hm-prose">
          <h1>Heading 1 · Operating Systems</h1>
          <h2>Heading 2 · Virtual memory</h2>
          <h3>Heading 3 · Page tables</h3>
          <h4>Heading 4 · Multi-level paging</h4>
          <p>
            Body text: a page table maps virtual page numbers to physical frames. Inline code like <code>mmap()</code> sits in the sentence, and a TLB hit
            takes ~1 cycle.
          </p>
          <blockquote>
            <p>Quote: “Any problem in computer science can be solved by another level of indirection.”</p>
          </blockquote>
          <div className="hm-callout" style={{ background: 'color-mix(in srgb, #cb912f 14%, transparent)' }}>
            <div className="hm-callout-side">
              <span className="hm-callout-icon">💡</span>
            </div>
            <div className="hm-callout-content">
              <p>Callout: the OS only walks the page table on a TLB miss.</p>
            </div>
          </div>
          <div className="hm-code">
            <div className={`hm-code-body ${code.lineNumbers ? 'has-lines' : ''}`}>
              {code.lineNumbers && (
                <div className="hm-code-lines" aria-hidden="true">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                </div>
              )}
              <pre>
                <code className="hljs">
                  <span className="hljs-keyword">for</span> (<span className="hljs-type">int</span> i = <span className="hljs-number">0</span>; i &lt; n; i++) {'{'}
                  {'\n  '}sum += a[i]; <span className="hljs-comment">// accumulate</span>
                  {'\n}'}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Colors() {
  const presets = useApp((s) => s.settings.colorPresets);
  const intensity = useApp((s) => s.settings.bgIntensity);
  const update = useApp((s) => s.updateSettings);
  const set = (list) => update({ colorPresets: list });
  return (
    <div className="settings-section">
      <h3>Background intensity</h3>
      <p className="muted small">How strong background colors look everywhere: highlights, block backgrounds, callouts, zones and text styles. Applies to all colors at once.</p>
      <div className="intensity-row">
        <div className="seg">
          {BG_INTENSITIES.map((x) => (
            <button type="button" key={x.id} className={intensity === x.id ? 'is-active' : ''} onClick={() => update({ bgIntensity: x.id })}>
              {x.label}
            </button>
          ))}
        </div>
        <div className="intensity-preview" aria-hidden="true">
          {presets.slice(0, 8).map((p) => (
            <span key={p.id} style={{ background: bgTint(p.hex, 22), color: p.hex }}>Aa</span>
          ))}
        </div>
      </div>
      <h3>Color presets</h3>
      <p className="muted small">Used for text color, highlights, block backgrounds, callouts and zones. You can always use any custom hex value too.</p>
      <div className="preset-list">
        {presets.map((p, i) => (
          <div key={p.id} className="preset-row">
            <input type="color" value={isHex(p.hex) ? normalizeHex(p.hex).slice(0, 7) : '#000000'} onChange={(e) => set(presets.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} />
            <input className="input sm" value={p.name} onChange={(e) => set(presets.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <input
              className="input sm mono"
              defaultValue={p.hex}
              key={p.hex}
              onBlur={(e) => {
                const v = normalizeHex(e.target.value);
                if (isHex(v)) set(presets.map((x, j) => (j === i ? { ...x, hex: v } : x)));
                else e.target.value = p.hex;
              }}
            />
            <span className="preset-sample" style={{ color: p.hex }}>Text</span>
            <span className="preset-sample is-bg" style={{ background: bgTint(p.hex, 22) }}>Highlight</span>
            <button type="button" className="icon-btn xs" onClick={() => set(presets.filter((_, j) => j !== i))} title="Remove">
              <Trash size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="row gap">
        <button type="button" className="btn sm" onClick={() => set([...presets, { id: shortId(), name: 'Custom', hex: '#2383e2' }])}>
          <Plus size={14} /> Add color
        </button>
        <button type="button" className="btn sm ghost" onClick={() => set(DEFAULT_COLORS)}>
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    </div>
  );
}

const WEIGHTS = [
  [300, 'Light'],
  [400, 'Regular'],
  [500, 'Medium'],
  [600, 'Semibold'],
  [650, 'Bold-ish'],
  [700, 'Bold'],
  [800, 'Extra bold'],
];
const SPACINGS = [-1, -0.5, 0, 0.5, 1, 1.5, 2, 3];

function WrapperField({ s, styles, onChange }) {
  const [open, setOpen] = useState(s.wrapOpen || '');
  const [close, setClose] = useState(s.wrapClose || '');
  const error = validateWrapper(open, close, styles, s.id);
  const commit = (o, c) => {
    if (!validateWrapper(o, c, styles, s.id)) onChange({ wrapOpen: o, wrapClose: c && c !== o ? c : '' });
  };
  const shownClose = close || open;
  return (
    <div className="st-field st-shortcut">
      <span className="st-label">Typing shortcut</span>
      <div className="st-shortcut-row">
        <div className={`wrap-group ${error ? 'is-invalid' : ''}`}>
          <input
            className="wrap-input mono"
            value={open}
            maxLength={3}
            placeholder="~"
            aria-label="Opening characters"
            onChange={(e) => {
              const v = e.target.value.trim();
              setOpen(v);
              commit(v, close);
            }}
          />
          <span className="wrap-mid">text</span>
          <input
            className="wrap-input mono"
            value={close}
            maxLength={3}
            placeholder={open || '~'}
            aria-label="Closing characters (blank = same as opening)"
            onChange={(e) => {
              const v = e.target.value.trim();
              setClose(v);
              commit(open, v);
            }}
          />
        </div>
        {error ? (
          <span className="st-error">{error}</span>
        ) : open ? (
          <span className="st-hint">
            Type <kbd className="inline">{open}my text{shownClose}</kbd> to apply
          </span>
        ) : (
          <span className="st-hint">Optional. Leave the closing side blank to reuse the opening characters.</span>
        )}
      </div>
    </div>
  );
}

function Toggle({ on, onClick, title, children }) {
  return (
    <button type="button" className={`st-toggle ${on ? 'is-on' : ''}`} aria-pressed={!!on} title={title} onClick={onClick}>
      {children}
    </button>
  );
}

function StyleEditor({ s, styles, onChange, onDelete, presets }) {
  const cls = `hm-cs-${cssId(s.id)}`;
  return (
    <div className="style-card">
      <div className="style-card-head">
        <input className="st-name" value={s.name} placeholder="Style name" aria-label="Style name" onChange={(e) => onChange({ name: e.target.value })} />
        {s.wrapOpen && <span className="pill mono" title="Typing shortcut">{`${s.wrapOpen}…${s.wrapClose || s.wrapOpen}`}</span>}
        <button type="button" className="icon-btn xs st-delete" onClick={onDelete} title="Delete style">
          <Trash size={15} />
        </button>
      </div>
      <div className="style-preview">
        Notes about paging, where <span className={cls}>{s.name || 'this style'}</span> stands out from the text around it.
      </div>
      <div className="st-grid">
        <label className="st-field">
          <span className="st-label">Font</span>
          <FontSelect value={s.font} inheritLabel="Same as text" onChange={(v) => onChange({ font: v })} />
        </label>
        <label className="st-field">
          <span className="st-label">Size</span>
          <SizeSelect value={s.sizePx} inheritLabel="Same as text" onChange={(v) => onChange({ sizePx: v })} />
        </label>
        <label className="st-field">
          <span className="st-label">Weight</span>
          <select className="input sm" value={s.weight} onChange={(e) => onChange({ weight: Number(e.target.value) })}>
            {WEIGHTS.map(([w, l]) => (
              <option key={w} value={w}>{l} · {w}</option>
            ))}
          </select>
        </label>
        <label className="st-field">
          <span className="st-label">Letter spacing</span>
          <select className="input sm" value={Number(s.letterSpacingPx) || 0} onChange={(e) => onChange({ letterSpacingPx: Number(e.target.value) })}>
            {(SPACINGS.includes(Number(s.letterSpacingPx) || 0) ? SPACINGS : [...SPACINGS, Number(s.letterSpacingPx)].sort((a, b) => a - b)).map((v) => (
              <option key={v} value={v}>{v === 0 ? 'Normal' : `${v > 0 ? '+' : ''}${v} px`}</option>
            ))}
          </select>
        </label>
        <div className="st-field">
          <span className="st-label">Text color</span>
          <ColorButton value={s.color} presets={presets} label="Text color" noneLabel="Same as text" onChange={(c) => onChange({ color: c })} />
        </div>
        <div className="st-field">
          <span className="st-label">Highlight</span>
          <ColorButton value={s.bg} presets={presets} label="Highlight" noneLabel="None" onChange={(c) => onChange({ bg: c })} />
        </div>
        <div className="st-field st-span2">
          <span className="st-label">Formatting</span>
          <div className="st-toggles">
            <Toggle on={s.italic} title="Italic" onClick={() => onChange({ italic: !s.italic })}>
              <Italic size={15} />
            </Toggle>
            <Toggle on={s.underline} title="Underline" onClick={() => onChange({ underline: !s.underline })}>
              <UnderlineIcon size={15} />
            </Toggle>
            <Toggle on={s.uppercase} title="UPPERCASE" onClick={() => onChange({ uppercase: !s.uppercase, smallCaps: s.uppercase ? s.smallCaps : false })}>
              <span className="st-toggle-text">AA</span>
            </Toggle>
            <Toggle on={s.smallCaps} title="Small caps" onClick={() => onChange({ smallCaps: !s.smallCaps, uppercase: s.smallCaps ? s.uppercase : false })}>
              <span className="st-toggle-text" style={{ fontVariant: 'small-caps' }}>Aa</span>
            </Toggle>
          </div>
        </div>
        <WrapperField s={s} styles={styles} onChange={onChange} />
      </div>
    </div>
  );
}

function Styles() {
  const { customStyles, colorPresets } = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const set = (list) => update({ customStyles: list });
  return (
    <div className="settings-section">
      <h3>Custom text styles</h3>
      <p className="muted small">
        Apply these to selected text from the formatting toolbar (the “Aa” menu), or give a style a typing shortcut such as <code>~</code> so that typing{' '}
        <code>~my text~</code> styles it instantly. Changing a style updates every place it’s used.
      </p>
      <div className="style-list">
        {customStyles.map((s, i) => (
          <StyleEditor
            key={s.id}
            s={s}
            styles={customStyles}
            presets={colorPresets}
            onChange={(p) => set(customStyles.map((x, j) => (j === i ? { ...x, ...p } : x)))}
            onDelete={async () => (await useApp.getState().confirm({ title: `Delete the “${s.name}” style?`, message: 'Text that uses it will go back to normal formatting.', danger: true })) && update((st) => ({ customStyles: st.customStyles.filter((x) => x.id !== s.id) }))}
          />
        ))}
      </div>
      <div className="row gap">
        <button
          type="button"
          className="btn sm"
          onClick={() =>
            set([...customStyles, { ...BLANK_STYLE, id: shortId() }])
          }
        >
          <Plus size={14} /> Add style
        </button>
        <button type="button" className="btn sm ghost" onClick={async () => (await useApp.getState().confirm({ title: 'Reset text styles?', message: 'Your styles will be replaced by the three built-in ones. Text using a removed style goes back to normal.', confirmLabel: 'Reset styles', danger: true })) && set(DEFAULT_CUSTOM_STYLES)}>
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    </div>
  );
}

function ZoneRow({ z, i, onChange, presets }) {
  const [emoji, setEmoji] = useState(null);
  const [color, setColor] = useState(null);
  return (
    <div className="zone-default" style={z.color ? { '--zone-color': z.color } : undefined}>
      <span className="zone-default-n">{i + 1}</span>
      <button type="button" className="zone-emoji" onClick={(e) => setEmoji(e.currentTarget)}>
        {z.emoji ? <EmojiIcon value={z.emoji} size={18} /> : <Smile size={15} />}
      </button>
      <input className="input sm grow" value={z.title} onChange={(e) => onChange({ title: e.target.value })} />
      <button type="button" className="btn sm" onClick={(e) => setColor(e.currentTarget)}>
        <span className="dot" style={{ background: z.color || 'transparent' }} /> Color
      </button>
      {emoji && <EmojiPicker anchor={emoji} onClose={() => setEmoji(null)} onSelect={(v) => onChange({ emoji: v })} onRemove={() => onChange({ emoji: '' })} />}
      {color && (
        <Popover anchor={color} onClose={() => setColor(null)} className="hm-menu pad">
          <ColorPicker value={z.color} presets={presets} onChange={(c) => onChange({ color: c })} onDone={() => setColor(null)} />
        </Popover>
      )}
    </div>
  );
}

function Zones() {
  const { zoneDefaults, colorPresets } = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const set = (zones) => update({ zoneDefaults: zones });
  return (
    <div className="settings-section">
      <h3>Default zones for new 4-zone notes</h3>
      <p className="muted small">Existing notes keep their zones. Inside any 4-zone note you can rename zones, change their icons and colors, reorder them, switch layouts, or apply a template.</p>
      <div className="zone-defaults">
        {zoneDefaults.map((z, i) => (
          <ZoneRow key={i} z={z} i={i} presets={colorPresets} onChange={(p) => set(zoneDefaults.map((x, j) => (j === i ? { ...x, ...p } : x)))} />
        ))}
      </div>
      <h3>Start from a template</h3>
      <div className="row gap wrap">
        {ZONE_TEMPLATES.map((t) => (
          <button type="button" key={t.id} className="btn sm" onClick={() => set(t.zones.map((z) => ({ ...z })))}>
            {t.zones.map((z) => z.emoji).join(' ')} {t.name}
          </button>
        ))}
        <button type="button" className="btn sm ghost" onClick={() => set(DEFAULT_ZONES)}>
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    </div>
  );
}

function Emojis() {
  const emojis = useApp((s) => s.emojis);
  const addEmoji = useApp((s) => s.addEmoji);
  const renameEmoji = useApp((s) => s.renameEmoji);
  const deleteEmoji = useApp((s) => s.deleteEmoji);
  const fail = useApp((s) => s.fail);
  const toast = useApp((s) => s.toast);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    const file = await pickFile('image/png,image/gif,image/webp,image/jpeg,image/svg+xml');
    if (!file) return;
    if (file.size > 1024 * 1024) return toast('Emoji images must be under 1 MB.', 'error');
    setBusy(true);
    try {
      const e = await addEmoji(file, name || file.name);
      toast(`Added :${e.name}:`);
      setName('');
    } catch (err) {
      fail(err, 'Could not add emoji');
    }
    setBusy(false);
  };

  return (
    <div className="settings-section">
      <h3>Custom emojis</h3>
      <p className="muted small">
        Upload square PNG, GIF, WebP or SVG images (≤ 1 MB). Use them anywhere by typing <code>:name</code>, from the emoji picker, or as page/zone icons.
      </p>
      <div className="row gap">
        <input className="input sm" placeholder="name (optional — defaults to file name)" value={name} onChange={(e) => setName(sanitizeEmojiName(e.target.value))} />
        <button type="button" className="btn sm primary" onClick={upload} disabled={busy}>
          <Upload size={14} /> {busy ? 'Uploading…' : 'Upload emoji'}
        </button>
      </div>
      {emojis.length === 0 ? (
        <div className="empty-hint">No custom emojis yet.</div>
      ) : (
        <div className="emoji-grid">
          {emojis.map((e) => (
            <div key={e.id} className="emoji-cell">
              <EmojiIcon value={`custom:${e.id}`} size={36} />
              <input
                className="input sm mono"
                defaultValue={e.name}
                key={e.name}
                onBlur={async (ev) => {
                  const v = ev.target.value;
                  if (v === e.name) return;
                  try {
                    await renameEmoji(e.id, v);
                  } catch (err) {
                    ev.target.value = e.name;
                    fail(err, 'Rename failed');
                  }
                }}
              />
              <button type="button" className="icon-btn xs" title="Delete" onClick={async () => (await useApp.getState().confirm({ title: `Delete :${e.name}:?`, message: 'It will disappear from any notes that use it.', danger: true })) && deleteEmoji(e.id)}>
                <Trash size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Account() {
  const session = useApp((s) => s.session);
  const signOut = useApp((s) => s.signOut);
  const toast = useApp((s) => s.toast);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const change = async (e) => {
    e.preventDefault();
    setErr('');
    if (pw.length < 8) return setErr('Use at least 8 characters.');
    if (pw !== pw2) return setErr('Passwords don’t match.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErr(error.message);
    setPw('');
    setPw2('');
    toast('Password updated.');
  };

  return (
    <div className="settings-section">
      <h3>Signed in as</h3>
      <p>
        <strong>{emailToUsername(session?.user?.email)}</strong> <span className="muted small">({session?.user?.email})</span>
      </p>
      <h3>Change password</h3>
      <form className="stack narrow" onSubmit={change}>
        <input className="input" type="password" autoComplete="new-password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <input className="input" type="password" autoComplete="new-password" placeholder="Repeat new password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        {err && <div className="alert is-error">{err}</div>}
        <div>
          <button className="btn primary sm" type="submit" disabled={busy || !pw}>
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </div>
      </form>
      <h3>Session</h3>
      <button type="button" className="btn sm" onClick={signOut}>Sign out</button>
    </div>
  );
}

const PANES = { appearance: Appearance, typography: Typography, fonts: FontLibrary, colors: Colors, styles: Styles, zones: Zones, emojis: Emojis, account: Account };

export default function SettingsPage() {
  const { tab = 'appearance' } = useParams();
  const Pane = PANES[tab] || Appearance;
  return (
    <div className="page settings">
      <div className="page-inner">
        <header className="home-head">
          <h1>Settings</h1>
          <p className="muted">Saved to your account and synced across devices.</p>
        </header>
        <div className="settings-layout">
          <nav className="settings-nav">
            {TABS.map((t) => (
              <NavLink key={t.id} to={`/settings/${t.id}`} className={({ isActive }) => (isActive || (tab === t.id) ? 'is-active' : '')}>
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className="settings-pane">
            <Pane />
          </div>
        </div>
      </div>
    </div>
  );
}
