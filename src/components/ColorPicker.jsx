import { useEffect, useState } from 'react';
import { isHex, normalizeHex } from '../lib/utils';
import { X } from './icons';

const keep = (e) => e.preventDefault();

/** Preset swatches + native picker + hex input. onChange(hex | null). */
export default function ColorPicker({ value, onChange, presets = [], allowNone = true, label, compact = false }) {
  const [hex, setHex] = useState(value || '');
  useEffect(() => setHex(value || ''), [value]);
  const apply = () => {
    const v = normalizeHex(hex);
    if (isHex(v)) onChange(v);
  };
  const native = isHex(hex) ? normalizeHex(hex).slice(0, 7) : '#2383e2';
  return (
    <div className={`hm-colorpicker ${compact ? 'is-compact' : ''}`}>
      {label && <div className="hm-cp-label">{label}</div>}
      <div className="hm-swatches">
        {allowNone && (
          <button type="button" className={`hm-swatch is-none ${!value ? 'is-active' : ''}`} title="Default" onMouseDown={keep} onClick={() => onChange(null)}>
            <X size={12} />
          </button>
        )}
        {presets.map((p) => (
          <button
            type="button"
            key={p.id || p.hex}
            className={`hm-swatch ${value && value.toLowerCase() === p.hex.toLowerCase() ? 'is-active' : ''}`}
            style={{ background: p.hex }}
            title={`${p.name} · ${p.hex}`}
            onMouseDown={keep}
            onClick={() => onChange(p.hex)}
          />
        ))}
      </div>
      <div className="hm-cp-custom">
        <input
          type="color"
          className="hm-cp-native"
          value={native}
          onChange={(e) => {
            setHex(e.target.value);
            onChange(e.target.value);
          }}
          title="Pick a custom color"
        />
        <input
          className="input sm mono"
          placeholder="#hex"
          value={hex}
          maxLength={9}
          onChange={(e) => setHex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              apply();
            }
          }}
        />
        <button type="button" className="btn sm" onMouseDown={keep} onClick={apply} disabled={!isHex(normalizeHex(hex))}>
          Apply
        </button>
      </div>
    </div>
  );
}
