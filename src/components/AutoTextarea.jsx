import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

/**
 * Textarea that grows with its content (page titles, image captions). Re-measures when its width changes
 * too (page-width switch, window resize, a collapsed zone being expanded), so wrapped text is never clipped.
 */
const AutoTextarea = forwardRef(function AutoTextarea({ value, className = '', ...rest }, ref) {
  const el = useRef(null);
  useImperativeHandle(ref, () => el.current);
  const fit = useCallback(() => {
    const t = el.current;
    if (!t) return;
    t.style.height = '0px';
    t.style.height = `${t.scrollHeight}px`;
  }, []);
  useEffect(fit, [value, fit]);
  useEffect(() => {
    const t = el.current;
    if (!t || typeof ResizeObserver === 'undefined') return undefined;
    let lastWidth = t.clientWidth;
    const ro = new ResizeObserver(() => {
      // Only width changes matter; ignoring height changes avoids a feedback loop with fit().
      if (t.clientWidth !== lastWidth) {
        lastWidth = t.clientWidth;
        fit();
      }
    });
    ro.observe(t);
    return () => ro.disconnect();
  }, [fit]);
  return <textarea ref={el} rows={1} value={value} className={`auto-textarea ${className}`} {...rest} />;
});

export default AutoTextarea;
