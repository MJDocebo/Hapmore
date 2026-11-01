import { useState } from 'react';
import Cover from './Cover';
import EmojiIcon from './EmojiIcon';
import EmojiPicker from './EmojiPicker';
import AutoTextarea from './AutoTextarea';
import { randomCover } from '../lib/defaults';
import { ImagePlus, Smile } from './icons';

/**
 * Notion-style header: optional cover, icon, big title. `children` render under the title (meta rows).
 * onChange(patch) with keys cover | icon | title.
 */
export default function PageHeader({ cover, icon, title, placeholder = 'Untitled', onChange, children, titleRef, onTitleEnter }) {
  const [picker, setPicker] = useState(null);
  return (
    <div className={`page-header ${cover ? 'has-cover' : ''} ${icon ? 'has-icon' : ''}`}>
      <Cover cover={cover} onChange={(c) => onChange({ cover: c })} />
      <div className="page-inner page-header-inner">
        {icon && (
          <button type="button" className="page-icon" onClick={(e) => setPicker(e.currentTarget)} title="Change icon">
            <EmojiIcon value={icon} size={64} />
          </button>
        )}
        <div className="page-header-actions">
          {!icon && (
            <button type="button" className="btn ghost sm" onClick={(e) => setPicker(e.currentTarget)}>
              <Smile size={14} /> Add icon
            </button>
          )}
          {!cover && (
            <button type="button" className="btn ghost sm" onClick={() => onChange({ cover: randomCover() })}>
              <ImagePlus size={14} /> Add cover
            </button>
          )}
        </div>
        <AutoTextarea
          ref={titleRef}
          className="page-title"
          value={title || ''}
          placeholder={placeholder}
          onChange={(e) => onChange({ title: e.target.value.replace(/\n/g, '') })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (onTitleEnter) onTitleEnter();
            }
          }}
        />
        {children}
      </div>
      {picker && (
        <EmojiPicker anchor={picker} onClose={() => setPicker(null)} onSelect={(v) => onChange({ icon: v })} onRemove={icon ? () => onChange({ icon: null }) : undefined} />
      )}
    </div>
  );
}
