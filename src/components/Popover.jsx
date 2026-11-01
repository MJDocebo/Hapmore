import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Floating panel rendered into <body>, anchored to an element or a DOMRect-like object.
 * keepFocus: prevents mousedown from stealing focus from the editor (except on inputs).
 */
export default function Popover({
  anchor, onClose, children, className = '', placement = 'bottom-start', offset = 6,
  keepFocus = false, closeOnEscape = true,
}) {
  const ref = useRef(null);
  const [style, setStyle] = useState({ top: -9999, left: -9999 });
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const place = useCallback(() => {
    const el = ref.current;
    if (!el || !anchor) return;
    const r = typeof anchor.getBoundingClientRect === 'function' ? anchor.getBoundingClientRect() : anchor;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = placement.endsWith('end') ? r.right - w : r.left;
    let top = placement.startsWith('top') ? r.top - h - offset : r.bottom + offset;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - offset);
    if (top < 8) top = 8;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    setStyle((s) => (s.top === top && s.left === left ? s : { top, left }));
  }, [anchor, placement, offset]);

  useLayoutEffect(() => {
    place();
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => place());
    ro.observe(el);
    window.addEventListener('resize', place);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [place]);

  useEffect(() => {
    const onDown = (e) => {
      const el = ref.current;
      if (!el) return;
      const path = e.composedPath ? e.composedPath() : [];
      if (path.includes(el) || el.contains(e.target)) return;
      if (anchor && typeof anchor.contains === 'function' && anchor.contains(e.target)) return;
      // Ignore clicks inside other popovers that sit on top of this one
      if (e.target instanceof Element && e.target.closest('.hm-popover') && e.target.closest('.hm-popover') !== el) return;
      if (onCloseRef.current) onCloseRef.current();
    };
    const onKey = (e) => {
      if (closeOnEscape && e.key === 'Escape' && onCloseRef.current) {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [anchor, closeOnEscape]);

  const onMouseDown = (e) => {
    if (keepFocus && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) e.preventDefault();
  };

  return createPortal(
    <div ref={ref} className={`hm-popover ${className}`} style={{ position: 'fixed', top: style.top, left: style.left }} onMouseDown={onMouseDown}>
      {children}
    </div>,
    document.body,
  );
}
