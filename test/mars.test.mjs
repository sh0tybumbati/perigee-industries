import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/sim.js';
import * as B from '../src/base.js';
import { MARS_WINDOWS, MARS_ROUTES, MARS_DESTS, BASE_CAPS, REFINERY_ICE, REFINERY_OUT, ICE_RATE } from '../src/data.js';

const ALL = ['landing', 'droneship', 'fastCores', 'plants', 'gen1', 'heavyCores', 'hull', 'raptor', 'tiles', 'skyship', 'tanker', 'habitat', 'isru', 'ice', 'marsTransit'];
const world = () => {
  const s = sim.createState();
  for (const t of ALL) s.tech.add(t);
  s.cash = 5000;
  s.sites.cape.pads.forEach((p) => { p.tower = true; });
  s.day = MARS_WINDOWS[0][0] + 5; // inside the first Mars window
  return s;
};
const withMock = (v, fn) => { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } };
const win = (fn) => withMock(0.999, fn);
const give = (s, type, site = 'cape') => s.fleet.push({ id: s.nextId++, type, serial: `${type}-${s.nextId}`, flights: 0, returnDay: 0, readyDay: 0, site });
const marsLoad = (s, mass = 50) => {
  const c = { id: s.nextId++, customer: 'X', dest: 'jezero', mass, volume: 100, prop: Math.ceil(mass * 5), payout: 160, expires: 9999 };
  s.contracts.push(c);
  sim.setRocket(s, 'skyship');
  assert.ok(sim.toggleContract(s, c.id));
  return c;
};
const place = (b, type, x, y, rot = 0) => { b.pending.push({ id: b.nextId++, type }); assert.ok(B.placeModule(b, b.pending.at(-1).id, x, y, rot)); return b.modules.at(-1); };
// reactor, habitat, fabricator, ice miners and refineries on one network
const industrialBase = (site) => {
  const b = B.createBase(site);
  const rc = [place(b, 'reactor', 2, 2), place(b, 'reactor', 2, 4)];
  const hb = place(b, 'habitat', 2, 6);
  const parts = [rc[0], rc[1], hb, place(b, 'icer', 2, 8), place(b, 'refinery', 2, 10), place(b, 'fab', 2, 12)];
  for (let i = 0; i < parts.length - 1; i++) assert.ok(B.connect(b, B.portId(parts[i], 1), B.portId(parts[i + 1], 0)));
  return { b, hb };
};

test('Mars windows follow the real calendar', () => {
  const day = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2010, 0, 1)) / 86400000) + 1;
  assert.equal(sim.dateOf(1).text, '1 Jan 2010');
  assert.equal(sim.dateOf(day(2011, 11, 25)).text, '25 Nov 2011');
  const first = sim.marsWindow(day(2011, 1, 1));
  assert.equal(first.open, false);
  assert.equal(first.opens, day(2011, 11, 25));
  assert.equal(sim.marsWindow(day(2011, 11, 25)).open, true, 'MSL window opens');
  assert.equal(sim.marsWindow(day(2011, 12, 18)).closesIn, 1, 'and closes on the 18th');
  assert.equal(sim.marsWindow(day(2011, 12, 19)).open, false);
  assert.equal(sim.marsWindow(day(2020, 7, 31)).open, true, 'Perseverance');
  assert.equal(sim.marsWindow(day(2020, 10, 1)).open, false);
  const gap = MARS_WINDOWS[6][0] - MARS_WINDOWS[5][0];
  assert.ok(Math.abs(gap - 779.94) < 1, 'predicted windows follow the synodic period');
});

test('Mars contracts only appear once the tech is known', () => {
  const board = (tech) => {
    const s = sim.createState();
    if (tech) s.tech.add('marsTransit');
    s.contracts = [];
    withMock(0.05, () => { for (let i = 0; i < 12; i++) sim.tick(s); });
    return s.contracts;
  };
  assert.ok(!board(false).some((c) => MARS_DESTS.includes(c.dest)));
  const mars = board(true).filter((c) => MARS_DESTS.includes(c.dest));
  assert.ok(mars.length > 0);
  assert.ok(mars[0].mass >= 30 && mars[0].payout > mars[0].mass * 2.5);
  assert.equal(mars[0].expires - 3, mars.length ? mars[0].expires - 3 : 0);
});

