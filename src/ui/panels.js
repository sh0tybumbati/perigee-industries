// The Depot and Log tabs (GDD 2.25).
import { DESTINATIONS, DEPOT_CAP, TANKER_LOAD, BOILOFF_PER_DAY } from '../data.js';
import * as sim from '../sim.js';
import { COL, hex } from './ui.js';
import { MAP_BOTTOM } from '../layout.js';
import { ROLE_COLOR } from './lane.js';

const KIND_COL = { bad: COL.bad, warn: COL.warn, good: COL.good, info: null };

export function renderDepot(ui, s, X, Y, W) {
  ui.heading(X, Y, 'LEO PROPELLANT DEPOT');
  const f = s.depot.prop / DEPOT_CAP;
  ui.label(X, Y + 22, `${Math.floor(s.depot.prop)} t`, { size: 30, bold: true, color: hex(f < 0.2 ? COL.warn : COL.accent) });
  ui.label(X + 110, Y + 36, `of ${DEPOT_CAP} t  CH4/LOX`, { size: 13, color: COL.dimText });
  ui.bar(X, Y + 66, W, 26, f, f < 0.2 ? COL.warn : COL.accent);
  const g = ui.scene.add.graphics().lineStyle(1, 0x0b1220, 0.9);
  for (let t = TANKER_LOAD; t < DEPOT_CAP; t += TANKER_LOAD) g.lineBetween(X + (t / DEPOT_CAP) * W, Y + 66, X + (t / DEPOT_CAP) * W, Y + 92);
  ui.container.add(g);
  ui.label(X, Y + 96, 'Each division is one tanker load.', { size: 10, color: COL.dimText });
  const boil = s.depot.prop * BOILOFF_PER_DAY;
  ui.label(X + W, Y + 96, boil >= 0.05 ? `-${boil.toFixed(1)} t/day boil-off` : 'no boil-off', { size: 11, right: true, color: COL.dimText });

  ui.heading(X, Y + 126, 'TANKERS EN ROUTE');
  const tankers = sim.activeTrips(s).filter((t) => t.role === 'tanker');
  if (!tankers.length) ui.label(X, Y + 146, 'None. Fly Orbital Tankers to refill the depot.', { size: 12, color: COL.dimText });
  tankers.slice(0, 5).forEach((t, i) => ui.label(X, Y + 146 + i * 17, `${t.serial}  ·  +${TANKER_LOAD} t in ${t.arriveDay - s.day}d`, { size: 12, color: hex(COL.warn) }));

  const ny = Y + 146 + Math.max(1, Math.min(5, tankers.length)) * 17 + 18;
  ui.heading(X, ny, 'WHAT THE NEXT MISSION NEEDS');
  const d = DESTINATIONS[s.dest];
  const need = d.body === 'earth' ? 0 : s.rocket === 'skyship' ? sim.tliNeed(s) : sim.modulePropNeed(s);
  if (!need) ui.label(X, ny + 20, `${d.name} needs no depot propellant.`, { size: 12, color: COL.dimText });
  else ui.label(X, ny + 20, `${need} t for ${d.name}  ·  ${s.depot.prop >= need ? 'enough on hand' : `short by ${Math.ceil(need - s.depot.prop)} t`}`, { size: 12, color: hex(s.depot.prop >= need ? COL.good : COL.warn) });
  const left = s.depot.prop ? Math.round(Math.log(0.5) / Math.log(1 - BOILOFF_PER_DAY)) : 0;
  if (left) ui.label(X, ny + 40, `Boil-off halves an idle depot in about ${left} days.`, { size: 11, color: COL.dimText, wrap: W });
}

const FILTERS = [['all', 'All'], ['good', 'Good news'], ['bad', 'Problems']];

// The entries after the filter, newest first.
export function logEntries(s, filter) {
  const all = [...s.log].reverse();
  if (filter === 'good') return all.filter((m) => sim.kindOf(m) === 'good');
  if (filter === 'bad') return all.filter((m) => ['bad', 'warn'].includes(sim.kindOf(m)));
  return all;
}

export function renderLog(ui, s, X, Y, W, actions) {
  const active = sim.activeTrips(s);
  ui.heading(X, Y, `FLIGHTS IN TRANSIT  ·  ${active.length}`);
  let y = Y + 20;
  if (!active.length) { ui.label(X, y, 'Nothing in flight.', { size: 12, color: COL.dimText }); y += 18; }
  active.slice(0, 6).forEach((t) => {
    ui.label(X, y, `${t.serial}  to ${DESTINATIONS[t.dest].name}  ·  arrives day ${t.arriveDay} (${t.arriveDay - s.day}d)`, { size: 12, color: hex(ROLE_COLOR[t.role]) });
    y += 17;
  });
  if (active.length > 6) { ui.label(X, y, `+${active.length - 6} more`, { size: 11, color: COL.dimText }); y += 15; }

  y += 10;
  ui.heading(X, y, 'MISSION LOG');
  FILTERS.forEach(([id, name], i) => {
    const on = (actions.logFilter ?? 'all') === id;
    ui.button(X + W - 3 * 82 + i * 82, y - 4, 78, 20, name, () => actions.setLogFilter(id), { size: 10, fill: on ? COL.btnOn : COL.btn, stroke: on ? COL.good : COL.accent });
  });
  y += 24;
  const entries = logEntries(s, actions.logFilter ?? 'all');
  const scroll = Math.min(actions.logScroll ?? 0, Math.max(0, entries.length - 1));
  let shown = 0;
  for (let i = scroll; i < entries.length; i++) {
    const col = KIND_COL[sim.kindOf(entries[i])];
    const t = ui.label(X, y, entries[i], { size: 12, wrap: W - 8, color: col ? hex(col) : i === 0 ? COL.text : COL.dimText });
    if (y + t.height > MAP_BOTTOM - 22 && shown) { t.destroy(); break; }
    y += t.height + 5;
    shown++;
  }
  if (!entries.length) ui.label(X, y, 'Nothing here yet.', { size: 12, color: COL.dimText });
  if (entries.length > shown) {
    ui.label(X, MAP_BOTTOM - 20, `${scroll + 1}-${scroll + shown} of ${entries.length}`, { size: 11, color: COL.dimText });
    ui.button(X + W - 44, MAP_BOTTOM - 24, 20, 18, '▲', () => actions.scrollLog(-1), { size: 9, enabled: scroll > 0, hint: 'Scroll the log (or use the mouse wheel).' });
    ui.button(X + W - 20, MAP_BOTTOM - 24, 20, 18, '▼', () => actions.scrollLog(1), { size: 9, enabled: scroll + shown < entries.length, hint: 'Scroll the log (or use the mouse wheel).' });
  }
}
