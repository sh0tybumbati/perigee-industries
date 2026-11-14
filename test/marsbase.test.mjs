import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/sim.js';
import * as B from '../src/base.js';
import { MARS_WINDOWS, MARS_RETURN_WINDOWS, MARS_RETURN, BASE_PARAMS, STORM_WORK, DRONE_RATE, MODULES } from '../src/data.js';

const ALL = ['landing', 'droneship', 'fastCores', 'plants', 'gen1', 'heavyCores', 'hull', 'raptor', 'tiles', 'skyship', 'tanker', 'habitat', 'isru', 'ice', 'marsTransit'];
const withMock = (v, fn) => { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } };
const win = (fn) => withMock(0.999, fn);
const world = () => {
  const s = sim.createState();
  for (const t of ALL) s.tech.add(t);
  s.cash = 5000;
  s.sites.cape.pads.forEach((p) => { p.tower = true; });
  s.day = MARS_WINDOWS[0][0] + 5;
  s.depot = { built: true, prop: 500 };
  return s;
};
const give = (s, type, site = 'cape') => s.fleet.push({ id: s.nextId++, type, serial: `${type}-${s.nextId}`, flights: 0, returnDay: 0, readyDay: 0, site });
const run = (s, n) => win(() => { for (let i = 0; i < n; i++) sim.tick(s); });
const place = (b, type, x, y, rot = 0) => { b.pending.push({ id: b.nextId++, type }); assert.ok(B.placeModule(b, b.pending.at(-1).id, x, y, rot)); return b.modules.at(-1); };

// A module ship lands and founds the Mars base at Utopia Planitia.
const marsBaseAt = (s, site = 'utopia') => { s.marsBase = B.createBase(site, 'mars'); return s.marsBase; };

test('a module ship founds the Mars base; the Moon and Mars bases are separate', () => {
  const s = world();
  give(s, 'modHab');
  sim.setRocket(s, 'modHab');
  sim.setDest(s, 'utopia');
  assert.equal(sim.launchBlocker(s), null);
  const r = win(() => sim.launch(s));
  assert.ok(r.ok && !r.failed);
  run(s, 181);
  assert.equal(s.marsBase.site, 'utopia');
  assert.equal(s.marsBase.body, 'mars');
  assert.equal(s.marsBase.pending.length, 1);
  assert.equal(s.base, null, 'the Moon has no base');
  assert.ok(s.milestones.marsBase);
});

test('Mars module rules: window, site, ice only at Utopia, depot propellant', () => {
  const s = world();
  give(s, 'modIce');
  sim.setRocket(s, 'modIce');
  sim.setDest(s, 'jezero');
  assert.match(sim.launchBlocker(s), /Ice only exists at Utopia/);
  sim.setDest(s, 'utopia');
  assert.equal(sim.launchBlocker(s), null);
  s.day = MARS_WINDOWS[0][0] - 100;
  assert.match(sim.launchBlocker(s), /Mars window opens in 100 days/);
  s.day = MARS_WINDOWS[0][0] + 5;
  marsBaseAt(s, 'jezero');
  assert.equal(sim.launchBlocker(s), null, 'a second Mars site is allowed');
  s.depot.prop = 100;
  assert.match(sim.launchBlocker(s), /Depot propellant 100\/400/);
});

test('a Mars refinery makes 4 t of methalox from 3 t of ice, and the Mars stockpile is bigger', () => {
  const s = world();
  const b = marsBaseAt(s);
  const rc = [place(b, 'reactor', 2, 2), place(b, 'reactor', 2, 4)];
  const hb = place(b, 'habitat', 2, 6);
  const ic = place(b, 'icer', 2, 8);
  const rf = place(b, 'refinery', 2, 10);
  const parts = [rc[0], rc[1], hb, ic, rf];
  for (let i = 0; i < parts.length - 1; i++) assert.ok(B.connect(b, B.portId(parts[i], 1), B.portId(parts[i + 1], 0)));
  b.stock.ice = 30;
  withMock(0.999, () => B.tickBase(s, null, b));
  assert.ok(Math.abs(b.stock.methalox - 4) < 1e-9);
  b.stock.methalox = BASE_PARAMS.mars.caps.methalox;
  b.stock.ice = 50;
  withMock(0.999, () => B.tickBase(s, null, b));
  assert.equal(b.stock.methalox, BASE_PARAMS.mars.caps.methalox, 'a full tank stops the refinery');
  // jezero has no ice
  const j = B.createBase('jezero', 'mars');
  const p = [place(j, 'reactor', 2, 2), place(j, 'habitat', 2, 4), place(j, 'icer', 2, 6)];
  B.connect(j, B.portId(p[0], 1), B.portId(p[1], 0)); B.connect(j, B.portId(p[1], 1), B.portId(p[2], 0));
  withMock(0.999, () => B.tickBase(s, null, j));
  assert.equal(j.stock.ice, 0);
});

