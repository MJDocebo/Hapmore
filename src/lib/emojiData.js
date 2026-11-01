import data from '@emoji-mart/data';

let index = null;

function build() {
  index = Object.values(data.emojis)
    .map((e) => ({ id: e.id, keywords: e.keywords || [], native: e.skins && e.skins[0] ? e.skins[0].native : null }))
    .filter((e) => e.native);
  return index;
}

export function getNativeEmoji(id) {
  const key = String(id).toLowerCase();
  const direct = data.emojis[key];
  if (direct) return direct.skins[0].native;
  const alias = data.aliases && data.aliases[key];
  if (alias && data.emojis[alias]) return data.emojis[alias].skins[0].native;
  return null;
}

/** Search native + custom emojis for the ":" autocomplete. customs: [{ id, name, url }] */
export function searchEmojis(query, customs = [], limit = 10) {
  const q = String(query || '').toLowerCase();
  if (!index) build();
  const custom = customs
    .filter((c) => c.name.includes(q))
    .sort((a, b) => Number(b.name.startsWith(q)) - Number(a.name.startsWith(q)))
    .slice(0, 5)
    .map((c) => ({ kind: 'custom', key: `c-${c.id}`, id: c.id, name: c.name, url: c.url }));
  const starts = [];
  const contains = [];
  for (const e of index) {
    if (e.id.startsWith(q)) starts.push(e);
    else if (contains.length < limit && (e.id.includes(q) || e.keywords.some((k) => k.startsWith(q)))) contains.push(e);
    if (starts.length >= limit) break;
  }
  const native = [...starts, ...contains]
    .slice(0, limit)
    .map((e) => ({ kind: 'native', key: `n-${e.id}`, id: e.id, name: e.id, native: e.native }));
  return [...custom, ...native].slice(0, limit);
}

export { data as emojiMartData };
