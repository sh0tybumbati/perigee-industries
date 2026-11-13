import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/sim.js';
import { SHIP_DAYS } from '../src/data.js';

const idle = (s, n) => { for (let i = 0; i < n; i++) sim.tick(s); };
const contract = (s, o = {}) => {
  const c = { id: s.nextId++, customer: 'Orion Media', region: 'eu', dest: 'leo', mass: 5, volume: 10, payout: 4, expires: s.day + 99, ...o };
  s.contracts.push(c);
  return c;
};
const world = () => {
  const s = sim.createState();
  s.tech.add('landing');
  s.cash = 1000;
  s.contracts = [];
  return s;
};

test('new contracts come from a customer region', () => {
  const s = sim.createState();
  assert.ok(s.contracts.every((c) => SHIP_DAYS[c.region]));
});

test('a payload has to be shipped to the site before the launch can happen', () => {
  const s = world();
  const c = contract(s, { region: 'eu' });
  assert.ok(sim.toggleContract(s, c.id));
  assert.equal(c.acceptedDay, undefined, 'loading is only a draft');
  assert.match(sim.launchBlocker(s), /Lock in the loadout/);
  assert.ok(sim.lockLoadout(s));
  assert.equal(c.acceptedDay, s.day);
  const L = s.locked[0];
  assert.match(sim.loadoutBlocker(s, L), /Payload for Orion Media arrives in 6 day/);
  idle(s, 5);
  assert.match(sim.loadoutBlocker(s, L), /arrives in 1 day/);
  idle(s, 1);
  assert.equal(sim.loadoutBlocker(s, L), null);
});

test('shipping time depends on the site, so a closer site can launch sooner', () => {
  const s = world();
  sim.acquireSite(s, 'vandenberg', 'lease');
  const c = contract(s, { region: 'apac', dest: 'leo' });
  const rank = sim.siteRanking(s, [c], 'leo');
  assert.equal(rank[0].id, 'vandenberg', 'Asia-Pacific ships to California in 6 days against 9 to Florida');
  assert.equal(rank[0].day, s.day + 6);
});

test('loading a contract picks the best site; a polar orbit can only go to Vandenberg', () => {
  const s = world();
  sim.acquireSite(s, 'vandenberg', 'lease');
  const polar = contract(s, { dest: 'polar', region: 'na' });
  assert.ok(sim.toggleContract(s, polar.id));
  assert.equal(s.site, 'vandenberg');
  s.manifest = [];
  const leo = contract(s, { dest: 'leo', region: 'na' });
  s.site = 'vandenberg';
  assert.ok(sim.toggleContract(s, leo.id));
  assert.equal(s.site, 'cape', 'ties on days go to the site without fees... and Cape is the cheaper pick');
});

test('a busy pad pushes the pick to the other site', () => {
  const s = world();
  sim.acquireSite(s, 'vandenberg', 'lease');
  s.sites.cape.pads.forEach((p) => { p.busyUntil = s.day + 10; });
  const c = contract(s, { region: 'na' });
  assert.ok(sim.toggleContract(s, c.id));
  assert.equal(s.site, 'vandenberg');
});

test('closed sites are never picked, and catch vehicles need a tower', () => {
  const s = world();
  const c = contract(s, { region: 'na' });
  assert.deepEqual(sim.siteRanking(s, [c], 'leo').map((r) => r.id), ['cape']);
  assert.deepEqual(sim.siteRanking(s, [c], 'leo', { catchPad: true }), [], 'no tower anywhere yet');
  s.sites.cape.pads[0].tower = true;
  assert.deepEqual(sim.siteRanking(s, [c], 'leo', { catchPad: true }).map((r) => r.id), ['cape']);
});

test('a manual site pick holds until the next contract is loaded', () => {
  const s = world();
  sim.acquireSite(s, 'vandenberg', 'lease');
  const a = contract(s, { region: 'na' });
  const b = contract(s, { region: 'na' });
  sim.toggleContract(s, a.id);
  sim.setSite(s, 'vandenberg');
  assert.equal(s.site, 'vandenberg');
  sim.toggleContract(s, b.id);
  assert.equal(s.site, 'cape');
});

