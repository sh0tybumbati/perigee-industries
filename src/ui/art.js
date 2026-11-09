// Drawn silhouettes for the fleet and a small scene of a launch site (GDD 2.16). All Phaser graphics, no image files.
import { ROCKETS, SITES } from '../data.js';
import * as sim from '../sim.js';
import { COL, hex } from './ui.js';

const WHITE = 0xeef3fb;
const STEEL = 0xb9c4d4;
const DARK = 0x3b4658;
const FIN = 0x7d8aa3;

// A vehicle silhouette standing in the box (x, y, w, h). Module ships lie on their side.
export function drawRocket(g, x, y, w, h, type) {
  const r = ROCKETS[type];
  const cx = x + w / 2;
  if (r.role === 'module') {
    const th = Math.min(h, w * 0.5);
    const cy = y + h / 2;
    g.fillStyle(STEEL).fillRoundedRect(x, cy - th / 2, w, th, th / 2);
    g.fillStyle(0x6b7a99).fillRect(x + w * 0.3, cy - th / 2, 2, th).fillRect(x + w * 0.65, cy - th / 2, 2, th);
    return;
  }
  const steel = !!r.catch;
  const bw = steel ? w * 0.6 : w * 0.42;
  const col = steel ? STEEL : WHITE;
  const bx = cx - bw / 2;
  if (type === 'peregrineHeavy') {
    const sw = w * 0.26;
    for (const dx of [-w * 0.34, w * 0.34]) {
      g.fillStyle(WHITE).fillRect(cx + dx - sw / 2, y + h * 0.38, sw, h * 0.62);
      g.fillStyle(WHITE).fillTriangle(cx + dx - sw / 2, y + h * 0.38, cx + dx + sw / 2, y + h * 0.38, cx + dx, y + h * 0.26);
    }
  }
  g.fillStyle(col).fillRect(bx, y + h * 0.2, bw, h * 0.8); // body
  g.fillStyle(col).fillTriangle(bx, y + h * 0.2, bx + bw, y + h * 0.2, cx, y); // nose
  g.fillStyle(DARK).fillRect(bx, y + h * 0.44, bw, Math.max(1, h * 0.04)); // stage line
  if (steel) {
    if (type === 'skyship' || type === 'skyshipTanker' || type === 'skyshipDepot') g.fillStyle(DARK).fillRect(bx + bw * 0.5, y + h * 0.22, bw * 0.5, h * 0.2); // heat tiles
    if (type === 'behemoth') g.fillStyle(DARK).fillRect(bx, y + h * 0.5, bw, h * 0.16);
    if (type === 'skyshipTanker') g.fillStyle(COL.warn).fillRect(bx, y + h * 0.62, bw, Math.max(2, h * 0.07));
    if (type === 'skyshipDepot') g.lineStyle(2, COL.violet).strokeEllipse(cx, y + h * 0.58, bw * 1.5, h * 0.08);
    g.fillStyle(FIN).fillTriangle(bx, y + h * 0.78, bx - w * 0.16, y + h, bx, y + h);
    g.fillStyle(FIN).fillTriangle(bx + bw, y + h * 0.78, bx + bw + w * 0.16, y + h, bx + bw, y + h);
    g.fillStyle(FIN).fillRect(bx - w * 0.1, y + h * 0.3, w * 0.1, h * 0.1).fillRect(bx + bw, y + h * 0.3, w * 0.1, h * 0.1); // flaps
  } else {
    g.fillStyle(FIN).fillRect(bx - w * 0.1, y + h * 0.5, w * 0.1, h * 0.07).fillRect(bx + bw, y + h * 0.5, w * 0.1, h * 0.07); // grid fins
    g.fillStyle(DARK).fillTriangle(bx, y + h * 0.9, bx - w * 0.12, y + h, bx, y + h).fillTriangle(bx + bw, y + h * 0.9, bx + bw + w * 0.12, y + h, bx + bw, y + h); // legs
  }
}

// A small card on the map showing a launch site: pads, hulls, hangars and tanks.
export function renderSiteScene(ui, s, siteId) {
  const st = s.sites[siteId];
  const d = SITES[siteId];
  if (!st || st.status === 'locked') return;
  const x = 18;
  const w = 250;
  const h = 128;
  const y = 522 - h - 4;
  const g = ui.scene.add.graphics();
  ui.container.add(g);
  g.fillStyle(0x0b1530, 0.9).fillRect(x, y, w, h);
  g.lineStyle(1, COL.line).strokeRect(x + 0.5, y + 0.5, w, h);
  const gy = y + h - 20;
  g.fillStyle(0x17261f).fillRect(x + 1, gy, w - 1, 19);
  g.lineStyle(1, 0x2a3f33).lineBetween(x + 1, gy, x + w, gy);
  ui.label(x + 6, y + 4, `${d.letter} · ${d.short}`, { size: 11, bold: true, color: hex(COL.accent) });

  const ready = s.fleet.filter((v) => (v.site ?? 'cape') === siteId && sim.vehicleState(s, v) === 'ready');
  st.pads.forEach((p, i) => {
    const px = x + 18 + i * 46;
    g.fillStyle(0x3a4658).fillRect(px - 12, gy - 3, 30, 3); // pad
    g.fillStyle(0x5b6a86).fillRect(px + 14, gy - 62, 3, 59); // tower
    if (p.tower) g.lineStyle(2, 0x9fb0c8).lineBetween(px + 14, gy - 58, px + 3, gy - 58).lineBetween(px + 14, gy - 48, px + 3, gy - 48);
    const hull = ready[i];
    if (hull) drawRocket(g, px - 9, gy - 56, 20, 53, hull.type);
    const left = p.busyUntil - s.day;
    if (left > 3) {
      g.lineStyle(2, COL.bad).lineBetween(px - 8, gy - 42, px + 10, gy - 12).lineBetween(px + 10, gy - 42, px - 8, gy - 12);
    } else if (left > 0) {
      g.fillStyle(0xffb347, 0.5).fillEllipse(px, gy - 4, 28, 8);
    }
  });

  // hangars: boxes, with a hull inside while it is being refit here
  const refit = s.fleet.filter((v) => (v.site ?? 'cape') === siteId && sim.vehicleState(s, v) === 'refit').length;
  st.bays.forEach((b, i) => {
    const hx = x + 158;
    const hy = gy - 18 - i * 19;
    g.fillStyle(b.tenure === 'owned' ? 0x3d5a73 : 0x4a4a55).fillRect(hx, hy, 34, 16);
    g.fillStyle(0x253447).fillRect(hx + 4, hy + 5, 26, 11);
    if (i < refit) g.fillStyle(COL.warn).fillRect(hx + 10, hy + 8, 14, 5);
  });

  // tank farm
  ['kerolox', 'methalox', 'lox', 'steel', 'aluminum'].forEach((f, i) => {
    const tx = x + 204 + i * 11;
    const frac = Math.min(1, st.cap[f] ? st.stock[f] / st.cap[f] : 0);
    g.fillStyle(0x16203a).fillRect(tx, gy - 44, 8, 44);
    g.fillStyle({ kerolox: 0xffb347, methalox: 0x4fd1ff, lox: 0x9fe8ff, steel: 0xb9c4d4, aluminum: 0xdfe6f2 }[f]).fillRect(tx, gy - 44 * frac, 8, 44 * frac);
    g.lineStyle(1, COL.line).strokeRect(tx + 0.5, gy - 44 + 0.5, 8, 44);
  });
}
