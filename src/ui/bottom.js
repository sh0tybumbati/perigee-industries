// Bottom strip: the transit lane between bodies, the flight list, the LEO depot gauge, and the mission log.
import { DESTINATIONS, DEPOT_CAP, TANKER_LOAD, BOILOFF_PER_DAY, BODIES } from '../data.js';
import * as sim from '../sim.js';
import { COL, FONT, hex } from './ui.js';

const ROLE_COLOR = { payload: COL.accent, tanker: COL.warn, depot: COL.violet };
const LANE = { y: 566, earth: 52, moon: 230, mars: 650, x0: 10 };

// Persistent drawing so in-transit flights glide between daily ticks.
export class Lane {
  constructor(scene) {
    this.scene = scene;
    this.g = scene.add.graphics();
    this.texts = [];
    const stat = (x, name, size, color) => {
      this.g.fillStyle(color, 1);
      scene.add.text(LANE.x0 + x, LANE.y + size + 8, name, { fontFamily: FONT, fontSize: 11, color: COL.dimText }).setOrigin(0.5, 0);
    };
    stat(LANE.earth, BODIES.earth.name, 9, 0x3a78c4);
    stat(LANE.moon, BODIES.moon.name, 6, 0xb5b5b5);
    stat(LANE.mars, BODIES.mars.name, 8, 0xc4683a);
  }

  x(body, p = 1) {
    return LANE.x0 + LANE.earth + (LANE[body] - LANE.earth) * p;
  }

  update(s, dayFrac) {
    const g = this.g;
    g.clear();
    g.lineStyle(1, COL.line, 1).lineBetween(this.x('moon', 0), LANE.y, this.x('mars'), LANE.y);
    g.fillStyle(0x3a78c4).fillCircle(this.x('moon', 0), LANE.y, 9);
    g.fillStyle(0xb5b5b5).fillCircle(this.x('moon'), LANE.y, 6);
    g.fillStyle(0xc4683a).fillCircle(LANE.x0 + LANE.mars, LANE.y, 8);

    // History: finished and lost trips to other bodies as faded dashed arcs.
    const far = s.trips.filter((t) => DESTINATIONS[t.dest].body !== 'earth' && t.status !== 'enroute').slice(-8);
    far.forEach((t, i) => {
      const body = DESTINATIONS[t.dest].body;
      const x0 = this.x('moon', 0);
      const x1 = LANE.x0 + LANE[body];
      const h = 14 + (i % 4) * 5;
      g.lineStyle(1, t.status === 'lost' ? COL.bad : ROLE_COLOR[t.role], 0.35);
      let prev = null;
      for (let k = 0; k <= 24; k++) {
        const u = k / 24;
        const pt = { x: x0 + (x1 - x0) * u, y: LANE.y - Math.sin(Math.PI * u) * h };
        if (prev && k % 2 === 0) g.lineBetween(prev.x, prev.y, pt.x, pt.y);
        prev = pt;
      }
    });

    // Active trips
    const active = sim.activeTrips(s);
    let n = 0;
    active.forEach((t, i) => {
      const d = DESTINATIONS[t.dest];
      const span = Math.max(1, t.arriveDay - t.launchDay);
      const p = Math.min(1, Math.max(0, (s.day + dayFrac - t.launchDay) / span));
      const x = d.body === 'earth' ? this.x('moon', 0) + 16 + (i % 4) * 11 : this.x(d.body === 'moon' ? 'moon' : 'mars', 0) + (LANE[d.body] - LANE.earth) * p;
      const y = LANE.y - (d.body === 'earth' ? 0 : 0);
      g.fillStyle(ROLE_COLOR[t.role], 1).fillCircle(x, y, 4);
      g.lineStyle(1.5, 0xffffff, 0.9).strokeCircle(x, y, 6.5);
      let txt = this.texts[n++];
      if (!txt) txt = this.texts[n - 1] = this.scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: 10, color: '#ffffff', stroke: '#05070d', strokeThickness: 3 });
      txt.setText(t.serial).setPosition(x, y - 20 - (i % 2) * 11).setOrigin(0.5, 0).setVisible(true);
    });
    for (let i = n; i < this.texts.length; i++) this.texts[i].setVisible(false);
  }
}

export function renderFlights(ui, s) {
  ui.heading(24, 538, 'TRANSIT LANE  ·  flights between bodies');
  const active = sim.activeTrips(s);
  ui.heading(24, 604, `FLIGHTS IN TRANSIT  ·  ${active.length}`);
  if (!active.length) ui.label(24, 622, 'Nothing in flight.', { size: 12, color: COL.dimText });
  active.slice(0, 5).forEach((t, i) => {
    const d = DESTINATIONS[t.dest];
    const left = t.arriveDay - s.day;
    ui.label(24, 622 + i * 16, `${t.serial}  to ${d.name}  ·  arrives day ${t.arriveDay} (${left}d)`, { size: 12, color: hex(ROLE_COLOR[t.role]) });
  });
  if (active.length > 5) ui.label(680, 622, `+${active.length - 5} more`, { size: 11, color: COL.dimText, right: true });
}

export function renderDepotAndLog(ui, s) {
  const X = 724;
  ui.heading(X, 538, 'LEO PROPELLANT DEPOT');
  if (!s.tech.has('tanker')) {
    ui.label(X, 558, 'Locked. Research Orbital Tanker.', { size: 13, color: COL.dimText });
  } else if (!s.depot.built) {
    const queued = s.queue.some((q) => q.type === 'skyshipDepot') || s.trips.some((t) => t.role === 'depot' && t.status === 'enroute');
    ui.label(X, 558, queued ? 'Depot ship on its way.' : 'Not deployed. Build a Skyship Depot, then launch it.', { size: 13, color: COL.dimText });
  } else {
    const f = s.depot.prop / DEPOT_CAP;
    ui.bar(X, 560, 532, 14, f, f < 0.2 ? COL.warn : COL.accent);
    const g = ui.scene.add.graphics().lineStyle(1, 0x0b1220, 0.9);
    for (let t = TANKER_LOAD; t < DEPOT_CAP; t += TANKER_LOAD) g.lineBetween(X + (t / DEPOT_CAP) * 532, 560, X + (t / DEPOT_CAP) * 532, 574);
    ui.container.add(g);
    ui.label(X, 578, `${Math.floor(s.depot.prop)} / ${DEPOT_CAP} t  CH4/LOX`, { size: 12 });
    const boil = s.depot.prop * BOILOFF_PER_DAY;
    ui.label(X + 532, 578, boil >= 0.05 ? `-${boil.toFixed(1)} t/day boil-off` : 'no boil-off', { size: 12, right: true, color: COL.dimText });
  }
  ui.heading(X, 600, 'MISSION LOG');
  s.log.slice(-5).forEach((m, i, arr) => {
    ui.label(X, 618 + i * 17, m.length > 92 ? `${m.slice(0, 89)}...` : m, { size: 12, color: i === arr.length - 1 ? COL.text : COL.dimText });
  });
}
