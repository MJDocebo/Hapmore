import Popover from './Popover';
import { Check } from './icons';

/** Simple dropdown menu. items: [{ label, description?, icon: Icon, onClick, danger, divider, hint, checked }] */
export default function Menu({ anchor, items, onClose, placement = 'bottom-start', title }) {
  return (
    <Popover anchor={anchor} onClose={onClose} placement={placement} className="hm-menu is-list">
      {title && <div className="hm-menu-label">{title}</div>}
      {items.filter(Boolean).map((it, i) =>
        it.divider ? (
          <div key={`d${i}`} className="hm-menu-sep" />
        ) : (
          <button
            type="button"
            key={`${i}-${it.label}`}
            className={`hm-menu-item ${it.danger ? 'is-danger' : ''} ${it.description ? 'has-desc' : ''} ${it.checked ? 'is-checked' : ''}`}
            role={it.checked !== undefined ? 'menuitemradio' : undefined}
            aria-checked={it.checked !== undefined ? !!it.checked : undefined}
            onClick={() => {
              onClose();
              it.onClick();
            }}
          >
            {it.icon ? <it.icon size={15} /> : null}
            {it.description ? (
              <span className="hm-menu-text">
                <span className="hm-menu-name">{it.label}</span>
                <span className="hm-menu-desc">{it.description}</span>
              </span>
            ) : (
              <span className="hm-menu-name" title={typeof it.label === 'string' && it.label.length > 40 ? it.label : undefined}>{it.label}</span>
            )}
            {it.hint && <kbd>{it.hint}</kbd>}
            {it.checked && <Check size={15} className="hm-menu-check" />}
          </button>
        ),
      )}
    </Popover>
  );
}
