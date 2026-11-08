// The base view: a top-down grid of the landing site where modules (starships on their sides) are placed,
// joined by ducts, buried by drones, and powered by reactors.
import { MODULES, BASE_W, BASE_H, DUCT_MAX, DESTINATIONS } from '../data.js';
import * as B from '../base.js';
import { COL, FONT } from '../ui/ui.js';
import { makeTerrain } from './baseTerrain.js';

const T = 14; // pixels per tile
const REGOLITH = 0x7a7064;

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export class BaseLayer {
  constructor(scene, rect, { getState, getMode, onTile, onPort, setHint }) {
    this.scene = scene;
    this.rect = rect;
    this.ox = rect.x + Math.floor((rect.w - BASE_W * T) / 2);
    this.oy = rect.y + Math.floor((rect.h - BASE_H * T) / 2);
    this.getState = getState;
    this.getMode = getMode;
    this.onTile = onTile;
    this.onPort = onPort;
    this.setHint = setHint;
    this.shown = false;
    this.terrainKey = null;
    this.cursor = null;
    this.container = scene.add.container(0, 0).setVisible(false).setAlpha(0);
    this.terrain = scene.add.image(rect.x, rect.y, '__DEFAULT').setOrigin(0).setVisible(false);
    this.g = scene.add.graphics();
    this.container.add([this.terrain, this.g]);
    this.labels = [];
    this.zone = scene.add.zone(rect.x, rect.y, rect.w, rect.h).setOrigin(0).setInteractive({ useHandCursor: true });
    this.zone.input.enabled = false;
    this.container.add(this.zone);
    this.zone.on('pointermove', (p) => { this.cursor = this.tileAt(p.x, p.y); });
    this.zone.on('pointerout', () => { this.cursor = null; });
    this.zone.on('pointerdown', (p) => {
      if (p.rightButtonDown()) return this.onTile(null, true);
      const mode = this.getMode();
      if (mode.kind === 'duct') {
        const port = this.portNear(p.x, p.y);
        if (port) this.onPort(port);
        return;
      }
      const t = this.tileAt(p.x, p.y);
      if (t) this.onTile(t, false);
    });
  }

  tileAt(px, py) {
    const x = Math.floor((px - this.ox) / T);
    const y = Math.floor((py - this.oy) / T);
    return x >= 0 && y >= 0 && x < BASE_W && y < BASE_H ? { x, y } : null;
  }

  center(t) {
    return { x: this.ox + t.x * T + T / 2, y: this.oy + t.y * T + T / 2 };
  }

  portNear(px, py) {
    const base = this.getState().base;
    let best = null;
    let bestD = 15;
    for (const m of base.modules) {
      for (const end of [0, 1]) {
        const c = this.center(B.portTile(m, end));
        const d = Math.hypot(c.x - px, c.y - py);
        if (d < bestD) { bestD = d; best = B.portId(m, end); }
      }
    }
    return best;
  }

  show() {
    const base = this.getState().base;
    if (this.terrainKey !== base.site) {
      const key = `terrain-${base.site}`;
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
      this.scene.textures.addCanvas(key, makeTerrain(base.site, this.rect.w, this.rect.h));
      this.terrain.setTexture(key).setVisible(true);
      this.terrainKey = base.site;
    }
    this.shown = true;
    this.zone.input.enabled = true;
    this.container.setVisible(true);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 350 });
  }

  hide(instant = false) {
    this.shown = false;
    this.zone.input.enabled = false;
    this.cursor = null;
    this.labels.forEach((l) => l.setVisible(false));
    if (instant) { this.container.setAlpha(0).setVisible(false); return; }
    this.scene.tweens.add({ targets: this.container, alpha: 0, duration: 300, onComplete: () => this.container.setVisible(false) });
  }

  // ---- drawing -----------------------------------------------------------------
  shape(m) {
    const len = MODULES[m.type].len;
    const w = (m.rot ? 0.86 : len) * T - (m.rot ? 0 : 2);
    const h = (m.rot ? len : 0.86) * T - (m.rot ? 2 : 0);
    return { x: this.ox + m.x * T + (m.rot ? T * 0.07 : 1), y: this.oy + m.y * T + (m.rot ? 1 : T * 0.07), w, h };
  }

  drawModuleBody(g, type, sh, rot, alpha = 1) {
    const def = MODULES[type];
    const r = Math.min(sh.w, sh.h) / 2;
    g.fillStyle(0x1b2030, alpha).fillRoundedRect(sh.x - 1.5, sh.y - 1.5, sh.w + 3, sh.h + 3, r + 1.5);
    g.fillStyle(def.color, alpha).fillRoundedRect(sh.x, sh.y, sh.w, sh.h, r);
    const dark = 0x2c3b5c;
    const along = (i, n) => (rot ? { x: sh.x + sh.w / 2, y: sh.y + sh.h * (i / n) } : { x: sh.x + sh.w * (i / n), y: sh.y + sh.h / 2 });
    if (type === 'habitat') {
      for (let i = 1; i <= 4; i++) { const p = along(i, 5.4); g.fillStyle(dark, alpha).fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
    } else if (type === 'reactor') {
      for (let i = 1; i <= 3; i++) { const p = along(i, 4.2); g.lineStyle(2, 0x8a4a1c, alpha); if (rot) g.lineBetween(p.x - 6, p.y, p.x + 6, p.y); else g.lineBetween(p.x, p.y - 6, p.x, p.y + 6); }
    } else if (type === 'smelter') {
      const p = along(2.5, 5);
      g.fillStyle(0x4a5568, alpha).fillCircle(p.x, p.y, 3.5);
      g.fillStyle(0xff8a3d, alpha).fillCircle(p.x, p.y, 1.6);
    } else if (type === 'icer') {
      const p = along(2, 4);
      g.fillStyle(0x2b6c99, alpha).fillTriangle(p.x - 3, p.y - 4, p.x + 3, p.y - 4, p.x, p.y + 5);
    } else if (type === 'refinery') {
      for (let i = 1; i <= 2; i++) { const p = along(i, 3); g.lineStyle(1.5, 0x2e8f6e, alpha).strokeCircle(p.x, p.y, 3.2); }
    } else if (type === 'drones') {
      for (let i = 1; i <= 2; i++) { const p = along(i, 3); g.lineStyle(1.5, 0x2e6b2e, alpha).strokeRect(p.x - 3, p.y - 3, 6, 6); }
    } else {
      const p = along(2.5, 5);
      g.lineStyle(2, 0x7a6a1c, alpha).lineBetween(p.x - 5, p.y - 5, p.x + 5, p.y + 5);
    }
  }

  update(time) {
    if (!this.shown) return;
    const s = this.getState();
    const base = s.base;
    const g = this.g;
    g.clear();
    const mode = this.getMode();
    const { byModule } = B.analyze(base);

    if (mode.kind !== 'idle') {
      g.lineStyle(1, 0xffffff, 0.07);
      for (let x = 0; x <= BASE_W; x++) g.lineBetween(this.ox + x * T, this.oy, this.ox + x * T, this.oy + BASE_H * T);
      for (let y = 0; y <= BASE_H; y++) g.lineBetween(this.ox, this.oy + y * T, this.ox + BASE_W * T, this.oy + y * T);
    }

    // Excavation pits
    const taken = new Set(base.modules.flatMap((m) => B.moduleTiles(m).map((t) => `${t.x},${t.y}`)));
    const pits = Math.min(60, Math.floor(base.dug / 3));
    for (let i = 0; i < pits; i++) {
      const tx = Math.floor(hash(i + 1) * BASE_W);
      const ty = Math.floor(hash(i + 91) * BASE_H);
      if (taken.has(`${tx},${ty}`)) continue;
      const c = this.center({ x: tx, y: ty });
      const r = 4 + hash(i + 7) * 4;
      g.fillStyle(0x15171c, 0.55).fillEllipse(c.x, c.y, r * 2.1, r * 1.5);
      g.lineStyle(1.5, 0xa59a8a, 0.4).strokeEllipse(c.x, c.y, r * 2.4, r * 1.8);
    }

    // Ducts, drawn under the modules
    for (const d of base.ducts) {
      const a = B.findPort(base, d.a);
      const b = B.findPort(base, d.b);
      if (!a || !b) continue;
      const pa = this.center(a.tile);
      const pb = this.center(b.tile);
      const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 + 6 };
      const pts = Array.from({ length: 17 }, (_, i) => {
        const u = i / 16;
        return { x: (1 - u) * (1 - u) * pa.x + 2 * (1 - u) * u * mid.x + u * u * pb.x, y: (1 - u) * (1 - u) * pa.y + 2 * (1 - u) * u * mid.y + u * u * pb.y };
      });
      g.lineStyle(7, 0x15171c, 1);
      for (let i = 1; i < pts.length; i++) g.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
      g.lineStyle(5, 0x515866, 1);
      for (let i = 1; i < pts.length; i++) if (i % 2) g.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    }

    // Modules
    base.modules.forEach((m) => {
      const sh = this.shape(m);
      this.drawModuleBody(g, m.type, sh, m.rot);
      if (m.cover > 0.02) {
        const r = Math.min(sh.w, sh.h) / 2;
        g.fillStyle(REGOLITH, Math.min(0.94, m.cover * 0.95)).fillRoundedRect(sh.x - 1, sh.y - 1, sh.w + 2, sh.h + 2, r + 1);
        const n = Math.floor(m.cover * 8 * MODULES[m.type].len);
        for (let i = 0; i < n; i++) {
          const px = sh.x + hash(m.id * 31 + i) * sh.w;
          const py = sh.y + hash(m.id * 57 + i) * sh.h;
          g.fillStyle(hash(i + m.id) < 0.5 ? 0x544c42 : 0xa09484, 0.7).fillRect(px, py, 2, 1.6);
        }
      }
      const net = byModule.get(m.id);
      const ok = net.powerFactor > 0;
      g.lineStyle(1.5, ok ? 0x5be584 : 0xff5d6c, m.cover > 0.9 ? 0.5 : 0.9).strokeRoundedRect(sh.x - 1.5, sh.y - 1.5, sh.w + 3, sh.h + 3, Math.min(sh.w, sh.h) / 2 + 1.5);
    });

    // Ports
    const idle = mode.kind !== 'duct';
    for (const m of base.modules) {
      for (const end of [0, 1]) {
        const id = B.portId(m, end);
        const c = this.center(B.portTile(m, end));
        const used = B.portUsed(base, id);
        const picked = mode.ductFrom === id;
        if (idle && !used) continue;
        const pulse = 0.6 + 0.4 * Math.sin(time / 220);
        g.fillStyle(picked ? 0xffd54f : used ? COL.accent : 0xffffff, used ? 1 : pulse).fillCircle(c.x, c.y, picked ? 4.5 : 3.5);
        g.lineStyle(1, 0x05070d, 1).strokeCircle(c.x, c.y, picked ? 4.5 : 3.5);
      }
    }

    // Ghost while placing
    if (mode.kind === 'place' && this.cursor) {
      const pending = base.pending.find((p) => p.id === mode.pendingId);
      if (pending) {
        const ghost = { type: pending.type, x: this.cursor.x, y: this.cursor.y, rot: mode.rot ? 1 : 0, id: 0 };
        const ok = B.canPlace(base, ghost.type, ghost.x, ghost.y, ghost.rot);
        this.drawModuleBody(g, ghost.type, this.shape(ghost), ghost.rot, 0.65);
        const sh = this.shape(ghost);
        g.lineStyle(2, ok ? 0x5be584 : 0xff5d6c, 0.95).strokeRoundedRect(sh.x - 1.5, sh.y - 1.5, sh.w + 3, sh.h + 3, Math.min(sh.w, sh.h) / 2 + 1.5);
      }
    }
    // Duct preview line
    if (mode.kind === 'duct' && mode.ductFrom) {
      const from = B.findPort(base, mode.ductFrom);
      const hover = this.cursor ? this.center(this.cursor) : null;
      if (from && hover) {
        const c = this.center(from.tile);
        const dist = Math.abs(from.tile.x - this.cursor.x) + Math.abs(from.tile.y - this.cursor.y);
        g.lineStyle(3, dist > DUCT_MAX ? 0xff5d6c : 0xffd54f, 0.8).lineBetween(c.x, c.y, hover.x, hover.y);
      }
    }

    // Drones shuttling between pits and the module being buried
    const nDrones = base.modules.reduce((n, m) => n + (MODULES[m.type].drones ?? 0) * (byModule.get(m.id).work > 0 ? 1 : 0), 0);
    const target = [...base.modules].filter((m) => m.cover < 1).sort((a, b) => (b.type === 'habitat') - (a.type === 'habitat') || a.cover - b.cover)[0];
    for (let i = 0; i < nDrones; i++) {
      const pit = this.center({ x: Math.floor(hash(i * 3 + 1) * BASE_W), y: Math.floor(hash(i * 3 + 91) * BASE_H) });
      const home = target ? this.center({ x: target.x + (target.rot ? 0 : 1), y: target.y + (target.rot ? 1 : 0) }) : pit;
      const u = 0.5 + 0.5 * Math.sin(time / 1700 + i * 1.7);
      const x = pit.x + (home.x - pit.x) * u;
      const y = pit.y + (home.y - pit.y) * u;
      g.fillStyle(0x05070d, 0.5).fillCircle(x + 1, y + 1.5, 3.4);
      g.fillStyle(u > 0.5 ? 0xffd54f : 0xf0f0f0, 1).fillCircle(x, y, 3);
    }

    // Hover info
    if (this.cursor && mode.kind === 'idle') {
      const m = base.modules.find((mm) => B.moduleTiles(mm).some((t) => t.x === this.cursor.x && t.y === this.cursor.y));
      if (m) {
        const net = byModule.get(m.id);
        const def = MODULES[m.type];
        this.setHint(`${def.name}: ${Math.round(m.cover * 100)}% buried · ${net.powerFactor > 0 ? `power ${Math.round(net.powerFactor * 100)}%` : 'NO POWER'}${def.crew ? ` · crew ${m.crew}/${def.crew}` : ''}${def.need ? ` · staffed ${Math.round(net.staffFactor * 100)}%` : ''}`);
      }
    }

    // Labels
    const site = DESTINATIONS[base.site].name;
    this.label(0, `${site}  ·  top-down base view`, this.rect.x + 12, this.rect.y + 8, '#e6f3ff');
    this.labels.forEach((l, i) => l.setVisible(i < 1));
  }

  label(i, text, x, y, color) {
    let t = this.labels[i];
    if (!t) {
      t = this.labels[i] = this.scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: 12, color, stroke: '#05070d', strokeThickness: 3 });
      this.container.add(t);
    }
    t.setText(text).setPosition(x, y).setVisible(true);
  }
}
