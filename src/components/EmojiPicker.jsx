import { useMemo } from 'react';
import Picker from '@emoji-mart/react';
import { emojiMartData } from '../lib/emojiData';
import { useApp } from '../store/useApp';
import Popover from './Popover';

const martId = (uuid) => `hmc_${String(uuid).replace(/-/g, '')}`;

/**
 * Emoji picker (native + uploaded custom emojis).
 * onSelect(value, customEmoji?) — value is the native char or "custom:<uuid>".
 */
export default function EmojiPicker({ anchor, onSelect, onClose, onRemove, placement = 'bottom-start' }) {
  const emojis = useApp((s) => s.emojis);
  const theme = useApp((s) => s.resolvedTheme);
  const custom = useMemo(
    () =>
      emojis.some((e) => e.url)
        ? [
            {
              id: 'hapmore',
              name: 'Custom',
              emojis: emojis
                .filter((e) => e.url)
                .map((e) => ({ id: martId(e.id), name: e.name, keywords: [e.name, 'custom'], skins: [{ src: e.url }] })),
            },
          ]
        : [],
    [emojis],
  );

  const handle = (sel) => {
    if (sel.src) {
      const e = emojis.find((x) => martId(x.id) === sel.id);
      if (e) onSelect(`custom:${e.id}`, e);
    } else if (sel.native) {
      onSelect(sel.native);
    }
    onClose();
  };

  return (
    <Popover anchor={anchor} onClose={onClose} className="hm-emoji-popover" placement={placement}>
      {onRemove && (
        <div className="hm-emoji-popover-bar">
          <span>Choose an icon</span>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => {
              onRemove();
              onClose();
            }}
          >
            Remove
          </button>
        </div>
      )}
      <Picker
        data={emojiMartData}
        custom={custom}
        onEmojiSelect={handle}
        theme={theme}
        previewPosition="none"
        skinTonePosition="search"
        autoFocus
        perLine={9}
      />
    </Popover>
  );
}
