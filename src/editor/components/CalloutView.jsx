import { useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import EmojiIcon from '../../components/EmojiIcon';
import EmojiPicker from '../../components/EmojiPicker';
import Popover from '../../components/Popover';
import ColorPicker from '../../components/ColorPicker';
import { Palette } from '../../components/icons';
import { useApp } from '../../store/useApp';
import { tint, bgTint } from '../../lib/utils';

export default function CalloutView({ node, updateAttributes, editor }) {
  const [emojiAnchor, setEmojiAnchor] = useState(null);
  const [colorAnchor, setColorAnchor] = useState(null);
  const presets = useApp((s) => s.settings.colorPresets);
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
        {editable && (
          <button type="button" className="hm-callout-color" title="Callout color" onClick={(e) => setColorAnchor(e.currentTarget)}>
            <Palette size={13} />
          </button>
        )}
      </div>
      <NodeViewContent className="hm-callout-content" />
      {emojiAnchor && (
        <EmojiPicker anchor={emojiAnchor} onClose={() => setEmojiAnchor(null)} onSelect={(v) => updateAttributes({ emoji: v })} />
      )}
      {colorAnchor && (
        <Popover anchor={colorAnchor} onClose={() => setColorAnchor(null)} className="hm-pad">
          <ColorPicker label="Callout color" value={color} presets={presets} allowNone={false} onChange={(c) => c && updateAttributes({ color: c })} />
        </Popover>
      )}
    </NodeViewWrapper>
  );
}
