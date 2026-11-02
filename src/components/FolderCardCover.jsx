import { useState } from 'react';
import { useApp } from '../store/useApp';
import { useSignedUrl } from '../lib/storage';
import { bgCss, DEFAULT_BACKGROUNDS, normalizeBg } from '../lib/backgrounds';

/** Tile-strength mix so a space's (deliberately subtle) page gradient still reads as a color on a small tile. */
const TILE_PCT = 48;

/** The space's own gradient, else its kind's, else the built-in default — never an empty/gray tile. */
function tileGradient(folder, backgrounds) {
  const candidates = [folder.background, backgrounds?.[folder.kind], DEFAULT_BACKGROUNDS[folder.kind], DEFAULT_BACKGROUNDS.course];
  for (const c of candidates) {
    const g = normalizeBg(c, null);
    if (g && !g.off) return bgCss(g, TILE_PCT);
  }
  return 'var(--bg-soft)';
}

/**
 * Top half of a Home "Your spaces" tile.
 * Priority: chosen cover color/gradient → cover image → the space's background gradient (fallback, also shown while
 * an image loads or if it fails).
 */
export default function FolderCardCover({ folder }) {
  const backgrounds = useApp((s) => s.settings.backgrounds);
  const cover = folder.cover;
  const isImage = cover?.kind === 'image' && cover.path;
  const url = useSignedUrl(isImage ? cover.path : null);
  const [broken, setBroken] = useState(false);

  const fallback = tileGradient(folder, backgrounds);
  const background = cover && !isImage && cover.value ? cover.value : fallback;

  return (
    <div className="folder-card-cover" style={{ background }}>
      {isImage && url && !broken && (
        <img src={url} alt="" draggable={false} style={{ objectPosition: `50% ${cover.posY ?? 50}%` }} onError={() => setBroken(true)} />
      )}
    </div>
  );
}