test('a direct Mars flight needs a Skyship, an open window, a depot and propellant', () => {
  const s = world();
  give(s, 'skyship');
  marsLoad(s);
  assert.match(sim.launchBlocker(s), /LEO depot/);
  s.depot = { built: true, prop: 100 };
  assert.match(sim.launchBlocker(s), /propellant 100\/250/);
  s.depot.prop = 300;
  assert.equal(sim.launchBlocker(s), null);
  s.day = MARS_WINDOWS[0][0] - 220;
  s.contracts.forEach((c) => { c.acceptedDay = 0; }); // the clock was wound back for this check
  assert.match(sim.launchBlocker(s), /window opens in 220 days/);
  s.day = MARS_WINDOWS[0][0] + 5;
  sim.setRocket(s, 'peregrine9');
  give(s, 'peregrine9');
  assert.ok(sim.launchBlocker(s));
});

test('a direct flight burns depot propellant, consumes the hull, and takes 180 days with a landing risk', () => {
  const s = world();
  give(s, 'skyship');
  marsLoad(s);
  s.depot = { built: true, prop: 300 };
  win(() => sim.launch(s));
  assert.equal(Math.round(s.depot.prop), 50);
  assert.equal(sim.fleetOf(s, 'skyship').length, 0, 'one way: the hull stays at Mars');
  const trip = s.trips.at(-1);
  assert.equal(trip.arriveDay - trip.launchDay, MARS_ROUTES.direct.days);
  assert.equal(trip.landRisk, MARS_ROUTES.direct.landRisk);
  assert.equal(trip.origin, 'earth');
});

test('direct flights carry extra ascent risk that the Moon route does not', () => {
  const s = world();
  give(s, 'skyship');
  marsLoad(s);
  const direct = sim.failChance(s);
  sim.setRocket(s, 'skyship');
  const earth = (() => { const t = world(); give(t, 'skyship'); sim.setRocket(t, 'skyship'); return sim.failChance(t); })();
  assert.ok(Math.abs(direct - earth - MARS_ROUTES.direct.ascentRisk) < 1e-9);
  s.marsRoute = 'moon';
  assert.ok(Math.abs(sim.failChance(s, { flights: 0 }) - earth) < 1e-9);
});

test('arrival can fail: nothing is paid, and a safe arrival pays the contract', () => {
  const run = (roll) => {
    const s = world();
    give(s, 'skyship');
    marsLoad(s);
    s.depot = { built: true, prop: 300 };
    win(() => sim.launch(s));
    const cash = s.cash;
    s.day += 179;
    withMock(roll, () => sim.tick(s));
    return { s, gained: s.cash - cash };
  };
  const lost = run(0.01);
  assert.equal(lost.s.trips.at(-1).status, 'lost');
  assert.ok(lost.gained < 5);
  assert.match(lost.s.log.at(-1), /Martian atmosphere/);
  const ok = run(0.9);
  assert.equal(ok.s.trips.at(-1).status, 'done');
  assert.ok(ok.gained > 150);
});

test('the Moon route needs a Moon-built Skyship and base methalox, and ignores the Earth pad', () => {
  const s = world();
  give(s, 'skyship'); // an Earth hull
  marsLoad(s);
  s.marsRoute = 'moon';
  assert.equal(sim.originIsMoon(s), true);
  assert.match(sim.launchBlocker(s), /Moon-built Skyship/, 'Earth hulls cannot fly from the Moon');
  give(s, 'skyship', 'moon');
  s.base = B.createBase('shackleton');
  assert.match(sim.launchBlocker(s), /Base methalox 0\/650/);
  s.base.stock.methalox = 700;
  assert.equal(sim.launchBlocker(s), null);
  const pads = JSON.stringify(s.sites.cape.pads);
  const cash = s.cash;
  win(() => sim.launch(s));
  assert.equal(Math.round(s.base.stock.methalox), 50, '450 t for the hull plus 4 t per tonne');
  assert.equal(JSON.stringify(s.sites.cape.pads), pads, 'no Earth pad used');
  assert.ok(cash - s.cash < 4, 'only operations cost cash');
  const trip = s.trips.at(-1);
  assert.equal(trip.origin, 'moon');
  assert.equal(trip.arriveDay - trip.launchDay, MARS_ROUTES.moon.days);
  assert.equal(trip.landRisk, MARS_ROUTES.moon.landRisk);
  assert.equal(sim.fleetOf(s, 'skyship').filter((v) => v.site === 'moon').length, 0, 'the Moon hull is spent');
  s.marsRoute = 'direct';
  assert.equal(sim.originIsMoon(s), false);
});

