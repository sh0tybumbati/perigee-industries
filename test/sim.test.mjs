import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/sim.js';
const reuse = (s) => { s.tech.add('landing'); s.tech.add('droneship'); s.recovery = 'rtls'; return s; };
import { DEPOT_CAP, TANKER_LOAD, PAD_TURN, ROCKETS } from '../src/data.js';

const cape = (s) => s.sites.cape;

const ALL = ['fastCores', 'gen1', 'heavyCores', 'hull', 'raptor', 'tiles', 'skyship', 'tanker'];
const rich = (...tech) => {
  const s = reuse(sim.createState());
  for (const t of tech) s.tech.add(t);
  s.cash = 1000;
  cape(s).pads.forEach((p) => { p.tower = true; }); // so catch vehicles can fly in tests
  return s;
};
const give = (s, type, n = 1) => { for (let i = 0; i < n; i++) sim.queueBuild(s, type); for (let i = 0; i < 60 && cape(s).queue.length; i++) sim.tick(s); };
const withMock = (value, fn) => {
  const real = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = real; }
};
const win = (fn) => withMock(0.999, fn);
const idle = (s, days) => { for (let i = 0; i < days; i++) sim.tick(s); };
const contract = (s, o) => {
  const c = { id: s.nextId++, customer: 'X', dest: 'leo', mass: 5, volume: 10, payout: 6, expires: 999, ...o };
  s.contracts.push(c);
  return c;
};

test('save round trip keeps sets and nested state', () => {
  const s = rich('gen1');
  s.depot = { built: true, prop: 120 };
  s.flightCounts.behemoth = 2;
  assert.deepStrictEqual(sim.deserialize(sim.serialize(s)), s);
});

test('bad or unknown saves are rejected', () => {
  for (const bad of ['not json', '{"v":99}', 'null', '']) assert.equal(sim.deserialize(bad), null);
});

test('v2 saves migrate: cores become hulls, worn-out cores are dropped', () => {
  const v2 = {
    v: 2, day: 300, cash: 80, income: 0.1, tech: ['gen1', 'heavyCores'], flights: { behemoth: 1 },
    cores: { peregrine9: 4, peregrineHeavy: 10 }, rocket: 'peregrine9', depot: { built: false, prop: 0 },
    constellation: { na: 12 }, region: 'eu', recovery: 'drone',
  };
  const s = sim.deserialize(JSON.stringify(v2));
  assert.equal(s.fleet.length, 1);
  assert.equal(s.fleet[0].type, 'peregrine9');
  assert.equal(s.fleet[0].flights, 4);
  assert.equal(s.cash, 80);
  assert.equal(s.region, 'eu');
  assert.equal(s.constellation.na, 12);
  assert.equal(s.flightCounts.behemoth, 1);
});

test('a launch creates a trip and pays on arrival, not at launch', () => {
  const s = rich();
  const c = contract(s, { payout: 9 });
  s.manifest = [c.id];
  const cash = s.cash;
  const res = win(() => sim.launch(s));
  assert.equal(res.ok, true);
  assert.equal(s.trips.at(-1).status, 'enroute');
  assert.ok(s.cash < cash, 'launch costs are paid up front');
  const afterLaunch = s.cash;
  sim.tick(s);
  assert.equal(s.trips.at(-1).status, 'done');
  assert.ok(s.cash > afterLaunch + 8, 'payout arrives with the trip');
});

test('hulls are individual: refit blocks reuse, a second hull flies at once', () => {
  const s = rich();
  give(s, 'peregrine9');
  assert.equal(sim.fleetOf(s, 'peregrine9').length, 2);
  cape(s).pads.push({ name: 'x', tower: true, busyUntil: 0 });
  cape(s).bays.push({ tenure: 'owned', freeAt: 0 });
  for (let i = 0; i < 2; i++) {
    const c = contract(s, {});
    s.manifest = [c.id];
    assert.equal(win(() => sim.launch(s)).ok, true, `launch ${i + 1}`);
  }
  const c = contract(s, {});
  s.manifest = [c.id];
  assert.match(sim.launchBlocker(s), /not ready/);
});

test('pads gate launches per day and fail-close for repairs', () => {
  const s = rich();
  give(s, 'peregrine9');
  const a = contract(s, {}); s.manifest = [a.id];
  win(() => sim.launch(s));
  const b = contract(s, {}); s.manifest = [b.id];
  assert.match(sim.launchBlocker(s), /pads busy/);
  idle(s, PAD_TURN);
  assert.equal(sim.launchBlocker(s), null);
  withMock(0, () => sim.launch(s)); // failure
  assert.ok(cape(s).pads[0].busyUntil - s.day >= 14);
});

