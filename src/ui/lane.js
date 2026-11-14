// The transit lane: a ribbon along the top of the map, Earth to the Moon to Mars, with the flights between bodies.
// It only appears once a flight has gone beyond Earth orbit (GDD 2.25).
import { DESTINATIONS, BODIES } from '../data.js';
import * as sim from '../sim.js';
import { COL, FONT } from './ui.js';

export const ROLE_COLOR = { payload: COL.accent, tanker: COL.warn, depot: COL.violet, module: COL.violet, hop: COL.good };
const BODY_COL = { earth: 0x3a78c4, moon: 0xb5b5b5, mars: 0xc4683a };
const BODY_R = { earth: 9, moon: 6, mars: 8 };
const H = 60;

// Persistent drawing so in-transit flights glide between daily ticks.
export class Lane {
  constructor(scene, rect) {
    this.scene = scene;
    this.rect = rect;
    this.g = scene.add.graphics().setDepth(8);
    this.texts = [];
    this.names = Object.keys(BODIES).map((id) => scene.add.text(0, 0, BODIES[id].name, { fontFamily: FONT, fontSize: 11, color: COL.dimText }).setOrigin(0.5, 0).setDepth(8));
  }

  get y() { return this.rect.y + 6 + 36; }
  bodyX(body, p = 1) {
    const { x, w } = this.rect;
    const e = x + 56;
    const m = x + 56 + (w - 112) * 0.34;
    const r = x + w - 56;
    const at = { earth: e, moon: m, mars: r };
    return at.earth + (at[body] - at.earth) * p;
  }

  update(s, dayFrac, visible = true) {
    const g = this.g;
    g.clear();
    const show = visible && s.farFlown;
    this.names.forEach((t) => t.setVisible(show));
    if (!show) { this.texts.forEach((t) => t.setVisible(false)); return; }
    const { x, y: top, w } = this.rect;
    const y = this.y;
    g.fillStyle(COL.panel, 0.55).fillRoundedRect(x + 8, top + 6, w - 16, H, 4);
    g.lineStyle(1, COL.line).strokeRoundedRect(x + 8.5, top + 6.5, w - 17, H, 4);
    g.lineStyle(1, COL.line, 1).lineBetween(this.bodyX('moon', 0), y, this.bodyX('mars'), y);
    ['earth', 'moon', 'mars'].forEach((b, i) => {
      g.fillStyle(BODY_COL[b]).fillCircle(this.bodyX(b), y, BODY_R[b]);
      this.names[i].setPosition(this.bodyX(b), y + 11);
    });

    // History: finished and lost trips to other bodies as faded dashed arcs.
    const far = s.trips.filter((t) => DESTINATIONS[t.dest].body !== 'earth' && t.status !== 'enroute').slice(-8);
    far.forEach((t, i) => {
      const body = DESTINATIONS[t.dest].body;
      const x0 = t.origin === 'moon' ? this.bodyX('moon') : this.bodyX('earth');
      const x1 = this.bodyX(body);
      const h = 8 + (i % 4) * 3;
      g.lineStyle(1, t.status === 'lost' ? COL.bad : ROLE_COLOR[t.role], 0.35);
      let prev = null;
      for (let k = 0; k <= 24; k++) {
        const u = k / 24;
        const pt = { x: x0 + (x1 - x0) * u, y: y - Math.sin(Math.PI * u) * h };
        if (prev && k % 2 === 0) g.lineBetween(prev.x, prev.y, pt.x, pt.y);
        prev = pt;
      }
    });

    // Active trips
    let n = 0;
    sim.activeTrips(s).forEach((t, i) => {
      const d = DESTINATIONS[t.dest];
      const span = Math.max(1, t.arriveDay - t.launchDay);
      const p = Math.min(1, Math.max(0, (s.day + dayFrac - t.launchDay) / span));
      const startX = t.origin === 'moon' ? this.bodyX('moon') : this.bodyX('earth');
      const endX = d.body === 'earth' ? startX : this.bodyX(d.body);
      const px = d.body === 'earth' ? startX + 16 + (i % 4) * 11 : startX + (endX - startX) * p;
      g.fillStyle(ROLE_COLOR[t.role], 1).fillCircle(px, y, 4);
      g.lineStyle(1.5, 0xffffff, 0.9).strokeCircle(px, y, 6.5);
      let txt = this.texts[n++];
      if (!txt) txt = this.texts[n - 1] = this.scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: 10, color: '#ffffff', stroke: '#05070d', strokeThickness: 3 }).setDepth(8);
      txt.setText(t.serial).setPosition(px, y - 22 - (i % 2) * 11).setOrigin(0.5, 0).setVisible(true);
    });
    for (let i = n; i < this.texts.length; i++) this.texts[i].setVisible(false);
  }
}
