import { useApp } from '../store/useApp';

/** Renders a page/callout icon: native emoji string or "custom:<uuid>". */
export default function EmojiIcon({ value, size = 18, className = '' }) {
  const emojis = useApp((s) => s.emojis);
  if (!value) return null;
  if (value.startsWith('custom:')) {
    const e = emojis.find((x) => x.id === value.slice(7));
    if (!e || !e.url) return <span className={`hm-emoji ${className}`} style={{ width: size, height: size, fontSize: size * 0.8 }}>▫️</span>;
    return <img className={`hm-emoji-img ${className}`} src={e.url} alt={`:${e.name}:`} title={`:${e.name}:`} style={{ width: size, height: size }} draggable={false} />;
  }
  return (
    <span className={`hm-emoji ${className}`} style={{ fontSize: size, lineHeight: 1 }}>
      {value}
    </span>
  );
}