test('a failed launch destroys the hull and the payload', () => {
  const s = rich();
  const c = contract(s, {});
  s.manifest = [c.id];
  const res = withMock(0, () => sim.launch(s));
  assert.equal(res.failed, true);
  assert.equal(sim.fleetOf(s, 'peregrine9').length, 0);
  assert.equal(s.trips.at(-1).status, 'lost');
  idle(s, 5);
  assert.equal(s.cash >= 0, true);
});

test('hulls retire after their rated flights', () => {
  const s = rich();
  const v = sim.fleetOf(s, 'peregrine9')[0];
  v.flights = ROCKETS.peregrine9.coreLife;
  v.readyDay = s.day + 2;
  idle(s, 1);
  assert.equal(sim.fleetOf(s, 'peregrine9').length, 1);
  idle(s, 2);
  assert.equal(sim.fleetOf(s, 'peregrine9').length, 0);
});

test('factory: parallel lines, upfront cost, 50% refund only before work starts', () => {
  const s = rich();
  const start = s.cash;
  sim.queueBuild(s, 'peregrine9');
  sim.queueBuild(s, 'peregrine9');
  assert.equal(s.cash, start - 2 * ROCKETS.peregrine9.buildCost);
  idle(s, 9);
  assert.equal(sim.fleetOf(s, 'peregrine9').length, 2, 'first rolls out after 8 days');
  assert.equal(cape(s).queue.length, 1);
  assert.equal(sim.cancelBuild(s, 'cape', cape(s).queue[0].id), false, 'work already started');
  const q2 = sim.queueBuild(s, 'peregrine9');
  assert.ok(q2);
  assert.equal(sim.buyLine(s), false, 'a leased site cannot add lines');
  cape(s).status = 'owned';
  assert.equal(sim.buyLine(s), true);
  assert.equal(cape(s).lines, 2);
  const waiting = cape(s).queue.find((q) => q.daysLeft === q.total);
  const cash = s.cash;
  assert.equal(sim.cancelBuild(s, 'cape', waiting.id), true);
  assert.equal(s.cash, cash + ROCKETS.peregrine9.buildCost / 2);
});

test('locked vehicles cannot be built and the depot is a one-off', () => {
  const s = rich();
  assert.equal(sim.buildBlocker(s, 'behemoth'), 'Locked');
  const t = rich(...ALL);
  assert.equal(sim.buildBlocker(t, 'skyshipDepot'), null);
  sim.queueBuild(t, 'skyshipDepot');
  assert.match(sim.buildBlocker(t, 'skyshipDepot'), /one depot/);
});

test('behemoth needs hull, raptor and tiles; skyship also needs 3 test flights', () => {
  const s = rich('heavyCores', 'gen1', 'hull', 'raptor');
  assert.equal(sim.rocketUnlocked(s, 'behemoth'), false);
  s.tech.add('tiles');
  assert.equal(sim.rocketUnlocked(s, 'behemoth'), true);
  assert.equal(sim.techState(s, 'skyship'), 'locked');
  assert.match(sim.techBlockers(s, 'skyship')[0], /0\/3/);
  s.flightCounts.behemoth = 3;
  assert.equal(sim.techState(s, 'skyship'), 'available');
});

test('behemoth failure risk falls with successful flights and rises with hull wear', () => {
  const s = rich('heavyCores', 'gen1', 'hull', 'raptor', 'tiles');
  give(s, 'behemoth');
  sim.setRocket(s, 'behemoth');
  const fresh = sim.failChance(s);
  s.flightCounts.behemoth = 3;
  assert.ok(sim.failChance(s) < fresh);
  const before = sim.failChance(s);
  sim.fleetOf(s, 'behemoth')[0].flights = 2;
  assert.ok(sim.failChance(s) > before);
});

test('tower-catch vehicles ignore recovery penalties', () => {
  const s = rich(...ALL);
  sim.setRocket(s, 'skyship');
  s.recovery = 'rtls';
  assert.equal(sim.capacity(s).mass, 150);
  assert.equal(sim.refitDays(s), 3);
});

