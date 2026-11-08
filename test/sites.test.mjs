import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/sim.js';
const reuse = (s) => { s.tech.add('landing'); s.tech.add('droneship'); s.recovery = 'rtls'; return s; };
import { SITES, PLANT_RATE, MARKET_MIN, MARKET_MAX, BULK_DISCOUNT, RUSH_PREMIUM, RTLS_PAYLOAD_PENALTY, EXPEND_BONUS, DRONE_TOW_DAYS, DRONESHIP_CYCLE, PLANT_COST_FRAC, COMMODITIES, ROCKETS } from '../src/data.js';

const ALL = ['fastCores', 'plants', 'gen1', 'heavyCores', 'hull', 'raptor', 'tiles', 'skyship', 'tanker'];
const rich = (...tech) => { const s = reuse(sim.createState()); for (const t of tech) s.tech.add(t); s.cash = 2000; return s; };
const cape = (s) => s.sites.cape;
const withMock = (v, fn) => { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } };
const win = (fn) => withMock(0.999, fn);
const idle = (s, n) => { for (let i = 0; i < n; i++) sim.tick(s); };
const load = (s) => { const c = { id: s.nextId++, customer: 'X', dest: 'leo', mass: 5, volume: 10, payout: 6, expires: 9999 }; s.contracts.push(c); s.manifest = [c.id]; return c; };
const give = (s, type, n = 1) => { for (let i = 0; i < n; i++) s.fleet.push({ id: s.nextId++, type, serial: `${type}-${s.nextId}`, flights: 0, returnDay: 0, readyDay: 0, site: 'cape' }); };
const names = (s) => sim.launchCosts(s).items.map((i) => i.label);

test('a leased site charges pad and hangar fees, an owned site does not', () => {
  const s = rich();
  load(s);
  assert.ok(names(s).includes('Pad lease'));
  assert.ok(names(s).includes('Hangar rental'));
  assert.equal(sim.acquireSite(s, 'cape', 'buy'), true);
  assert.equal(cape(s).status, 'owned');
  assert.ok(!names(s).includes('Pad lease'));
  assert.ok(!names(s).includes('Hangar rental'), 'the rented bay became owned');
});

test('only owned sites can grow: pads, towers, hangars, lines', () => {
  const s = rich();
  assert.equal(sim.buyPad(s, 'cape'), false);
  assert.equal(sim.buildTower(s, 'cape', 0), false);
  assert.equal(sim.buyLine(s, 'cape'), false);
  assert.equal(sim.bayBlocker(s, 'cape'), null, 'a second hangar can be rented');
  assert.ok(sim.addBay(s, 'cape'));
  assert.equal(cape(s).bays[1].tenure, 'rented');
  assert.match(sim.bayBlocker(s, 'cape'), /Buy the site/);
  sim.acquireSite(s, 'cape', 'buy');
  assert.ok(sim.buyPad(s, 'cape'));
  assert.ok(sim.buildTower(s, 'cape', 0));
  assert.ok(sim.addBay(s, 'cape'));
  assert.equal(cape(s).bays.length, 3);
  assert.match(sim.bayBlocker(s, 'cape'), /All hangars/);
});

test('sites restrict destinations: polar needs Vandenberg, which is locked until leased', () => {
  const s = rich();
  load(s);
  sim.setDest(s, 'polar');
  s.contracts = []; s.manifest = []; s.sats = 0;
  const c = { id: s.nextId++, customer: 'X', dest: 'polar', mass: 5, volume: 10, payout: 6, expires: 999 };
  s.contracts.push(c); s.manifest = [c.id];
  assert.match(sim.launchBlocker(s), /cannot launch to Polar/);
  assert.equal(sim.setSite(s, 'vandenberg'), false, 'locked');
  assert.ok(sim.acquireSite(s, 'vandenberg', 'lease'));
  assert.equal(sim.setSite(s, 'vandenberg'), true);
  assert.equal(sim.launchBlocker(s), null);
  sim.setDest(s, 'gto');
  s.manifest = [];
  const g = { id: s.nextId++, customer: 'X', dest: 'gto', mass: 5, volume: 10, payout: 6, expires: 999 };
  s.contracts.push(g); s.manifest = [g.id];
  assert.match(sim.launchBlocker(s), /cannot launch to GTO/, 'Vandenberg is LEO family only');
});

test('catch vehicles need a pad with a tower; Boca Chica comes with towers', () => {
  const s = rich(...ALL);
  give(s, 'skyship');
  sim.setRocket(s, 'skyship');
  load(s);
  assert.match(sim.launchBlocker(s), /catch tower/);
  sim.acquireSite(s, 'cape', 'buy');
  assert.ok(sim.buildTower(s, 'cape', 0));
  assert.equal(sim.launchBlocker(s), null);
  const t = rich(...ALL);
  give(t, 'skyship');
  sim.setRocket(t, 'skyship');
  load(t);
  assert.ok(sim.acquireSite(t, 'boca', 'buy'));
  assert.equal(t.sites.boca.pads[0].tower, true);
  sim.setSite(t, 'boca');
  assert.equal(sim.launchBlocker(t), null);
});