test('a dust storm halves the work of drones but not the reactors', () => {
  const s = world();
  const b = marsBase(s);
  function marsBase(st) {
    const base = marsBaseAt(st, 'jezero');
    const rc = place(base, 'reactor', 2, 2);
    const hb = place(base, 'habitat', 2, 4);
    const dr = place(base, 'drones', 2, 6);
    B.connect(base, B.portId(rc, 1), B.portId(hb, 0)); B.connect(base, B.portId(hb, 1), B.portId(dr, 0));
    return base;
  }
  withMock(0.999, () => B.tickBase(s, null, b));
  const calm = b.stock.regolith;
  assert.ok(calm > 0);
  b.stock.regolith = 0;
  b.storm = { daysLeft: 5 };
  withMock(0.999, () => B.tickBase(s, null, b));
  assert.ok(Math.abs(b.stock.regolith - calm * STORM_WORK) < 1e-9);
  assert.equal(b.storm.daysLeft, 4);
  // a storm can start, and the Moon never has one
  const m = B.createBase('shackleton', 'moon');
  const notes = [];
  withMock(0, () => B.tickBase(s, null, m));
  assert.equal(m.storm, null);
  const b2 = marsBaseAt(world(), 'jezero');
  place(b2, 'habitat', 2, 2);
  withMock(0, () => B.tickBase(s, (msg) => notes.push(msg), b2));
  assert.ok(b2.storm && notes.some((n) => /dust storm/.test(n)));
});

test('a Skyship that lands at the Mars base stays there; elsewhere it is one-way', () => {
  const s = world();
  marsBaseAt(s, 'utopia');
  s.marsBase.modules.push({ id: 1, type: 'habitat', x: 1, y: 1, rot: 0, cover: 0, crew: 6 });
  for (const [dest, stays] of [['utopia', true], ['jezero', false]]) {
    s.fleet = [];
    s.manifest = [];
    s.sites.cape.pads.forEach((p) => { p.busyUntil = 0; });
    give(s, 'skyship');
    sim.setRocket(s, 'skyship');
    sim.setDest(s, dest);
    s.day = MARS_WINDOWS[0][0] + 5;
    s.contracts = [{ id: s.nextId++, customer: 'X', dest, mass: 20, volume: 40, prop: 100, payout: 60, expires: 99999 }];
    sim.toggleContract(s, s.contracts[0].id);
    s.depot.prop = 500;
    assert.equal(sim.launchBlocker(s), null, dest);
    win(() => sim.launch(s));
    assert.equal(sim.fleetOf(s, 'skyship').length, 0, 'in flight');
    run(s, 181);
    const hulls = s.fleet.filter((v) => v.site === 'mars');
    assert.equal(hulls.length, stays ? 1 : 0, dest);
  }
});

test('return flights: window, base methalox, a Mars-based hull, and the hull comes home to Cape', () => {
  const s = world();
  const b = marsBaseAt(s, 'utopia');
  b.modules.push({ id: 1, type: 'habitat', x: 1, y: 1, rot: 0, cover: 0, crew: 6 });
  s.fleet = [{ id: 900, type: 'skyship', serial: 'SKY-09', flights: 2, returnDay: 0, readyDay: 0, site: 'mars' }];
  const ret = { id: 901, customer: 'Orion Media', region: 'na', dest: 'leo', origin: 'mars', mass: 30, volume: 60, payout: 150, expires: 99999 };
  s.contracts = [ret];
  sim.setRocket(s, 'skyship');
  assert.ok(sim.toggleContract(s, 901), 'loading a return contract switches to a flight from Mars');
  assert.equal(s.origin, 'mars');
  assert.equal(sim.flightOrigin(s), 'mars');
  s.day = MARS_RETURN_WINDOWS[0][0] - 20;
  assert.match(sim.launchBlocker(s), /Return window opens in 20 days/);
  s.day = MARS_RETURN_WINDOWS[0][0] + 2;
  b.stock.methalox = 100;
  const need = MARS_RETURN.hullFuel + MARS_RETURN.fuelPerTon * 30;
  assert.match(sim.launchBlocker(s), new RegExp(`Mars base methalox 100/${need}`));
  b.stock.methalox = 1000;
  assert.equal(sim.launchBlocker(s), null);
  const cash = s.cash;
  const r = win(() => sim.launch(s));
  assert.ok(r.ok && !r.failed);
  assert.equal(r.trip.origin, 'mars');
  assert.equal(b.stock.methalox, 1000 - need);
  assert.equal(s.depot.prop, 500, 'no Earth depot propellant used');
  assert.equal(s.fleet.length, 0);
  run(s, MARS_RETURN.days + 1);
  assert.equal(s.cash > cash, true, 'the contract paid on arrival');
  const home = s.fleet.find((v) => v.serial === 'SKY-09');
  assert.equal(home.site, 'cape');
  assert.equal(home.flights, 3);
  assert.ok(s.milestones.marsReturn);
});