test('Earth hulls cannot fly a direct flight if only a Moon hull exists', () => {
  const s = world();
  give(s, 'skyship', 'moon');
  marsLoad(s);
  s.depot = { built: true, prop: 300 };
  assert.match(sim.launchBlocker(s), /No Skyship in the fleet/);
});

test('the Fabricator builds a Skyship hull on the Moon from local materials', () => {
  const s = world();
  const { b } = industrialBase('shackleton');
  s.base = b;
  b.stock = { regolith: 0, oxygen: 100, iron: 500, silica: 300, ice: 0, methalox: 0 };
  assert.equal(B.recipeBlocker(s, 'skyship'), null);
  const cash = s.cash;
  assert.ok(B.queueLocalBuild(s, 'skyship'));
  assert.equal(b.stock.iron, 200);
  assert.equal(s.cash, cash - 35);
  withMock(0.9, () => { for (let i = 0; i < 32; i++) sim.tick(s); });
  const hull = sim.fleetOf(s, 'skyship')[0];
  assert.equal(hull.site, 'moon');
  assert.equal(b.ships.length, 0);
  assert.equal(b.pending.length, 0, 'a hull is not a module');
  assert.match(s.log.join('\n'), /built at the Moon base/);
});

test('ice miners only work at Shackleton and refineries turn ice into methalox', () => {
  const run = (site) => {
    const s = world();
    const { b } = industrialBase(site);
    s.base = b;
    b.policy = 'mine';
    withMock(0.9, () => { for (let i = 0; i < 20; i++) B.tickBase(s); });
    return b.stock;
  };
  assert.ok(run('shackleton').ice + run('shackleton').methalox > 5);
  assert.ok(run('shackleton').methalox > 5);
  assert.equal(run('tranq').ice, 0);
  assert.equal(run('tranq').methalox, 0);
});

test('the refinery trades 3 t of ice for 2 t of methalox and respects the tank cap', () => {
  const s = world();
  const b = (s.base = B.createBase('shackleton'));
  const rc = place(b, 'reactor', 2, 2);
  const rf = place(b, 'refinery', 2, 4);
  const hb = place(b, 'habitat', 2, 6);
  assert.ok(B.connect(b, B.portId(rc, 0), B.portId(rf, 0)));
  assert.ok(B.connect(b, B.portId(rf, 1), B.portId(hb, 0)));
  b.stock.ice = 30;
  withMock(0.9, () => B.tickBase(s));
  assert.ok(Math.abs(b.stock.ice - (30 - REFINERY_ICE)) < 1e-9);
  assert.ok(Math.abs(b.stock.methalox - REFINERY_OUT) < 1e-9);
  b.stock.methalox = BASE_CAPS.methalox;
  b.stock.ice = 30;
  withMock(0.9, () => B.tickBase(s));
  assert.equal(b.stock.ice, 30, 'a full methalox tank stops the refinery');
});

test('Ice Miner ships can only be sent to Shackleton, and need the Lunar Ice Mining tech', () => {
  const s = world();
  s.tech.delete('ice');
  assert.equal(sim.buildBlocker(s, 'modIce'), 'Locked');
  s.tech.add('ice');
  assert.equal(sim.buildBlocker(s, 'modIce'), null);
  give(s, 'modIce');
  s.depot = { built: true, prop: 500 };
  sim.setRocket(s, 'modIce');
  sim.setDest(s, 'tranq');
  assert.match(sim.launchBlocker(s), /Shackleton/);
  sim.setDest(s, 'shackleton');
  assert.equal(sim.launchBlocker(s), null);
});

test('Mars needs the Lunar Ice Mining tech; the Mars sites unlock with it', () => {
  const s = sim.createState();
  assert.equal(sim.setDest(s, 'jezero'), false);
  for (const t of ['isru', 'ice', 'habitat']) s.tech.add(t);
  assert.equal(sim.techState(s, 'marsTransit'), 'available');
  s.tech.add('marsTransit');
  assert.equal(sim.setDest(s, 'jezero'), true);
});

test('older v5 saves load: the base gains ice, methalox and a ship list', () => {
  const s = world();
  s.base = B.createBase('shackleton');
  delete s.base.ships;
  s.base.stock = { regolith: 1, oxygen: 2, iron: 3, silica: 4 };
  const back = sim.deserialize(sim.serialize(s));
  assert.deepEqual(back.base.ships, []);
  assert.equal(back.base.stock.ice, 0);
  assert.equal(back.base.stock.methalox, 0);
  assert.equal(back.marsRoute, 'direct');
});