test('a single hangar serializes refits; a second hangar lets two hulls refit together', () => {
  const run = (bays) => {
    const s = rich();
    give(s, 'peregrine9');
    cape(s).pads.push({ name: 'x', tower: false, busyUntil: 0 });
    for (let i = 1; i < bays; i++) cape(s).bays.push({ tenure: 'rented', freeAt: 0 });
    for (let i = 0; i < 2; i++) { s.contracts = []; load(s); win(() => sim.launch(s)); }
    return s.fleet.map((v) => v.readyDay).sort((a, b) => a - b);
  };
  const one = run(1);
  const two = run(2);
  assert.equal(two[0], two[1], 'parallel refits end together');
  assert.ok(one[1] >= one[0] + 3, `queued behind the first: ${one}`);
});

test('recovery modes: RTLS costs payload, expending adds it and loses the booster', () => {
  const s = rich();
  s.recovery = 'rtls';
  const rtls = sim.capacity(s).mass;
  s.recovery = 'drone';
  const drone = sim.capacity(s).mass;
  s.recovery = 'expend';
  const expend = sim.capacity(s).mass;
  assert.equal(drone, 22);
  assert.equal(rtls, +(22 * (1 - RTLS_PAYLOAD_PENALTY)).toFixed(1));
  assert.equal(expend, +(22 * (1 + EXPEND_BONUS)).toFixed(1));
  load(s);
  win(() => sim.launch(s));
  assert.equal(sim.fleetOf(s, 'peregrine9').length, 0, 'the hull is gone');
  assert.ok(!names(s).includes('Refurbishment parts'));
});

test('droneship landings need a free droneship and delay the refit', () => {
  const ready = (rec) => {
    const s = rich();
    s.recovery = rec;
    load(s);
    win(() => sim.launch(s));
    return sim.fleetOf(s, 'peregrine9')[0].readyDay - s.day;
  };
  assert.equal(ready('drone'), ready('rtls') + DRONE_TOW_DAYS);

  const s = rich();
  give(s, 'peregrine9');
  cape(s).pads.push({ name: 'x', tower: false, busyUntil: 0 });
  cape(s).bays.push({ tenure: 'rented', freeAt: 0 });
  s.recovery = 'drone';
  load(s);
  win(() => sim.launch(s));
  assert.equal(s.droneships[0].busyUntil - s.day, DRONESHIP_CYCLE);
  load(s);
  assert.match(sim.launchBlocker(s), /No droneship free/);
  assert.ok(sim.buyDroneship(s));
  assert.equal(sim.launchBlocker(s), null);
});

test('upper stages are expended on Peregrine launches only', () => {
  const s = rich(...ALL);
  load(s);
  assert.ok(names(s).includes('Expended upper stage'));
  sim.setRocket(s, 'skyship');
  assert.ok(!names(s).includes('Expended upper stage'));
});

test('launches burn propellant from the tanks; shortages are bought at spot plus the rush premium', () => {
  const s = rich();
  load(s);
  const start = cape(s).stock.kerolox;
  const costs = sim.launchCosts(s);
  assert.equal(costs.fuel.short, 0);
  win(() => sim.launch(s));
  assert.equal(cape(s).stock.kerolox, start - 50);

  const t = rich();
  load(t);
  cape(t).stock.kerolox = 20;
  const c = sim.launchCosts(t);
  const bought = c.items.find((i) => i.label.startsWith('Propellant bought'));
  assert.equal(c.fuel.short, 30);
  assert.equal(bought.amt, +(30 * sim.spot(t, 'kerolox') * RUSH_PREMIUM).toFixed(2));
  win(() => sim.launch(t));
  assert.equal(cape(t).stock.kerolox, 0);
});

test('bulk purchases get the discount and stop at tank capacity', () => {
  const s = rich();
  cape(s).stock.methalox = 380;
  const cash = s.cash;
  const got = sim.buyCommodity(s, 'cape', 'methalox', 100);
  assert.equal(got, 20, 'only 20 t of room');
  assert.ok(Math.abs(cash - s.cash - 20 * sim.spot(s, 'methalox') * BULK_DISCOUNT) < 1e-9);
  assert.match(sim.buyBlocker(s, 'cape', 'methalox'), /full/);
});

test('spot prices drift but stay inside their band', () => {
  const s = rich();
  let min = 9;
  let max = 0;
  for (let i = 0; i < 800; i++) { sim.tick(s); for (const m of Object.values(s.market)) { min = Math.min(min, m); max = Math.max(max, m); } }
  assert.ok(min >= MARKET_MIN && max <= MARKET_MAX, `${min} ${max}`);
  assert.ok(max - min > 0.05, 'prices actually move');
});