test('old contracts without a region ship instantly', () => {
  const s = world();
  const c = contract(s, { region: undefined });
  sim.toggleContract(s, c.id);
  assert.equal(sim.launchBlocker(s), null);
});

test('drafting ships nothing; locking in accepts and starts the clock; cancel forgets it', () => {
  const s = world();
  const c = contract(s, { region: 'eu' });
  idle(s, 10);
  assert.ok(sim.toggleContract(s, c.id));
  assert.equal(c.acceptedDay, undefined, 'a draft is not shipping');
  assert.equal(sim.shipDaysNeeded(s), 6);
  assert.ok(sim.lockLoadout(s));
  assert.equal(c.acceptedDay, s.day);
  assert.equal(s.manifest.length, 0, 'the draft is free again');
  assert.equal(sim.toggleContract(s, c.id), false, 'a locked contract cannot be drafted again');
  idle(s, 3);
  assert.ok(sim.cancelLoadout(s, c.lockId));
  assert.equal(c.acceptedDay, undefined);
  assert.equal(s.locked.length, 0);
  assert.ok(sim.toggleContract(s, c.id));
  assert.ok(sim.lockLoadout(s)); // the clock restarts
  assert.match(sim.loadoutBlocker(s, s.locked[0]), /arrives in 6 day/);
});

test('several loadouts can be locked at once and each launches when its own parts arrive', () => {
  const s = world();
  s.tech.add('gen1');
  s.satStock[1] = 12;
  s.cash = 5000;
  const near = contract(s, { region: 'na' });
  const far = contract(s, { region: 'eu' });
  const other = contract(s, { region: 'na' });
  assert.ok(sim.toggleContract(s, near.id));
  assert.ok(sim.toggleContract(s, far.id));
  sim.adjustSats(s, sim.SAT_BATCH);
  assert.ok(sim.lockLoadout(s));
  assert.ok(sim.toggleContract(s, other.id), 'another draft can be built straight away');
  assert.ok(sim.lockLoadout(s));
  assert.equal(s.locked.length, 2);
  const [first] = s.locked;
  for (let i = 0; i < 5; i++) { idle(s, 1); assert.equal(sim.loadoutBlocker(s, first) === null, false); }
  idle(s, 1);
  assert.equal(sim.loadoutBlocker(s, first), null, 'the Europe payload lands on day 6');
  assert.equal(sim.nextAutoLaunch(s).id, first.id);
  const r = sim.launchLoadout(s, first.id);
  assert.ok(r.ok);
  assert.equal(s.locked.length, 1);
  assert.ok(s.contracts.includes(other), 'the other loadout is untouched');
  assert.equal(s.sats, 0);
});

test('a locked contract does not expire while it ships', () => {
  const s = world();
  const c = contract(s, { region: 'apac', expires: s.day + 3 });
  sim.toggleContract(s, c.id);
  sim.lockLoadout(s);
  idle(s, 6);
  assert.ok(s.contracts.includes(c));
});

test('satellite shipping depends on the site', () => {
  const s = world();
  s.tech.add('gen1');
  sim.acquireSite(s, 'vandenberg', 'lease');
  s.satStock[1] = 12;
  sim.adjustSats(s, sim.SAT_BATCH);
  assert.equal(sim.shipDaysNeeded(s), 0, 'the plant is at Cape Canaveral');
  assert.equal(sim.launchBlocker(s), null, 'no shipping at Cape, so it can launch by hand');
  sim.setSite(s, 'vandenberg');
  s.fleet.forEach((v) => { v.site = 'vandenberg'; }); // a hull is already there
  assert.equal(sim.shipDaysNeeded(s), 3);
  sim.lockLoadout(s);
  assert.match(sim.loadoutBlocker(s, s.locked[0]), /Satellites arrive in 3 day/);
  idle(s, 3);
  assert.equal(sim.loadoutBlocker(s, s.locked[0]), null);
});

