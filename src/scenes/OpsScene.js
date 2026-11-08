import Phaser from 'phaser';
import { REGIONS, TECH, CORE_LIFE, ROCKETS } from '../data.js';
import * as sim from '../sim.js';

const SAVE_KEY = 'perigee-industries-save';

const COL = {
  bg: 0x05070d, panel: 0x0b1220, line: 0x22304d, accent: 0x4fd1ff, good: 0x5be584,
  warn: 0xffb84d, bad: 0xff5d6c, dim: 0x6b7a99, text: '#d7e2f5', dimText: '#7d8cab',
};
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const FONT = 'system-ui, sans-serif';

export class OpsScene extends Phaser.Scene {
  constructor() {
    super('ops');
    this.speed = 1;
    this.launching = false;
  }

  create() {
    this.s = this.loadGame() ?? sim.createState();
    this.drawStars();
    this.drawFrame();
    this.buildRocket();
    this.ui = this.add.container(0, 0);
    this.hint = this.add.text(20, 572, '', { fontFamily: FONT, fontSize: 13, color: hex(COL.accent) });
    this.scheduleTick();
    this.render();
  }

  // ---- static decor ----------------------------------------------------
  drawStars() {
    const g = this.add.graphics();
    for (let i = 0; i < 160; i++) {
      g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.1, 0.6));
      g.fillRect(Phaser.Math.Between(0, 1280), Phaser.Math.Between(0, 720), 1.5, 1.5);
    }
  }

  drawFrame() {
    const g = this.add.graphics();
    const panels = [[10, 60, 380, 500], [400, 60, 480, 500], [890, 60, 380, 500], [10, 566, 1260, 144]];
    for (const [x, y, w, h] of panels) {
      g.fillStyle(COL.panel, 0.92).fillRect(x, y, w, h);
      g.lineStyle(1, COL.line).strokeRect(x + 0.5, y + 0.5, w, h);
    }
    g.fillStyle(COL.panel, 0.95).fillRect(0, 0, 1280, 50);
    g.lineStyle(1, COL.line).lineBetween(0, 50, 1280, 50);
  }

  buildRocket() {
    // Rocket graphic on the pad, in the left panel.
    this.padX = 200; this.padY = 230;
    const pad = this.add.graphics();
    pad.fillStyle(0x1b2640).fillRect(60, this.padY + 2, 280, 8);
    pad.fillStyle(0x2a3a5e).fillRect(150, this.padY + 10, 100, 6);
    this.rocket = this.add.container(this.padX, this.padY);
    const body = this.add.graphics();
    body.fillStyle(0xe8eef9).fillRect(-12, -110, 24, 110);
    body.fillStyle(0xe8eef9).fillTriangle(-12, -110, 12, -110, 0, -138);
    body.fillStyle(0x2c3b5c).fillRect(-12, -70, 24, 6);
    body.fillStyle(0x9fb1d1).fillTriangle(-12, 0, -26, 0, -12, -34).fillTriangle(12, 0, 26, 0, 12, -34);
    this.flame = this.add.graphics().setVisible(false);
    this.flame.fillStyle(0xffa63d).fillTriangle(-9, 0, 9, 0, 0, 46);
    this.flame.fillStyle(0xfff2b0).fillTriangle(-4, 0, 4, 0, 0, 24);
    this.rocket.add([this.flame, body]);
  }

  // ---- save / load ------------------------------------------------------
  loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? sim.deserialize(raw) : null;
    } catch {
      return null; // storage blocked or unavailable
    }
  }

  saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, sim.serialize(this.s));
      this.savedAt = this.time.now;
    } catch {
      // Storage full or blocked: the game still plays, it just won't persist.
    }
  }

  newGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing to clear */ }
    this.s = sim.createState();
    this.confirmNew = false;
    this.saveGame();
  }

  // ---- time ------------------------------------------------------------
  scheduleTick() {
    this.tickEvent?.remove();
    if (!this.speed) return;
    this.tickEvent = this.time.addEvent({
      delay: 1200 / this.speed, loop: true,
      callback: () => { sim.tick(this.s); this.saveGame(); this.render(); },
    });
  }

  setSpeed(v) { this.speed = v; this.scheduleTick(); }

  act(fn) {
    fn();
    this.saveGame();
    this.time.delayedCall(0, () => this.render());
  }

  // ---- ui helpers ------------------------------------------------------
  label(x, y, str, o = {}) {
    const t = this.add.text(x, y, str, {
      fontFamily: FONT, fontSize: o.size ?? 14, color: o.color ?? COL.text, fontStyle: o.bold ? 'bold' : 'normal',
    });
    if (o.right) t.setOrigin(1, 0);
    if (o.center) t.setOrigin(0.5, 0);
    this.ui.add(t);
    return t;
  }

  button(x, y, w, h, label, cb, o = {}) {
    const enabled = o.enabled !== false;
    const base = o.fill ?? 0x12304a;
    const r = this.add.rectangle(x, y, w, h, enabled ? base : 0x141b2b).setOrigin(0)
      .setStrokeStyle(1, enabled ? (o.stroke ?? COL.accent) : 0x2a3550);
    const t = this.add.text(x + w / 2, y + h / 2, label, {
      fontFamily: FONT, fontSize: o.size ?? 14, fontStyle: 'bold', color: enabled ? '#eaf6ff' : '#566380',
    }).setOrigin(0.5);
    if (enabled) {
      r.setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.act(cb))
        .on('pointerover', () => r.setFillStyle(0x1d4a70))
        .on('pointerout', () => r.setFillStyle(base));
    }
    if (o.hint) this.hoverHint(r, o.hint);
    this.ui.add([r, t]);
    return r;
  }

  hoverHint(obj, text) {
    obj.setInteractive();
    obj.on('pointerover', () => this.hint.setText(text));
    obj.on('pointerout', () => this.hint.setText(''));
  }

  bar(x, y, w, h, frac, color) {
    const g = this.add.graphics();
    g.fillStyle(0x16203a).fillRect(x, y, w, h);
    g.fillStyle(color).fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
    g.lineStyle(1, COL.line).strokeRect(x + 0.5, y + 0.5, w, h);
    this.ui.add(g);
  }

  heading(x, y, str) { this.label(x, y, str, { size: 12, color: hex(COL.accent), bold: true }); }

  // ---- main render -----------------------------------------------------
  render() {
    const s = this.s;
    this.ui.removeAll(true);
    this.renderTopBar(s);
    this.renderFleet(s);
    this.renderContracts(s);
    this.renderManifest(s);
    this.renderSkylink(s);
    this.renderTech(s);
    this.renderLog(s);
    this.rocket.setAlpha(this.launching ? 1 : sim.padReady(s) ? 1 : 0.25);
  }

  renderTopBar(s) {
    const net = sim.dailyRevenue(s) - sim.OVERHEAD_PER_DAY;
    this.label(20, 13, 'PERIGEE INDUSTRIES', { size: 20, bold: true, color: hex(COL.accent) });
    this.label(330, 15, `Day ${s.day}`, { size: 16 });
    this.label(430, 15, `Cash $${s.cash.toFixed(1)}M`, { size: 16, color: hex(COL.good) });
    this.label(600, 15, `Net ${net >= 0 ? '+' : '-'}$${Math.abs(net).toFixed(2)}M/day`, { size: 16 });
    [[0, 'Pause'], [1, '1x'], [3, '3x'], [8, '8x']].forEach(([v, name], i) => {
      this.button(880 + i * 66, 10, 60, 30, name, () => this.setSpeed(v), {
        fill: this.speed === v ? 0x1d6a4a : 0x12304a, stroke: this.speed === v ? COL.good : COL.accent, size: 13,
      });
    });
    const sure = this.confirmNew;
    this.button(1150, 10, 120, 30, sure ? 'Erase save?' : 'New game', () => {
      if (sure) return this.newGame();
      this.confirmNew = true;
      this.time.delayedCall(3000, () => { this.confirmNew = false; this.render(); });
    }, { size: 13, fill: sure ? 0x7a2a1d : 0x12304a, stroke: sure ? COL.bad : COL.accent });
  }

  renderFleet(s) {
    const r = sim.rocketDef(s);
    this.heading(24, 70, 'FLEET OPS  ·  PAD 39A');
    const y0 = 280;
    this.label(24, y0, r.name, { size: 18, bold: true });
    if (sim.hasHeavy(s)) {
      const other = s.rocket === 'peregrine9' ? 'peregrineHeavy' : 'peregrine9';
      this.button(250, y0 - 2, 130, 26, `Switch: ${ROCKETS[other].name}`, () => sim.setRocket(s, other), { size: 11 });
    }
    const ready = sim.padReady(s);
    this.label(24, y0 + 30, ready ? 'Pad READY' : `Turnaround: ${s.padReadyDay - s.day} day(s)`, {
      color: hex(ready ? COL.good : COL.warn),
    });
    this.label(24, y0 + 54, `Booster wear: ${s.core.launches}/${CORE_LIFE} launches`, { size: 13, color: COL.dimText });
    const wear = s.core.launches / CORE_LIFE;
    this.bar(24, y0 + 74, 352, 10, wear, wear > 0.7 ? COL.bad : wear > 0.4 ? COL.warn : COL.good);
    const risk = Math.round(sim.failChance(s) * 100);
    this.label(24, y0 + 90, `Failure risk this launch: ~${risk}%`, { size: 12, color: COL.dimText });

    this.label(24, y0 + 118, 'Booster recovery', { size: 13, color: COL.dimText });
    const cap = sim.capacity(s);
    this.button(24, y0 + 138, 172, 34, 'RTLS pad', () => { s.recovery = 'rtls'; }, {
      fill: s.recovery === 'rtls' ? 0x1d6a4a : 0x12304a, stroke: s.recovery === 'rtls' ? COL.good : COL.accent,
      hint: 'RTLS: -2 days turnaround, but -20% payload (fuel reserve).',
    });
    this.button(204, y0 + 138, 172, 34, 'Droneship', () => { s.recovery = 'drone'; }, {
      fill: s.recovery === 'drone' ? 0x1d6a4a : 0x12304a, stroke: s.recovery === 'drone' ? COL.good : COL.accent,
      hint: 'Droneship: full payload, longer turnaround, $0.3M fee.',
    });
    this.label(24, y0 + 178, `Capacity: ${cap.mass} t  ·  ${cap.volume} m³`, { size: 13 });

    const blocker = sim.launchBlocker(s);
    const worn = sim.coreWorn(s);
    if (worn) this.button(24, y0 + 204, 352, 28, `Buy new core ($${sim.CORE_COST}M)`, () => sim.buyCore(s), {
      enabled: sim.canSpend(s, sim.CORE_COST), fill: 0x5a3a12, stroke: COL.warn, size: 13,
    });
    this.button(24, y0 + 238, 352, 44, blocker ? `LAUNCH  (${blocker})` : `LAUNCH  ($${sim.launchCost(s)}M)`, () => this.doLaunch(), {
      enabled: !blocker && !this.launching, fill: 0x7a2a1d, stroke: COL.bad, size: blocker ? 12 : 16,
    });
  }

  renderContracts(s) {
    this.heading(414, 70, 'CONTRACT BOARD  ·  click to add to manifest');
    s.contracts.forEach((c, i) => {
      const y = 94 + i * 38;
      const on = s.manifest.includes(c.id);
      const row = this.add.rectangle(410, y, 462, 34, on ? 0x14385a : 0x101a2e).setOrigin(0)
        .setStrokeStyle(1, on ? COL.accent : COL.line).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.act(() => sim.toggleContract(s, c.id)));
      this.ui.add(row);
      this.label(418, y + 4, c.customer, { size: 13, bold: true });
      this.label(418, y + 19, `${c.dest}  ·  expires day ${c.expires}`, { size: 11, color: COL.dimText });
      this.label(660, y + 9, `${c.mass} t`, { size: 13 });
      this.label(730, y + 9, `${c.volume} m³`, { size: 13 });
      this.label(862, y + 9, `$${c.payout}M`, { size: 14, bold: true, color: hex(COL.good), right: true });
    });
    if (!s.contracts.length) this.label(420, 110, 'No contracts available. New ones arrive every few days.', { color: COL.dimText });
  }

  renderManifest(s) {
    const y = 404;
    const t = sim.manifestTotals(s);
    const cap = sim.capacity(s);
    this.heading(414, y, 'MANIFEST');
    const fit = (v, c) => (v > c ? COL.bad : v / c > 0.85 ? COL.warn : COL.good);
    this.label(414, y + 20, `Mass ${t.mass} / ${cap.mass} t`, { size: 13 });
    this.bar(414, y + 40, 454, 10, t.mass / cap.mass, fit(t.mass, cap.mass));
    this.label(414, y + 56, `Volume ${t.volume} / ${cap.volume} m³`, { size: 13 });
    this.bar(414, y + 76, 454, 10, t.volume / cap.volume, fit(t.volume, cap.volume));
    this.label(414, y + 96, `Contract payout: $${t.payout}M`, { size: 13, color: hex(COL.good) });
    const gen1 = s.tech.has('gen1');
    const region = REGIONS.find((x) => x.id === s.region);
    this.label(414, y + 122, gen1 ? `Skylink Gen-1 sats: ${s.sats} → ${region.name}` : 'Skylink satellites: research Gen-1', {
      size: 13, color: gen1 ? COL.text : COL.dimText,
    });
    this.button(760, y + 118, 50, 26, `-${sim.SAT_BATCH}`, () => sim.adjustSats(s, -sim.SAT_BATCH), { enabled: gen1 && s.sats > 0, size: 12 });
    this.button(818, y + 118, 50, 26, `+${sim.SAT_BATCH}`, () => sim.adjustSats(s, sim.SAT_BATCH), {
      enabled: gen1 && s.sats < sim.rocketDef(s).sats, size: 12,
    });
  }

  renderSkylink(s) {
    this.heading(904, 70, 'SKYLINK COVERAGE  ·  click to set target region');
    REGIONS.forEach((r, i) => {
      const y = 94 + i * 28;
      const cov = sim.coverage(s, r);
      const sel = s.region === r.id;
      const row = this.add.rectangle(900, y, 360, 26, sel ? 0x14385a : 0x101a2e).setOrigin(0)
        .setStrokeStyle(1, sel ? COL.accent : COL.line).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.act(() => { s.region = r.id; }));
      this.ui.add(row);
      this.label(908, y + 5, r.name, { size: 12 });
      this.bar(1030, y + 8, 110, 10, cov, cov < 0.3 ? COL.bad : cov < 0.7 ? COL.warn : COL.good);
      this.label(1148, y + 5, `${Math.round(cov * 100)}%`, { size: 12 });
      this.label(1250, y + 5, `$${sim.regionRevenue(s, r).toFixed(2)}M/d`, { size: 12, color: COL.dimText, right: true });
    });
  }

  renderTech(s) {
    this.heading(904, 266, 'R&D  ·  click to research');
    TECH.forEach((t, i) => {
      const y = 290 + i * 29;
      const st = sim.techState(s, t.id);
      const afford = sim.canSpend(s, t.cost);
      const stroke = st === 'owned' ? COL.good : st === 'available' && afford ? COL.accent : COL.line;
      const fill = st === 'owned' ? 0x123524 : 0x101a2e;
      const row = this.add.rectangle(900, y, 360, 26, fill).setOrigin(0).setStrokeStyle(1, stroke);
      if (st === 'available' && afford) row.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.act(() => sim.buyTech(s, t.id)));
      const need = t.requires.filter((q) => !s.tech.has(q)).map((q) => TECH.find((x) => x.id === q).name);
      this.hoverHint(row, `${t.name}: ${t.desc}${st === 'locked' ? `  (needs ${need.join(', ')})` : ''}`);
      this.ui.add(row);
      const dim = st === 'locked';
      this.label(908, y + 5, t.name, { size: 12, color: dim ? COL.dimText : COL.text });
      this.label(1250, y + 5, st === 'owned' ? 'DONE' : `$${t.cost}M`, {
        size: 12, right: true, color: st === 'owned' ? hex(COL.good) : afford || dim ? COL.dimText : hex(COL.bad),
      });
    });
  }

  renderLog(s) {
    this.heading(20, 590, 'MISSION LOG');
    s.log.slice(-5).forEach((m, i, arr) => {
      this.label(20, 612 + i * 18, m, { size: 13, color: i === arr.length - 1 ? COL.text : COL.dimText });
    });
  }

  // ---- launch ----------------------------------------------------------
  doLaunch() {
    const s = this.s;
    const res = sim.launch(s);
    if (!res.ok) return;
    this.launching = true;
    this.flame.setVisible(true);
    this.flame.setScale(1, 1);
    this.tweens.add({ targets: this.flame, scaleY: { from: 0.7, to: 1.3 }, duration: 90, yoyo: true, repeat: -1 });
    this.tweens.add({
      targets: this.rocket, y: this.padY - 520, duration: 2400, ease: 'Quad.easeIn',
      onUpdate: () => {
        if (!res.failed) return;
        if (this.rocket.y < this.padY - 200 && !this.boomed) { this.boomed = true; this.explode(); }
      },
      onComplete: () => {
        this.tweens.killTweensOf(this.flame);
        this.flame.setVisible(false);
        this.rocket.y = this.padY;
        this.rocket.setVisible(true);
        this.launching = false;
        this.boomed = false;
        this.render();
      },
    });
  }

  explode() {
    this.rocket.setVisible(false);
    const c = this.add.circle(this.padX, this.rocket.y - 60, 8, 0xffa63d, 0.9);
    this.tweens.add({ targets: c, radius: 70, alpha: 0, duration: 600, onComplete: () => c.destroy() });
    this.cameras.main.shake(300, 0.006);
  }
}