test('manifests hold one destination: contracts follow the map selection', () => {
  const s = rich();
  s.contracts = [];
  const a = contract(s, { dest: 'leo' });
  const b = contract(s, { dest: 'polar' });
  assert.equal(sim.toggleContract(s, a.id), true);
  assert.equal(sim.toggleContract(s, b.id), false, 'mixed destinations rejected');
  sim.toggleContract(s, a.id);
  assert.equal(sim.toggleContract(s, b.id), true, 'empty manifest follows the contract');
  assert.equal(s.dest, 'polar');
  sim.setDest(s, 'leo');
  assert.deepEqual(s.manifest, [], 'changing destination drops other contracts');
});

test('satellites only ride to LEO shells', () => {
  const s = rich('gen1');
  sim.setDest(s, 'gto');
  sim.adjustSats(s, 6);
  assert.equal(s.sats, 0);
  sim.setDest(s, 'leo');
  sim.adjustSats(s, 6);
  assert.equal(s.sats, 6);
  sim.setDest(s, 'polar');
  assert.equal(s.sats, 6);
  sim.setDest(s, 'sso');
  assert.equal(s.sats, 0);
});

test('depot ship becomes the depot; tanker runs fill it, capped at capacity', () => {
  const s = rich(...ALL);
  give(s, 'skyshipDepot');
  give(s, 'skyshipTanker');
  sim.setRocket(s, 'skyshipTanker');
  assert.match(sim.launchBlocker(s), /depot first/);
  sim.setRocket(s, 'skyshipDepot');
  assert.equal(sim.effDest(s), 'leo');
  win(() => sim.launch(s));
  assert.equal(sim.fleetOf(s, 'skyshipDepot').length, 0, 'single use');
  assert.equal(s.depot.built, false, 'not on station until it arrives');
  idle(s, 1);
  assert.deepEqual(s.depot, { built: true, prop: 0 });
  sim.setRocket(s, 'skyshipTanker');
  for (let i = 0; i < 40 && s.depot.prop < DEPOT_CAP - 1; i++) {
    if (!sim.launchBlocker(s)) win(() => sim.launch(s));
    idle(s, 1);
  }
  assert.ok(s.depot.prop > DEPOT_CAP * 0.9);
  assert.ok(s.depot.prop <= DEPOT_CAP);
});

test('lunar sites need a Skyship, a depot and propellant; the trip takes days and burns propellant', () => {
  const s = rich(...ALL);
  give(s, 'skyship');
  const c = contract(s, { dest: 'shackleton', mass: 50, volume: 100, prop: 150, payout: 60 });
  sim.setRocket(s, 'skyship');
  assert.ok(sim.toggleContract(s, c.id));
  assert.equal(s.dest, 'shackleton');
  assert.match(sim.launchBlocker(s), /LEO depot/);
  s.depot = { built: true, prop: TANKER_LOAD };
  assert.match(sim.launchBlocker(s), /propellant 100\/150/);
  s.depot.prop = 200;
  assert.equal(sim.launchBlocker(s), null);
  const cash = s.cash;
  win(() => sim.launch(s));
  assert.equal(Math.round(s.depot.prop), 50);
  const trip = s.trips.at(-1);
  assert.equal(trip.arriveDay - trip.launchDay, 5);
  idle(s, 4);
  assert.equal(s.cash < cash, true, 'no payout before arrival');
  idle(s, 1);
  assert.ok(s.cash > cash, 'payout on arrival');
  const v = sim.fleetOf(s, 'skyship')[0];
  assert.ok(v.readyDay - trip.launchDay >= 10, 'round trip keeps the hull away');
});

test('non-Skyship vehicles cannot fly to the Moon, and failures keep the propellant', () => {
  const s = rich(...ALL);
  const c = contract(s, { dest: 'tranq', mass: 5, volume: 10, prop: 15 });
  sim.toggleContract(s, c.id);
  give(s, 'skyship');
  s.depot = { built: true, prop: 100 };
  assert.match(sim.launchBlocker(s), /needs a Skyship/);
  sim.setRocket(s, 'skyship');
  withMock(0, () => sim.launch(s));
  assert.equal(s.depot.prop, 100);
});

test('mars destinations are locked until the tech exists', () => {
  const s = rich();
  assert.equal(sim.setDest(s, 'jezero'), false);
  s.tech.add('marsTransit');
  assert.equal(sim.setDest(s, 'jezero'), true);
});

test('investors rescue a company with no hulls left', () => {
  const s = reuse(sim.createState());
  s.fleet = [];
  s.cash = 0;
  sim.tick(s);
  assert.ok(s.cash >= ROCKETS.peregrine9.buildCost + 5);
  assert.match(s.log.at(-1), /emergency funding/);
});
