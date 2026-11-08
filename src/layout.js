// The game is laid out on a 720-pixel-high canvas. The width follows the screen's shape: 1280 for 16:9 and squarer
// screens, up to 1720 for very wide phones (20:9 is 1600). Any extra width goes to the map, so the dock keeps its size.
const BASE_W = 1280;
const MAX_W = 1720;

export const widthFor = (w, h) => Math.min(MAX_W, Math.max(BASE_W, Math.round(((720 * w) / Math.max(1, h)) / 2) * 2));
export const W = typeof window === 'undefined' ? BASE_W : widthFor(window.innerWidth, window.innerHeight);
export const EXTRA = W - BASE_W;
