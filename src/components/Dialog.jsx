import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store/useApp';
import { Trash } from './icons';

/**
 * In-app replacement for window.confirm / window.prompt. Mounted once (App.jsx).
 * Open one with `await useApp.getState().confirm({...})` or `await useApp.getState().promptText({...})`.
 */
export default function DialogHost() {
  const dialog = useApp((s) => s.dialog);
  const close = useApp((s) => s.closeDialog);
  if (!dialog) return null;
  return createPortal(<DialogCard key={dialog.id} d={dialog} close={close} />, document.body);
}

function DialogCard({ d, close }) {
  const [value, setValue] = useState(d.defaultValue || '');
  const confirmRef = useRef(null);
  const inputRef = useRef(null);
  const isPrompt = d.kind === 'prompt';
  const canSubmit = !isPrompt || value.trim().length > 0;

  const cancel = () => close(isPrompt ? null : false);
  const submit = () => canSubmit && close(isPrompt ? value.trim() : true);

  useEffect(() => {
    const prev = document.activeElement;
    (isPrompt ? inputRef.current : confirmRef.current)?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (prev && prev.focus && document.contains(prev)) prev.focus({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && cancel()}>
      <form
        className={`dialog ${d.danger ? 'is-danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="hm-dialog-title"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="dialog-body">
          {d.danger && (
            <span className="dialog-icon" aria-hidden="true">
              <Trash size={18} />
            </span>
          )}
          <div className="dialog-text">
            <h2 id="hm-dialog-title" className="dialog-title">{d.title}</h2>
            {d.message && <p className="dialog-message">{d.message}</p>}
            {isPrompt && (
              <input
                ref={inputRef}
                className="input"
                value={value}
                placeholder={d.placeholder || ''}
                onChange={(e) => setValue(e.target.value)}
                type={d.inputType || 'text'}
              />
            )}
          </div>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={cancel}>
            {d.cancelLabel || 'Cancel'}
          </button>
          <button ref={confirmRef} type="submit" className={`btn ${d.danger ? 'danger' : 'primary'}`} disabled={!canSubmit}>
            {d.confirmLabel || (d.danger ? 'Delete' : 'OK')}
          </button>
        </div>
      </form>
    </div>
  );
}
