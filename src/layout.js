// The game is laid out on a canvas that is 720 pixels high, and 530 on a phone. The width follows the screen's shape:
// 1280 for 16:9 and squarer screens, up to 1720 for very wide ones (20:9 is 1600). Any extra width goes to the map,
// so the dock keeps its size.
const BASE_W = 1280;
const MAX_W = 1720;
const PHONE_MIN_W = 1180;

// A short landscape screen is a phone: the bottom strip is hidden so that the canvas can be shorter and bigger.
export const isPhone = (w, h) => h < 560 && w > h;

export function sizeFor(w, h) {
  const phone = isPhone(w, h);
  const H = phone ? 530 : 720;
  const raw = Math.round(((H * w) / Math.max(1, h)) / 2) * 2;
  return { phone, H, W: Math.min(MAX_W, Math.max(phone ? PHONE_MIN_W : BASE_W, raw)) };
}

export const widthFor = (w, h) => sizeFor(w, h).W;
const here = typeof window === 'undefined' ? { phone: false, H: 720, W: BASE_W } : sizeFor(window.innerWidth, window.innerHeight);
export const { phone: PHONE, H, W } = here;
export const EXTRA = W - BASE_W;