test('plants need the tech and an owned site, then fill the tanks cheaply', () => {
  const s = rich();
  assert.match(sim.plantBlocker(s, 'cape', 'methalox'), /Research/);
  s.tech.add('plants');
  assert.match(sim.plantBlocker(s, 'cape', 'methalox'), /Own the site/);
  sim.acquireSite(s, 'cape', 'buy');
  assert.ok(sim.buildPlant(s, 'cape', 'methalox'));
  cape(s).stock.methalox = 0;
  const cash = s.cash;
  withMock(0.5, () => sim.tick(s));
  assert.equal(cape(s).stock.methalox, PLANT_RATE);
  const cost = PLANT_RATE * COMMODITIES.methalox.price * PLANT_COST_FRAC;
  assert.ok(s.cash <= cash - cost + 0.2, 'production cost is paid');
});

test('tank expansion needs ownership and raises capacity', () => {
  const s = rich();
  assert.match(sim.tankBlocker(s, 'cape', 'steel'), /Own the site/);
  sim.acquireSite(s, 'cape', 'buy');
  const before = cape(s).cap.steel;
  assert.ok(sim.expandTank(s, 'cape', 'steel'));
  assert.ok(cape(s).cap.steel > before);
});

test('hulls use steel from the factory site; shortages are bought at spot plus the rush premium', () => {
  const s = rich(...ALL);
  cape(s).stock.steel = 100;
  const cash = s.cash;
  assert.ok(sim.queueBuild(s, 'skyship'));
  const rush = 400 * sim.spot(s, 'steel') * RUSH_PREMIUM;
  assert.equal(cape(s).stock.steel, 0);
  assert.ok(Math.abs(cash - s.cash - (60 + rush)) < 1e-6, `spent ${cash - s.cash}`);
});

test('Boca Chica builds catch vehicles cheaper and faster; Vandenberg has no factory', () => {
  const s = rich(...ALL);
  sim.acquireSite(s, 'boca', 'buy');
  sim.acquireSite(s, 'vandenberg', 'lease');
  const capeBuild = sim.buildCostAt('skyship', 'cape');
  const bocaBuild = sim.buildCostAt('skyship', 'boca');
  assert.ok(bocaBuild.cost < capeBuild.cost && bocaBuild.days < capeBuild.days);
  assert.equal(sim.buildCostAt('peregrine9', 'boca').cost, ROCKETS.peregrine9.buildCost, 'no discount on non-catch hulls');
  assert.equal(sim.buildBlocker(s, 'peregrine9', 'vandenberg'), 'No factory here');
  assert.equal(sim.queueBuild(s, 'skyship', 'boca'), true);
  assert.equal(s.sites.boca.queue.length, 1);
});

test('sites cost money to acquire and cannot be bought twice', () => {
  const s = reuse(sim.createState());
  assert.match(sim.siteBlocker(s, 'boca', 'buy'), /Not enough cash/);
  s.cash = 500;
  assert.equal(sim.siteBlocker(s, 'boca', 'lease'), 'Not available');
  assert.ok(sim.acquireSite(s, 'boca', 'buy'));
  assert.equal(sim.siteBlocker(s, 'boca', 'buy'), 'Already owned');
  assert.equal(SITES.boca.price.buy, 500 - Math.round(s.cash));
});

test('v4 saves become Cape Canaveral: a grown company owns it, a small one leases it', () => {
  const v4 = (pads, lines) => JSON.stringify({
    ...JSON.parse(sim.serialize(reuse(sim.createState()))), v: 4, pads, lines, queue: [], sites: undefined, droneships: undefined, market: undefined,
  });
  const small = sim.deserialize(v4([{ busyUntil: 0 }], 1));
  assert.equal(small.sites.cape.status, 'leased');
  assert.equal(small.sites.cape.pads.length, 1);
  const grown = sim.deserialize(v4([{ busyUntil: 0 }, { busyUntil: 3 }], 2));
  assert.equal(grown.sites.cape.status, 'owned');
  assert.equal(grown.sites.cape.pads.length, 2);
  assert.equal(grown.sites.cape.lines, 2);
  assert.equal(grown.sites.cape.pads[1].busyUntil, 3);
  assert.equal(grown.droneships.length, 1);
});

test('reputation grows the contract board and its pace', () => {
  const s = reuse(sim.createState());
  assert.deepEqual(sim.boardSize(s), { every: 6, cap: 8 });
  s.flightCounts = { peregrine9: 40 };
  assert.deepEqual(sim.boardSize(s), { every: 3, cap: 10 });
  s.flightCounts = { peregrine9: 100, skyship: 20 };
  assert.deepEqual(sim.boardSize(s), { every: 2, cap: 12 });
  s.contracts = [];
  for (let i = 0; i < 20; i++) sim.tick(s);
  assert.ok(s.contracts.length >= 8, `board filled faster: ${s.contracts.length}`);
});
