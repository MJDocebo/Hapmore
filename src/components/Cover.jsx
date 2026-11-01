import { useEffect, useRef, useState } from 'react';
import Popover from './Popover';
import { COVER_GRADIENTS, COVER_COLORS } from '../lib/defaults';
import { pickFile, uploadFile, useSignedUrl, removeFile } from '../lib/storage';
import { useApp } from '../store/useApp';
import { clamp } from '../lib/utils';
import { ImagePlus, Move, Trash } from './icons';

export function coverBackground(cover, url) {
  if (!cover) return undefined;
  if (cover.kind === 'image') return url ? undefined : 'var(--bg-soft)';
  return cover.value;
}

/** Notion-style page cover: gradient, solid color or uploaded image (with vertical reposition). */
export default function Cover({ cover, onChange, small = false }) {
  const url = useSignedUrl(cover && cover.kind === 'image' ? cover.path : null);
  const [anchor, setAnchor] = useState(null);
  const [reposition, setReposition] = useState(false);
  const [posY, setPosY] = useState(cover?.posY ?? 50);
  const drag = useRef(null);
  const fail = useApp((s) => s.fail);

  useEffect(() => setPosY(cover?.posY ?? 50), [cover?.posY]);

  if (!cover) return null;

  const upload = async () => {
    setAnchor(null);
    const f = await pickFile('image/*');
    if (!f) return;
    try {
      const path = await uploadFile(f, 'covers');
      if (cover.kind === 'image' && cover.path) removeFile(cover.path);
      onChange({ kind: 'image', path, posY: 50 });
    } catch (e) {
      fail(e, 'Cover upload failed');
    }
  };

  const onMouseDown = (e) => {
    if (!reposition) return;
    e.preventDefault();
    drag.current = { y: e.clientY, start: posY, h: e.currentTarget.offsetHeight };
    const move = (ev) => {
      const d = drag.current;
      if (!d) return;
      setPosY(clamp(d.start - ((ev.clientY - d.y) / d.h) * 100, 0, 100));
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div
      className={`cover ${small ? 'is-small' : ''} ${reposition ? 'is-repositioning' : ''}`}
      style={{ background: coverBackground(cover, url) }}
      onMouseDown={onMouseDown}
    >
      {cover.kind === 'image' && url && <img src={url} alt="" style={{ objectPosition: `50% ${posY}%` }} draggable={false} />}
      {reposition && <div className="cover-hint">Drag image to reposition</div>}
      <div className="cover-actions">
        {reposition ? (
          <>
            <button type="button" className="btn sm" onClick={() => { onChange({ ...cover, posY: Math.round(posY) }); setReposition(false); }}>Save position</button>
            <button type="button" className="btn sm" onClick={() => { setPosY(cover.posY ?? 50); setReposition(false); }}>Cancel</button>
          </>
        ) : (
          <>
            <button type="button" className="btn sm" onClick={(e) => setAnchor(e.currentTarget)}>Change cover</button>
            {cover.kind === 'image' && (
              <button type="button" className="btn sm" onClick={() => setReposition(true)}><Move size={13} /> Reposition</button>
            )}
          </>
        )}
      </div>
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} placement="bottom-end" className="cover-picker">
          <div className="hm-menu-label">Gradients</div>
          <div className="cover-grid">
            {COVER_GRADIENTS.map((g) => (
              <button type="button" key={g} style={{ background: g }} onClick={() => { onChange({ kind: 'gradient', value: g, posY: 50 }); setAnchor(null); }} />
            ))}
          </div>
          <div className="hm-menu-label">Colors</div>
          <div className="cover-grid">
            {COVER_COLORS.map((c) => (
              <button type="button" key={c} style={{ background: c }} onClick={() => { onChange({ kind: 'color', value: c, posY: 50 }); setAnchor(null); }} />
            ))}
          </div>
          <div className="cover-picker-actions">
            <button type="button" className="btn sm" onClick={upload}><ImagePlus size={14} /> Upload image</button>
            <button
              type="button"
              className="btn sm danger"
              onClick={() => {
                if (cover.kind === 'image' && cover.path) removeFile(cover.path);
                onChange(null);
                setAnchor(null);
              }}
            >
              <Trash size={14} /> Remove
            </button>
          </div>
        </Popover>
      )}
    </div>
  );
}