test('satellites are built in the plant before they can be launched', () => {
  const s = world();
  s.tech.add('gen1');
  sim.adjustSats(s, sim.SAT_BATCH);
  assert.equal(s.sats, 0, 'nothing in stock to load');
  const cash = s.cash;
  assert.ok(sim.queueSats(s, 1));
  assert.equal(+(cash - s.cash).toFixed(2), 2.1, 'paid when queued');
  assert.equal(s.satStock[1], 0);
  idle(s, 1);
  assert.equal(s.satStock[1], 6);
  sim.adjustSats(s, 12);
  assert.equal(s.sats, 6, 'only what is built');
  assert.equal(sim.queueSats(s, 2), false, 'Gen-2 is not researched');
});

test('the plant builds three batches at once, and an unstarted batch cancels for half', () => {
  const s = world();
  s.tech.add('gen1'); s.tech.add('gen2');
  sim.queueSats(s, 2); sim.queueSats(s, 1); sim.queueSats(s, 1); sim.queueSats(s, 1);
  assert.equal(s.satQueue.length, 4);
  idle(s, 1);
  assert.equal(s.satStock[2], 0, 'a Gen-2 batch takes two days');
  assert.equal(s.satStock[1], 12, 'two Gen-1 batches finished in parallel');
  assert.equal(s.satQueue.length, 2);
  assert.equal(sim.cancelSats(s, s.satQueue[0].id), false, 'work has started');
  const cash = s.cash;
  assert.ok(sim.cancelSats(s, s.satQueue[1].id));
  assert.equal(+(s.cash - cash).toFixed(2), 1.05);
  idle(s, 1);
  assert.equal(s.satStock[2], 6);
});

test('a hull carries as many satellites as its mass and volume allow, in whole batches', () => {
  const s = world();
  s.tech.add('gen1'); s.tech.add('gen2'); s.tech.add('gen3');
  s.recovery = 'drone'; s.tech.add('droneship');
  sim.setDest(s, 'leo');
  sim.setRocket(s, 'peregrine9');
  assert.equal(sim.satCap(s), 66, 'Gen-1: volume limits a Peregrine 9 (60 m3 / 0.9)');
  s.satGen = 2;
  assert.equal(sim.satCap(s), 24, 'Gen-2: mass limits it (22 t / 0.8)');
  s.recovery = 'rtls';
  assert.equal(sim.satCap(s), 18, 'RTLS costs payload mass');
  s.recovery = 'drone'; s.satGen = 1;
  contract(s, { mass: 10, volume: 30 }); s.manifest = [s.contracts[0].id];
  assert.equal(sim.satCap(s), 30, 'contracts on the manifest take room');
  s.manifest = [];
  s.tech.add('heavyCores');
  sim.setRocket(s, 'peregrineHeavy');
  assert.ok(sim.satCap(s) > 120, 'a Heavy holds far more than a Peregrine 9');
});

test('Fill loads what is built up to the hull cap; the launch checks mass', () => {
  const s = world();
  s.tech.add('gen1');
  sim.setDest(s, 'leo');
  s.satStock[1] = 200;
  sim.fillSats(s);
  assert.equal(s.sats, sim.satCap(s));
  s.satStock[1] = 20;
  sim.fillSats(s);
  assert.equal(s.sats, 18, 'whole batches of what is in stock');
  s.sats = 200;
  assert.ok(sim.launchBlocker(s), 'too many for the hull');
});

test('queueing several batches at once is all or nothing', () => {
  const s = world();
  s.tech.add('gen1');
  const cash = s.cash;
  assert.ok(sim.queueSats(s, 1, 5));
  assert.equal(s.satQueue.length, 5);
  assert.equal(+(cash - s.cash).toFixed(2), 10.5);
  assert.equal(sim.queueSats(s, 1, 30), false, 'the queue holds 30');
  assert.equal(s.satQueue.length, 5);
});

test('locking sets satellites aside and cancelling returns them; launching spends them', () => {
  const s = world();
  s.tech.add('gen1');
  s.satStock[1] = 12;
  sim.adjustSats(s, 12);
  assert.ok(sim.lockLoadout(s));
  assert.equal(s.satStock[1], 0);
  sim.adjustSats(s, 6);
  assert.equal(s.sats, 0, 'the locked ones cannot be used twice');
  assert.ok(sim.cancelLoadout(s, s.locked[0].id));
  assert.equal(s.satStock[1], 12);
  sim.adjustSats(s, 6);
  assert.equal(sim.launchBlocker(s), null);
  assert.ok(sim.launch(s).ok);
  assert.equal(s.satStock[1], 6, 'a hand launch takes six from the stock');
});

