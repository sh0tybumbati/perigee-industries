// Small immediate-mode style helpers. Everything is added to one container that the scene empties and rebuilds
// whenever the game state changes, so panels are plain functions of the state.

export const COL = {
  bg: 0x05070d, panel: 0x0b1220, line: 0x22304d, accent: 0x4fd1ff, good: 0x5be584,
  warn: 0xffb84d, bad: 0xff5d6c, violet: 0xb68cff, dim: 0x6b7a99, text: '#d7e2f5', dimText: '#7d8cab',
  row: 0x101a2e, rowOn: 0x14385a, btn: 0x12304a, btnOn: 0x1d6a4a, btnHover: 0x1d4a70,
};
import * as audio from '../audio.js';
import { PHONE } from '../layout.js';

const fs = (size) => Math.max(size ?? 14, PHONE ? 11 : 0); // phones get no text under 11 px

export const hex = (n) => '#' + n.toString(16).padStart(6, '0');
export const FONT = 'system-ui, sans-serif';

export class UI {
  constructor(scene, container, act, setHint) {
    this.scene = scene;
    this.container = container;
    this.act = act; // runs a state change, then re-renders
    this.setHint = setHint;
  }

  label(x, y, str, o = {}) {
    const t = this.scene.add.text(x, y, str, {
      fontFamily: FONT, fontSize: fs(o.size), color: o.color ?? COL.text, fontStyle: o.bold ? 'bold' : 'normal',
      wordWrap: o.wrap ? { width: o.wrap } : undefined,
    });
    if (o.right) t.setOrigin(1, 0);
    if (o.center) t.setOrigin(0.5, 0);
    this.container.add(t);
    return t;
  }

  heading(x, y, str) {
    return this.label(x, y, str, { size: 12, color: hex(COL.accent), bold: true });
  }

  hover(obj, text) {
    obj.setInteractive();
    obj.on('pointerover', () => this.setHint(text));
    obj.on('pointerout', () => this.setHint(''));
  }

  // A press: ignored during a two-finger gesture, and in Tips mode it shows the hint instead of acting.
  tap(cb, hint) {
    if (this.scene.gestureActive?.()) return;
    if (this.scene.helpMode && hint) { this.setHint(hint); return; }
    audio.unlock();
    audio.click();
    this.act(cb);
  }

  button(x, y, w, h, label, cb, o = {}) {
    const enabled = o.enabled !== false;
    const base = o.fill ?? COL.btn;
    const r = this.scene.add.rectangle(x, y, w, h, enabled ? base : 0x141b2b).setOrigin(0)
      .setStrokeStyle(1, enabled ? (o.stroke ?? COL.accent) : 0x2a3550);
    const t = this.scene.add.text(x + w / 2, y + h / 2, label, {
      fontFamily: FONT, fontSize: fs(o.size), fontStyle: 'bold', color: enabled ? '#eaf6ff' : '#566380',
    }).setOrigin(0.5);
    if (enabled) {
      r.setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.tap(cb, o.hint))
        .on('pointerover', () => r.setFillStyle(COL.btnHover))
        .on('pointerout', () => r.setFillStyle(base));
    }
    if (o.hint) this.hover(r, o.hint);
    if (!enabled && o.hint) r.on('pointerup', () => { if (this.scene.helpMode) this.setHint(o.hint); });
    this.container.add([r, t]);
    return r;
  }

  // A selectable list row. Returns the rectangle.
  row(x, y, w, h, o = {}) {
    const r = this.scene.add.rectangle(x, y, w, h, o.on ? COL.rowOn : (o.fill ?? COL.row)).setOrigin(0)
      .setStrokeStyle(1, o.stroke ?? (o.on ? COL.accent : COL.line));
    if (o.onClick) r.setInteractive({ useHandCursor: true }).on('pointerup', () => this.tap(o.onClick, o.hint));
    else if (o.hint) r.on('pointerup', () => { if (this.scene.helpMode) this.setHint(o.hint); });
    if (o.hint) this.hover(r, o.hint);
    this.container.add(r);
    return r;
  }

  bar(x, y, w, h, frac, color) {
    const g = this.scene.add.graphics();
    g.fillStyle(0x16203a).fillRect(x, y, w, h);
    g.fillStyle(color).fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
    g.lineStyle(1, COL.line).strokeRect(x + 0.5, y + 0.5, w, h);
    this.container.add(g);
  }
}
