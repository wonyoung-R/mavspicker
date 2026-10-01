import data from './players.json';
export const ROSTER_CHECKED_AT = '2026-10-02';
export const players = data;
export type Player = typeof players[number];
export const failedImages = new Set<string>();
export function playerFor(slot: number): Player { return players[slot % players.length]; }
export async function preloadPlayers(): Promise<void> {
  await Promise.all(players.map(async player => {
    const image = new Image(); image.src = player.localAssetPath;
    try { await image.decode(); if (!image.naturalWidth) throw Error('empty'); }
    catch { failedImages.add(player.localAssetPath); }
  }));
}
export function portrait(player: Player): HTMLElement {
  const frame = document.createElement('div'); frame.className = 'portrait';
  const fallback = document.createElement('span'); fallback.className = 'fallback';
  fallback.textContent = player.name.split(' ').map(word => word[0]).slice(0,2).join('');
  fallback.setAttribute('role', 'img'); fallback.setAttribute('aria-label', player.name);
  frame.append(fallback);
  if (!failedImages.has(player.localAssetPath)) {
    const image = document.createElement('img'); image.src = player.localAssetPath;
    image.alt = player.name; image.draggable = false;
    image.onerror = () => { failedImages.add(player.localAssetPath); image.remove(); };
    frame.append(image);
  }
  return frame;
}
