import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const EmojiList = forwardRef(function EmojiList({ items, command }, ref) {
  const [index, setIndex] = useState(0);
  const listRef = useRef(null);
  useEffect(() => setIndex(0), [items]);
  useEffect(() => {
    const el = listRef.current && listRef.current.querySelector(`[data-idx="${index}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [index]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }) => {
        if (!items.length) return false;
        if (event.key === 'ArrowDown') {
          setIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === 'ArrowUp') {
          setIndex((i) => (i - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          if (items[index]) command(items[index]);
          return true;
        }
        return false;
      },
    }),
    [items, index],
  );

  if (!items.length) return null;
  return (
    <div className="hm-suggest hm-suggest-emoji" ref={listRef}>
      {items.map((item, i) => (
        <button
          type="button"
          key={item.key}
          data-idx={i}
          className={`hm-suggest-item ${i === index ? 'is-active' : ''}`}
          onMouseEnter={() => setIndex(i)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => command(item)}
        >
          <span className="hm-suggest-emoji-glyph">
            {item.kind === 'custom' ? <img src={item.url} alt="" /> : item.native}
          </span>
          <span className="hm-suggest-title">:{item.name}:</span>
          {item.kind === 'custom' && <span className="hm-badge">custom</span>}
        </button>
      ))}
    </div>
  );
});

export default EmojiList;
