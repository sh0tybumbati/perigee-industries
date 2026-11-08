// Game-feel effects (GDD 2.13): toasts, milestone banners, floating cash and the launch sequence.
// They live outside the container that the scene rebuilds on every state change, so they survive re-renders.
import Phaser from 'phaser';
import { COL, FONT, hex } from './ui/ui.js';
import { W, H } from './layout.js';
import * as audio from './audio.js';

const DEPTH = 500;
const KIND_COL = { good: COL.good, warn: COL.warn, bad: COL.bad, info: COL.accent };

export class FX {
  constructor(scene, map) {
    this.scene = scene;
    this.map = map; // { x, y, w, h } of the map panel
    this.toasts = [];
    this.bannerQueue = [];
    this.bannerBusy = false;
    this.busy = false; // a launch sequence is running
  }

  get cx() { return this.map.x + this.map.w / 2; }

  text(x, y, str, size, color, o = {}) {
    return this.scene.add.text(x, y, str, {
      fontFamily: FONT, fontSize: size, color, fontStyle: 'bold', stroke: '#05070d', strokeThickness: o.stroke ?? 4,
    }).setOrigin(o.ox ?? 0.5, o.oy ?? 0.5).setDepth(DEPTH + 1).setScrollFactor(0);
  }

  // ---- toasts -------------------------------------------------------------
  toast(msg, kind = 'info') {
    const s = this.scene;
    const c = KIND_COL[kind] ?? COL.accent;
    const w = 360;
    const label = msg.length > 62 ? `${msg.slice(0, 60)}…` : msg;
    const bg = s.add.rectangle(0, 0, w, 24, 0x0b1220, 0.92).setOrigin(0).setStrokeStyle(1, c);
    const bar = s.add.rectangle(0, 0, 4, 24, c).setOrigin(0);
    const t = s.add.text(12, 5, label, { fontFamily: FONT, fontSize: 12, color: '#eaf6ff' });
    const box = s.add.container(this.map.x + 8, this.map.y + 8, [bg, bar, t]).setDepth(DEPTH).setAlpha(0);
    this.toasts.unshift(box);
    if (this.toasts.length > 4) this.dismiss(this.toasts[this.toasts.length - 1]);
    this.layoutToasts();
    s.tweens.add({ targets: box, alpha: 1, duration: 160 });
    s.time.delayedCall(4800, () => this.dismiss(box));
  }

  dismiss(box) {
    if (!this.toasts.includes(box)) return;
    this.toasts = this.toasts.filter((b) => b !== box);
    this.scene.tweens.add({ targets: box, alpha: 0, duration: 260, onComplete: () => box.destroy() });
    this.layoutToasts();
  }

  layoutToasts() {
    this.toasts.forEach((b, i) => this.scene.tweens.add({ targets: b, y: this.map.y + 8 + i * 28, duration: 140 }));
  }

  // ---- milestone banner -----------------------------------------------------
  banner(title, text, date) {
    this.bannerQueue.push({ title, text, date });
    this.nextBanner();
  }