const hull = (s, type, site) => { const v = { id: s.nextId++, type, serial: `${type}-${s.nextId}`, flights: 0, returnDay: 0, readyDay: 0, site }; s.fleet.push(v); return v; };

test('a hull flies only from the site it is at, and can be shipped between sites', () => {
  const s = world();
  s.fleet = [];
  sim.acquireSite(s, 'vandenberg', 'lease');
  const v = hull(s, 'peregrine9', 'cape');
  sim.setSite(s, 'vandenberg');
  assert.match(sim.launchBlocker(s), /No Peregrine 9 at Vandenberg: ship one from Cape \(7 days\)/);
  assert.equal(sim.nextVehicle(s, 'peregrine9'), null);
  const cash = s.cash;
  assert.ok(sim.shipHull(s, v.id, 'vandenberg'));
  assert.equal(sim.vehicleState(s, v), 'shipping');
  assert.equal(+(cash - s.cash).toFixed(2), 0.2);
  assert.equal(sim.shipHull(s, v.id, 'cape'), false, 'it is already on the road');
  idle(s, 6);
  assert.equal(sim.nextVehicle(s, 'peregrine9'), null);
  idle(s, 1);
  assert.equal(sim.nextVehicle(s, 'peregrine9'), v);
  assert.equal(v.site, 'vandenberg');
});

test('locking a loadout for a site with no hull ships one there by itself', () => {
  const s = world();
  s.fleet = [];
  sim.acquireSite(s, 'vandenberg', 'lease');
  const v = hull(s, 'peregrine9', 'cape');
  const c = contract(s, { region: 'na' });
  sim.setSite(s, 'vandenberg');
  assert.ok(sim.toggleContract(s, c.id));
  sim.setSite(s, 'vandenberg');
  assert.ok(sim.lockLoadout(s));
  assert.equal(sim.vehicleState(s, v), 'shipping', 'dispatched at lock-in');
  assert.match(sim.loadoutBlocker(s, s.locked[0]), /arrives at Vandenberg in 7 day/);
  idle(s, 7);
  assert.equal(sim.loadoutBlocker(s, s.locked[0]), null);
});

test('the automatic site pick prefers a site that already has a hull', () => {
  const s = world();
  s.fleet = [];
  sim.acquireSite(s, 'vandenberg', 'lease');
  hull(s, 'peregrine9', 'vandenberg');
  const c = contract(s, { region: 'na' });
  assert.ok(sim.toggleContract(s, c.id));
  assert.equal(s.site, 'vandenberg');
});

test('a satellites-only draft also gets the best site picked', () => {
  const s = world();
  s.tech.add('gen1');
  s.satStock[1] = 12;
  s.fleet = [];
  sim.acquireSite(s, 'vandenberg', 'lease');
  hull(s, 'peregrine9', 'vandenberg');
  sim.adjustSats(s, 6);
  assert.equal(s.site, 'vandenberg');
});

test('Core Life research raises the rating and cuts wear risk for Peregrine cores only', () => {
  const s = world();
  assert.equal(sim.coreLife(s, 'peregrine9'), 10);
  s.tech.add('life1');
  assert.equal(sim.coreLife(s, 'peregrine9'), 20);
  assert.equal(sim.coreLife(s, 'peregrineHeavy'), 20);
  assert.equal(sim.coreLife(s, 'skyship'), 40);
  s.tech.add('life2'); s.tech.add('life3');
  assert.equal(sim.coreLife(s, 'peregrine9'), 50);
  assert.ok(Math.abs(sim.wearRisk(s, 'peregrine9') - 0.004 * 0.3) < 1e-12);
  const v = hull(s, 'peregrine9', 'cape');
  v.flights = 12;
  idle(s, 1);
  assert.ok(s.fleet.includes(v), 'a 12-flight core is not retired any more');
});
