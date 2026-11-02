import { useState } from 'react';
import { useApp } from '../store/useApp';
import { BG_PRESETS, BG_STRENGTHS, BG_ANGLES, bgCss, bgLabel, normalizeBg, sameBg } from '../lib/backgrounds';
import ColorPicker from './ColorPicker';
import Popover from './Popover';
import { Check, RotateCcw } from './icons';

function ColorChip({ label, value, onChange }) {
  const presets = useApp((s) => s.settings.colorPresets);
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <button type="button" className="swatch-btn" title={`${label} color`} onClick={(e) => setAnchor(e.currentTarget)}>
        <span className="swatch-dot" style={{ background: value }} />
        <span className="swatch-text">{label}</span>
      </button>
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} className="hm-menu pad">
          <ColorPicker label={`${label} color`} value={value} presets={presets} allowNone={false} onChange={(c) => c && onChange(c)} onDone={() => setAnchor(null)} />
        </Popover>
      )}
    </>
  );
}

/**
 * Picks a subtle page gradient.
 * value: gradient | { off: true } | null (null only when `inherited` is given = follow the default).
 * inherited: the effective default gradient, shown as the "Default" option (per-space overrides).
 */
export default function GradientPicker({ value, onChange, inherited, inheritLabel = 'Default', wide = false }) {
  const canInherit = inherited !== undefined;
  const current = normalizeBg(value, null);
  const effective = current || normalizeBg(inherited, null);
  const base = effective && !effective.off ? effective : { ...BG_PRESETS[0], angle: 135, strength: 'subtle' };
  const set = (patch) => onChange(normalizeBg({ from: base.from, to: base.to, angle: base.angle, strength: base.strength, ...patch }));

  const tile = (key, title, g, active, onClick, extra = null) => (
    <button type="button" key={key} className={`grad-tile ${active ? 'is-active' : ''}`} title={title} onClick={onClick}>
      <span className="grad-tile-swatch" style={{ background: bgCss(g, 55) || 'var(--bg)' }}>
        {active && <Check size={13} />}
        {extra}
      </span>
      <span className="grad-tile-name">{title}</span>
    </button>
  );

  return (
    <div className={`grad-picker ${wide ? 'is-wide' : ''}`}>
      {!wide && (
        <div className="grad-preview" style={{ background: bgCss(effective) || 'var(--bg)' }}>
          <span>{current ? bgLabel(current) : `${inheritLabel} · ${bgLabel(effective)}`}</span>
        </div>
      )}
      <div className="grad-tiles">
        {canInherit && tile('inherit', inheritLabel, normalizeBg(inherited, null), !current, () => onChange(null), <RotateCcw size={12} className="grad-tile-mark" />)}
        {tile('none', 'None', null, !!current?.off || (!canInherit && !current), () => onChange({ off: true }))}
        {BG_PRESETS.map((p) => {
          const g = { from: p.from, to: p.to, angle: base.angle, strength: base.strength };
          const active = !!current && !current.off && sameBg({ ...current, angle: base.angle, strength: base.strength }, g);
          return tile(p.id, p.name, g, active, () => onChange(normalizeBg(g)));
        })}
      </div>
      <div className="grad-controls">
        <div className="grad-row">
          <span className="muted small">Colors</span>
          <ColorChip label="From" value={base.from} onChange={(from) => set({ from })} />
          <ColorChip label="To" value={base.to} onChange={(to) => set({ to })} />
        </div>
        <div className="grad-row">
          <span className="muted small">Direction</span>
          <div className="seg sm">
            {BG_ANGLES.map((a) => (
              <button type="button" key={a.deg} title={a.title} className={effective && !effective.off && base.angle === a.deg ? 'is-active' : ''} onClick={() => set({ angle: a.deg })}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grad-row">
          <span className="muted small">Strength</span>
          <div className="seg sm">
            {BG_STRENGTHS.map((s) => (
              <button type="button" key={s.id} className={effective && !effective.off && base.strength === s.id ? 'is-active' : ''} onClick={() => set({ strength: s.id })}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