  nextBanner() {
    if (this.bannerBusy || !this.bannerQueue.length) return;
    const { title, text, date } = this.bannerQueue.shift();
    this.bannerBusy = true;
    const s = this.scene;
    const w = 460;
    const y = this.map.y + 190;
    const bg = s.add.rectangle(0, 0, w, 78, 0x0b1220, 0.96).setStrokeStyle(2, 0xffd166);
    const top = s.add.text(0, -28, `MILESTONE  ·  ${date}`, { fontFamily: FONT, fontSize: 11, color: '#ffd166', fontStyle: 'bold' }).setOrigin(0.5);
    const head = s.add.text(0, -6, title, { fontFamily: FONT, fontSize: 22, color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    const sub = s.add.text(0, 20, text.length > 70 ? `${text.slice(0, 68)}…` : text, { fontFamily: FONT, fontSize: 12, color: COL.dimText }).setOrigin(0.5);
    const box = s.add.container(this.cx, y - 30, [bg, top, head, sub]).setDepth(DEPTH + 2).setAlpha(0);
    audio.fanfare();
    s.tweens.add({ targets: box, y, alpha: 1, duration: 320, ease: 'Back.easeOut' });
    s.time.delayedCall(3400, () => s.tweens.add({
      targets: box, alpha: 0, y: y - 20, duration: 420,
      onComplete: () => { box.destroy(); this.bannerBusy = false; this.nextBanner(); },
    }));
  }

  // ---- floating cash ----------------------------------------------------------
  floatCash(delta, x, y) {
    const up = delta > 0;
    const t = this.text(x, y, `${up ? '+' : '-'}$${Math.abs(delta).toFixed(1)}M`, 16, hex(up ? COL.good : COL.bad), { stroke: 3 });
    this.scene.tweens.add({ targets: t, y: y + (up ? 26 : 30), alpha: 0, duration: 1400, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  // ---- depot docking (GDD 2.18) --------------------------------------------------------------
  // A tanker brings propellant to the LEO depot ('deliver'), or a Moon or Mars ship takes it ('refuel').
  // It plays at the LEO pin on the Earth map, and is a toast anywhere else. The rules do not depend on it.
  dock(mode, t, left, delay = 0) {
    const s = this.scene;
    s.time.delayedCall(delay, () => {
      const p = this.pinPos?.('leo');
      const verb = mode === 'deliver' ? `Tanker docked: +${Math.round(t)} t` : `Ship refueled at the depot: -${Math.round(t)} t`;
      if (!p || this.docking) { this.toast(`${verb} (depot ${Math.round(left)} t)`, 'info'); return; }
      this.docking = true;
      audio.dock();
      const wx = p.x + 4;
      const wy = p.y - 16;
      const g = s.add.graphics({ x: wx, y: wy }).setDepth(DEPTH).setScale(1.6); // drawn around (0, 0), then enlarged
      const px = 0;
      const py = 0;
      const label = this.text(wx, wy - 40, '', 14, hex(mode === 'deliver' ? COL.good : COL.warn), { stroke: 3 }).setAlpha(0);
      const state = { u: 0 };
      const ship = (x, y, a, alpha) => {
        g.fillStyle(0xeef3fb, alpha).fillRoundedRect(x - 15, y - 4, 30, 8, 3);
        g.fillStyle(mode === 'deliver' ? COL.warn : 0xb9c4d4, alpha).fillRect(x - 3, y - 4, 6, 8);
        g.fillStyle(0xffb347, alpha * a).fillTriangle(x - 15, y - 3, x - 15, y + 3, x - 15 - 12 * a, y);
      };
      s.tweens.add({
        targets: state, u: 1, duration: 2600, ease: 'Linear',
        onUpdate: () => {
          const u = state.u;
          g.clear();
          // the depot: a violet tank with a ring, always there
          g.fillStyle(COL.violet, 1).fillRoundedRect(px - 14, py - 5, 28, 10, 4);
          g.lineStyle(2, 0xdcc8ff).strokeEllipse(px, py, 10, 16);
          // the visitor
          const dockX = px + 34;
          let x;
          let a = 0;
          if (u < 0.35) { const k = Phaser.Math.Easing.Cubic.Out(u / 0.35); x = dockX + 120 * (1 - k); a = 1 - k; }
          else if (u < 0.78) x = dockX;
          else { const k = Phaser.Math.Easing.Cubic.In((u - 0.78) / 0.22); x = dockX + 130 * k; a = k; }
          ship(x, py, a, u > 0.9 ? 1 - (u - 0.9) * 10 : 1);
          // contact flash, then the propellant dots
          if (u > 0.35 && u < 0.45) g.fillStyle(0xffffff, 1 - (u - 0.35) * 10).fillCircle(px + 17, py, 10);
          if (u > 0.4 && u < 0.72) {
            for (let i = 0; i < 7; i++) {
              const f = (((u - 0.4) * 5 + i / 7) % 1);
              const from = mode === 'deliver' ? dockX - 15 : px + 14;
              const to = mode === 'deliver' ? px + 14 : dockX - 15;
              g.fillStyle(COL.accent, 0.95).fillCircle(from + (to - from) * f, py + Math.sin(f * 9 + i) * 2, 2.4);
            }
          }
          if (u > 0.4) {
            label.setText(`${mode === 'deliver' ? '+' : '-'}${Math.round(t)} t   depot ${Math.round(left)} t`).setAlpha(Math.min(1, (u - 0.4) * 6) * (u > 0.88 ? 1 - (u - 0.88) * 8 : 1)).setY(wy - 40 - (u - 0.4) * 14);
          }
        },
        onComplete: () => { g.destroy(); label.destroy(); this.docking = false; },
      });
    });
  }

  // ---- launch sequence ----------------------------------------------------------
  // Counts down, calls launchFn at zero (which returns the sim result), then plays the outcome.
  launch(origin, launchFn, done) {
    if (this.busy) return;
    this.busy = true;
    const s = this.scene;
    const run = (n) => {
      if (n > 0) {
        audio.beep();
        const t = this.text(this.cx, this.map.y + this.map.h / 2 - 20, String(n), 96, '#ffffff');
        t.setAlpha(0.9).setScale(1.4);
        s.tweens.add({ targets: t, scale: 0.8, alpha: 0, duration: 620, onComplete: () => t.destroy() });
        s.time.delayedCall(650, () => run(n - 1));
        return;
      }
      audio.beep(true);
      const res = launchFn();
      if (!res?.ok) { this.busy = false; done?.(res); return; }
      audio.ignition();
      if (res.failed) this.explosion(origin, () => { this.busy = false; done?.(res); });
      else this.ascent(origin, () => { this.busy = false; audio.success(); done?.(res); });
    };
    run(3);
  }

  ascent(o, after) {
    const s = this.scene;
    const g = s.add.graphics().setDepth(DEPTH);
    const rocket = { x: o.x, y: o.y, t: 0 };
    const dx = 70;
    const dy = -(o.y - this.map.y - 24);
    let last = 0;
    s.tweens.add({
      targets: rocket, t: 1, duration: 1500, ease: 'Quad.easeIn',
      onUpdate: () => {
        const x = o.x + dx * rocket.t;
        const y = o.y + dy * rocket.t;
        const ang = Math.atan2(dy, dx);
        g.clear();
        g.fillStyle(0xffb347, 0.9).fillTriangle(x, y, x - Math.cos(ang) * 22 - Math.sin(ang) * 4, y - Math.sin(ang) * 22 + Math.cos(ang) * 4, x - Math.cos(ang) * 22 + Math.sin(ang) * 4, y - Math.sin(ang) * 22 - Math.cos(ang) * 4);
        g.fillStyle(0xffffff, 1).fillCircle(x, y, 3.5);
        if (s.time.now - last > 45) {
          last = s.time.now;
          const p = s.add.circle(x, y, 3, 0xdfe6f2, 0.55).setDepth(DEPTH - 1);
          s.tweens.add({ targets: p, scale: 4.5, alpha: 0, duration: 900, onComplete: () => p.destroy() });
        }
      },
      onComplete: () => { g.destroy(); after?.(); },
    });
  }

  explosion(o, after) {
    const s = this.scene;
    audio.failure();
    s.cameras.main.shake(520, 0.012);
    const flash = s.add.rectangle(0, 0, W, H, 0xff3b30, 0.4).setOrigin(0).setDepth(DEPTH + 3);
    s.tweens.add({ targets: flash, alpha: 0, duration: 700, onComplete: () => flash.destroy() });
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 30 + Math.random() * 90;
      const p = s.add.circle(o.x, o.y - 20, 2 + Math.random() * 4, Phaser.Math.RND.pick([0xff5d6c, 0xffb347, 0xffe08a, 0xffffff])).setDepth(DEPTH);
      s.tweens.add({ targets: p, x: o.x + Math.cos(a) * d, y: o.y - 20 + Math.sin(a) * d, alpha: 0, scale: 0.2, duration: 700 + Math.random() * 500, ease: 'Cubic.easeOut', onComplete: () => p.destroy() });
    }
    const t = this.text(this.cx, this.map.y + 120, 'ANOMALY', 54, hex(COL.bad));
    t.setAlpha(0);
    s.tweens.add({ targets: t, alpha: 1, scale: { from: 1.5, to: 1 }, duration: 260 });
    s.time.delayedCall(1700, () => s.tweens.add({ targets: t, alpha: 0, duration: 400, onComplete: () => { t.destroy(); after?.(); } }));
  }
}
