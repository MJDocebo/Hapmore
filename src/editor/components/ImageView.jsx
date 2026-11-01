import { NodeViewWrapper } from '@tiptap/react';
import { useSignedUrl } from '../../lib/storage';
import AutoTextarea from '../../components/AutoTextarea';

const WIDTHS = [25, 50, 75, 100];

export default function ImageView({ node, updateAttributes, editor, selected }) {
  const signed = useSignedUrl(node.attrs.path);
  const url = node.attrs.path ? signed : node.attrs.src;
  const width = node.attrs.width || 100;
  const editable = editor.isEditable;
  const caption = node.attrs.caption || '';

  return (
    <NodeViewWrapper className={`hm-image ${selected ? 'is-selected' : ''}`} data-block-id={node.attrs.blockId || undefined}>
      <figure className="hm-image-figure" contentEditable={false}>
        <div className="hm-image-frame" style={{ width: `${width}%` }}>
          {url ? <img src={url} alt={node.attrs.alt || caption || ''} draggable={false} /> : <div className="hm-image-loading">Loading image…</div>}
          {editable && (
            <div className="hm-image-tools">
              {WIDTHS.map((w) => (
                <button type="button" key={w} className={w === width ? 'is-active' : ''} onClick={() => updateAttributes({ width: w })}>
                  {w}%
                </button>
              ))}
            </div>
          )}
        </div>
        {/* The caption spans the whole block (not just the image) and wraps onto new lines. */}
        {editable ? (
          <AutoTextarea
            className="hm-image-caption"
            value={caption}
            placeholder="Add a caption…"
            onChange={(e) => updateAttributes({ caption: e.target.value.replace(/\n/g, ' ') })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                e.currentTarget.blur();
                editor.commands.focus();
              }
            }}
          />
        ) : (
          caption && <figcaption className="hm-image-caption is-static">{caption}</figcaption>
        )}
      </figure>
    </NodeViewWrapper>
  );
}
