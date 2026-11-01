import { useApp } from '../store/useApp';

export default function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast is-${t.kind}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
