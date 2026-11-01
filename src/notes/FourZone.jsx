import { useRef, useState } from 'react';
import Editor from '../editor/Editor';
import EmojiIcon from '../components/EmojiIcon';
import EmojiPicker from '../components/EmojiPicker';
import Popover from '../components/Popover';
import ColorPicker from '../components/ColorPicker';
import Menu from '../components/Menu';
import { useApp } from '../store/useApp';
import { ZONE_TEMPLATES } from '../lib/defaults';
import {
  LayoutGrid, LayoutTop, Rows, Columns, More, Palette, Smile, Star, ChevronDown, ChevronRight, Sparkles, ArrowUp, ArrowDown,
} from '../components/icons';

const LAYOUTS = [
  { id: 'grid', label: '2 × 2 grid', Icon: LayoutGrid },
  { id: 'primary', label: 'Primary + 3', Icon: LayoutTop },
  { id: 'columns', label: '4 columns', Icon: Columns },
  { id: 'stacked', label: 'Stacked', Icon: Rows },
];

function ZoneHeader({ zone, index, total, layout, isPrimary, onChange, onMove, onMakePrimary }) {
  const presets = useApp((s) => s.settings.colorPresets);
  const [emoji, setEmoji] = useState(null);
  const [color, setColor] = useState(null);
  const [menu, setMenu] = useState(null);
  const zoneItems = [
    layout === 'primary' && !isPrimary ? { label: 'Make primary zone', icon: Star, onClick: onMakePrimary } : null,
    index > 0 ? { label: 'Move earlier', icon: ArrowUp, onClick: () => onMove(-1) } : null,
    index < total - 1 ? { label: 'Move later', icon: ArrowDown, onClick: () => onMove(1) } : null,
    { label: zone.collapsed ? 'Expand zone' : 'Collapse zone', icon: zone.collapsed ? ChevronRight : ChevronDown, onClick: () => onChange({ collapsed: !zone.collapsed }) },
  ].filter(Boolean);
  return (
    <div className="zone-head">
      <button type="button" className="icon-btn xs zone-collapse" title={zone.collapsed ? 'Expand zone' : 'Collapse zone'} onClick={() => onChange({ collapsed: !zone.collapsed })}>
        {zone.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>
      <button type="button" className="zone-emoji" title="Zone icon" onClick={(e) => setEmoji(e.currentTarget)}>
        {zone.emoji ? <EmojiIcon value={zone.emoji} size={17} /> : <Smile size={15} className="muted" />}
      </button>
      <input className="zone-title" value={zone.title} placeholder={`Zone ${index + 1}`} onChange={(e) => onChange({ title: e.target.value })} />
      <button type="button" className="icon-btn xs" title="Zone color" onClick={(e) => setColor(e.currentTarget)}>
        <Palette size={14} />
      </button>
      <button type="button" className="icon-btn xs" title="Zone options" onClick={(e) => setMenu(e.currentTarget)}>
        <More size={14} />
      </button>
      {emoji && (
        <EmojiPicker anchor={emoji} onClose={() => setEmoji(null)} onSelect={(v) => onChange({ emoji: v })} onRemove={zone.emoji ? () => onChange({ emoji: '' }) : undefined} />
      )}
      {color && (
        <Popover anchor={color} onClose={() => setColor(null)} className="hm-menu pad">
          <ColorPicker label="Zone color" value={zone.color} presets={presets} onChange={(c) => onChange({ color: c })} />
        </Popover>
      )}
      {menu && (
        <Menu
          anchor={menu}
          onClose={() => setMenu(null)}
          placement="bottom-end"
          items={zoneItems}
        />
      )}
    </div>
  );
}

/**
 * Customizable 4-zone note. Uncontrolled: `initial` is read on mount; remount with a key to reload.
 * onChange(content) receives the full { layout, primary, zones:[{id,title,emoji,color,collapsed,doc}] } object.
 */
export default function FourZone({ initial, onChange, onEditorReady }) {
  const settings = useApp((s) => s.settings);
  const updateSettings = useApp((s) => s.updateSettings);
  const toast = useApp((s) => s.toast);
  const [meta, setMeta] = useState(() => ({
    layout: initial.layout,
    primary: initial.primary,
    zones: initial.zones.map(({ doc, ...z }) => z),
  }));
  const docs = useRef(Object.fromEntries(initial.zones.map((z) => [z.id, z.doc])));
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const [templateMenu, setTemplateMenu] = useState(null);

  const emit = (m) => onChange({ layout: m.layout, primary: m.primary, zones: m.zones.map((z) => ({ ...z, doc: docs.current[z.id] ?? null })) });

  const updateMeta = (fn) => {
    const next = fn(metaRef.current);
    metaRef.current = next;
    setMeta(next);
    emit(next);
  };

  const setZone = (id, patch) => updateMeta((m) => ({ ...m, zones: m.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)) }));

  const moveZone = (index, dir) =>
    updateMeta((m) => {
      const zones = [...m.zones];
      const j = index + dir;
      if (j < 0 || j >= zones.length) return m;
      [zones[index], zones[j]] = [zones[j], zones[index]];
      let { primary } = m;
      if (primary === index) primary = j;
      else if (primary === j) primary = index;
      return { ...m, zones, primary };
    });

  const applyTemplate = (zonesTpl) =>
    updateMeta((m) => ({
      ...m,
      zones: m.zones.map((z, i) => ({ ...z, title: zonesTpl[i]?.title ?? z.title, emoji: zonesTpl[i]?.emoji ?? z.emoji, color: zonesTpl[i]?.color ?? z.color })),
    }));

  const ordered = meta.layout === 'primary' ? [meta.zones[meta.primary], ...meta.zones.filter((_, i) => i !== meta.primary)] : meta.zones;

  return (
    <div className="fourzone">
      <div className="fourzone-bar">
        <div className="seg">
          {LAYOUTS.map(({ id, label, Icon }) => (
            <button type="button" key={id} className={meta.layout === id ? 'is-active' : ''} title={label} onClick={() => updateMeta((m) => ({ ...m, layout: id }))}>
              <Icon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn ghost sm" onClick={(e) => setTemplateMenu(e.currentTarget)}>
          <Sparkles size={14} /> Zone template
        </button>
        {templateMenu && (
          <Menu
            anchor={templateMenu}
            onClose={() => setTemplateMenu(null)}
            placement="bottom-end"
            title="Apply zone titles, icons & colors"
            items={[
              { label: 'My default zones', onClick: () => applyTemplate(settings.zoneDefaults) },
              ...ZONE_TEMPLATES.map((t) => ({ label: t.name, onClick: () => applyTemplate(t.zones) })),
              { divider: true },
              {
                label: 'Save these zones as my default',
                icon: Star,
                onClick: () => {
                  updateSettings({ zoneDefaults: metaRef.current.zones.map(({ title, emoji, color }) => ({ title, emoji, color })) });
                  toast('New 4-zone notes will use these zones.');
                },
              },
            ]}
          />
        )}
      </div>

      <div className={`fourzone-grid layout-${meta.layout}`}>
        {ordered.map((zone) => {
          const index = meta.zones.findIndex((z) => z.id === zone.id);
          const isPrimary = meta.layout === 'primary' && index === meta.primary;
          return (
            <section
              key={zone.id}
              className={`zone ${isPrimary ? 'is-primary' : ''} ${zone.collapsed ? 'is-collapsed' : ''} ${zone.color ? 'has-color' : ''}`}
              style={zone.color ? { '--zone-color': zone.color } : undefined}
            >
              <ZoneHeader
                zone={zone}
                index={index}
                total={meta.zones.length}
                layout={meta.layout}
                isPrimary={isPrimary}
                onChange={(p) => setZone(zone.id, p)}
                onMove={(dir) => moveZone(index, dir)}
                onMakePrimary={() => updateMeta((m) => ({ ...m, primary: index }))}
              />
              <div className="zone-body" hidden={zone.collapsed}>
                <Editor
                  content={docs.current[zone.id]}
                  placeholder={`Write in “${zone.title || `Zone ${index + 1}`}”… type '\\' for blocks`}
                  onChange={(doc) => {
                    docs.current[zone.id] = doc;
                    emit(metaRef.current);
                  }}
                  onReady={onEditorReady}
                />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