test('return contracts only ride return flights, and Earth contracts switch back', () => {
  const s = world();
  const ret = { id: 901, customer: 'X', region: 'na', dest: 'leo', origin: 'mars', mass: 5, volume: 5, payout: 10, expires: 9999 };
  const earth = { id: 902, customer: 'X', region: 'na', dest: 'leo', mass: 5, volume: 5, payout: 5, expires: 9999 };
  s.contracts = [ret, earth];
  assert.equal(sim.toggleContract(s, 901), false, 'no Mars-based hull yet');
  s.fleet.push({ id: 900, type: 'skyship', serial: 'SKY-09', flights: 0, returnDay: 0, readyDay: 0, site: 'mars' });
  assert.equal(sim.toggleContract(s, 901), true);
  assert.equal(sim.toggleContract(s, 902), false, 'one origin per flight');
  sim.toggleContract(s, 901);
  assert.equal(sim.toggleContract(s, 902), true);
  assert.equal(s.origin, 'earth');
});

test('the Mars-to-Earth windows come 60 days before the outbound windows', () => {
  assert.equal(MARS_RETURN_WINDOWS[0][0], MARS_WINDOWS[0][0] - 60);
  const day = MARS_RETURN_WINDOWS[2][0] + 3;
  assert.equal(sim.marsReturnWindow(day).open, true);
  assert.equal(sim.marsReturnWindow(MARS_RETURN_WINDOWS[2][1] + 1).open, false);
});

test('the Mars base survives a save and load, and v6 saves load without one', () => {
  const s = world();
  marsBaseAt(s, 'utopia');
  s.marsBase.stock.methalox = 321;
  const back = sim.deserialize(sim.serialize(s));
  assert.equal(back.marsBase.site, 'utopia');
  assert.equal(back.marsBase.body, 'mars');
  assert.equal(back.marsBase.stock.methalox, 321);
  const o = JSON.parse(sim.serialize(sim.createState()));
  o.v = 6; delete o.marsBase; delete o.origin;
  const old = sim.deserialize(JSON.stringify(o));
  assert.equal(old.marsBase, null);
  assert.equal(old.origin, 'earth');
});

test('Mars bases get return contracts, and a Mars Fabricator builds Mars-based Skyships', () => {
  const s = world();
  const b = marsBaseAt(s);
  b.modules.push({ id: 1, type: 'habitat', x: 1, y: 1, rot: 0, cover: 0, crew: 6 });
  s.contracts = [];
  withMock(0.01, () => { for (let i = 0; i < 12; i++) sim.tick(s); });
  assert.ok(s.contracts.some((c) => c.origin === 'mars' && c.dest === 'leo'));
  b.ships.push({ id: 5, type: 'skyship' });
  sim.tick(s);
  assert.equal(s.fleet.filter((v) => v.site === 'mars' && v.type === 'skyship').length, 1);
});

test('every successful Mars landing lowers the direct and Moon-route risks, down to a floor', () => {
  const s = sim.createState();
  assert.deepEqual(sim.marsRisks(s), { ascent: 0.12, land: 0.15, moonLand: 0.06 });
  s.marsLandings = 3;
  const r = sim.marsRisks(s);
  assert.ok(Math.abs(r.ascent - 0.075) < 1e-9 && Math.abs(r.land - 0.09) < 1e-9 && Math.abs(r.moonLand - 0.03) < 1e-9);
  s.marsLandings = 99;
  assert.deepEqual(sim.marsRisks(s), { ascent: 0.03, land: 0.05, moonLand: 0.03 });
});

test('a Mars arrival counts as a landing, a return does not', () => {
  const s = world();
  give(s, 'modHab');
  sim.setRocket(s, 'modHab');
  sim.setDest(s, 'utopia');
  win(() => sim.launch(s));
  assert.equal(s.trips.at(-1).landRisk, 0.15);
  run(s, 181);
  assert.equal(s.marsLandings, 1);
});
