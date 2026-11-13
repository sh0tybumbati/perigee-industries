// Dock tab icons, drawn with a few shapes each so they follow the palette. Each fits in a 20 x 16 box centred on (cx, cy).

function rocket(g, cx, cy, k = 1, col) {
  g.fillStyle(col);
  g.fillTriangle(cx - 3 * k, cy - 3 * k, cx + 3 * k, cy - 3 * k, cx, cy - 8 * k); // nose
  g.fillRect(cx - 3 * k, cy - 3 * k, 6 * k, 9 * k); // body
  g.fillTriangle(cx - 3 * k, cy + 6 * k, cx - 3 * k, cy + 1 * k, cx - 6 * k, cy + 7 * k); // fins
  g.fillTriangle(cx + 3 * k, cy + 6 * k, cx + 3 * k, cy + 1 * k, cx + 6 * k, cy + 7 * k);
}

const ICONS = {
  mission: (g, x, y, c) => rocket(g, x, y, 1.1, c),
  fleet: (g, x, y, c) => { rocket(g, x - 5, y + 1, 0.75, c); rocket(g, x + 5, y + 1, 0.75, c); },
  factory: (g, x, y, c) => {
    g.fillStyle(c);
    g.fillRect(x - 9, y - 1, 18, 9);
    g.fillTriangle(x - 9, y - 1, x - 9, y - 6, x - 3, y - 1);
    g.fillTriangle(x - 3, y - 1, x - 3, y - 6, x + 3, y - 1);
    g.fillTriangle(x + 3, y - 1, x + 3, y - 6, x + 9, y - 1);
    g.fillRect(x + 5, y - 9, 3, 6);
  },
  sites: (g, x, y, c) => {
    g.fillStyle(c);
    g.fillCircle(x, y - 3, 6);
    g.fillTriangle(x - 5, y, x + 5, y, x, y + 8);
    g.fillStyle(0x0b1220).fillCircle(x, y - 3, 2.2);
  },
  base: (g, x, y, c) => {
    g.fillStyle(c);
    g.beginPath();
    g.arc(x, y + 5, 9, Math.PI, 0, false);
    g.closePath();
    g.fillPath();
    g.fillRect(x - 11, y + 5, 22, 2);
    g.fillStyle(0x0b1220).fillRect(x - 1.5, y + 1, 3, 4);
  },
  tech: (g, x, y, c) => {
    g.fillStyle(c);
    g.fillRect(x - 2.5, y - 8, 5, 6);
    g.fillTriangle(x - 2.5, y - 3, x + 2.5, y - 3, x + 8, y + 7);
    g.fillTriangle(x - 2.5, y - 3, x - 8, y + 7, x + 8, y + 7);
    g.fillRect(x - 4, y - 9, 8, 2);
    g.fillStyle(0x0b1220).fillRect(x - 4, y + 3, 8, 1.5);
  },
  skylink: (g, x, y, c) => {
    g.fillStyle(c);
    g.fillRect(x - 3, y - 3, 6, 6);
    g.fillRect(x - 10, y - 2, 6, 4);
    g.fillRect(x + 4, y - 2, 6, 4);
    g.lineStyle(1.5, c).beginPath().arc(x, y + 1, 6, 0.9, 2.2, false).strokePath();
    g.lineStyle(1.5, c).beginPath().arc(x, y + 1, 9, 0.9, 2.2, false).strokePath();
  },
  depot: (g, x, y, c) => {
    g.lineStyle(1.5, c).strokeRoundedRect(x - 7, y - 8, 14, 17, 4);
    g.fillStyle(c).fillRoundedRect(x - 5.5, y, 11, 8, { tl: 0, tr: 0, bl: 3, br: 3 });
  },
  log: (g, x, y, c) => {
    g.fillStyle(c);
    for (let i = 0; i < 3; i++) {
      g.fillCircle(x - 7, y - 6 + i * 6, 1.6);
      g.fillRect(x - 3, y - 7.2 + i * 6, 11 - i * 2, 2.4);
    }
  },
};

export function drawIcon(g, id, cx, cy, col) { ICONS[id]?.(g, cx, cy, col); }
