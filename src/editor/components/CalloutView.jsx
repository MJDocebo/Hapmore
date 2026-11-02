import { useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import EmojiIcon from '../../components/EmojiIcon';
import EmojiPicker from '../../components/EmojiPicker';
import { tint, bgTint } from '../../lib/utils';

/** Callout block. Its color is set from the block (⋮⋮) menu. */
export default function CalloutView({ node, updateAttributes, editor }) {
  const [emojiAnchor, setEmojiAnchor] = useState(null);
  const color = node.attrs.color || '#cb912f';
  const editable = editor.isEditable;

  return (
    <NodeViewWrapper
      className="hm-callout"
      data-block-id={node.attrs.blockId || undefined}
      style={{ background: bgTint(color, 12), borderColor: tint(color, 32) }}
    >
      <div className="hm-callout-side" contentEditable={false}>
        <button type="button" className="hm-callout-icon" disabled={!editable} title="Change emoji" onClick={(e) => setEmojiAnchor(e.currentTarget)}>
          <EmojiIcon value={node.attrs.emoji || '💡'} size={20} />
        </button>
      </div>
      <NodeViewContent className="hm-callout-content" />
      {emojiAnchor && (
        <EmojiPicker anchor={emojiAnchor} onClose={() => setEmojiAnchor(null)} onSelect={(v) => updateAttributes({ emoji: v })} />
      )}
    </NodeViewWrapper>
  );
}
