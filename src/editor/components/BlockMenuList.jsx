import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Type, Heading1, Heading2, Heading3, Heading4, List, ListOrdered, ListChecks, Quote, Lightbulb,
  SquareCode, Sigma, Table, Image, Divider, Smile, MessageSquarePlus, LinkIcon, Workflow,
} from '../../components/icons';

export const BLOCK_ICONS = {
  text: Type, h1: Heading1, h2: Heading2, h3: Heading3, h4: Heading4, bullet: List, numbered: ListOrdered,
  todo: ListChecks, quote: Quote, callout: Lightbulb, code: SquareCode, math: Sigma, table: Table,
  image: Image, flowchart: Workflow, divider: Divider, emoji: Smile, annotation: MessageSquarePlus, link: LinkIcon,
};

const BlockMenuList = forwardRef(function BlockMenuList({ items, command, query }, ref) {
  const [index, setIndex] = useState(0);
  const listRef = useRef(null);

  useEffect(() => setIndex(0), [items]);
  useEffect(() => {
    const el = listRef.current && listRef.current.querySelector(`[data-idx="${index}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [index]);

  const select = (i) => {
    const item = items[i];
    if (item) command(item);
  };

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
          select(index);
          return true;
        }
        return false;
      },
    }),
    [items, index],
  );

  if (!items.length) return null;
  return (
    <div className="hm-suggest" ref={listRef}>
      <div className="hm-suggest-head">{query ? `Blocks matching “${query}”` : 'Basic blocks'}</div>
      {items.map((item, i) => {
        const Icon = BLOCK_ICONS[item.icon] || Type;
        return (
          <button
            type="button"
            key={item.id}
            data-idx={i}
            className={`hm-suggest-item ${i === index ? 'is-active' : ''}`}
            onMouseEnter={() => setIndex(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => select(i)}
          >
            <span className="hm-suggest-icon">
              <Icon size={18} />
            </span>
            <span className="hm-suggest-text">
              <span className="hm-suggest-title">{item.title}</span>
              <span className="hm-suggest-desc">{item.description}</span>
            </span>
            {item.hint ? <kbd>{item.hint}</kbd> : null}
          </button>
        );
      })}
      <div className="hm-suggest-foot">↑↓ to navigate · Enter to insert · Esc to keep “\”</div>
    </div>
  );
});

export default BlockMenuList;
