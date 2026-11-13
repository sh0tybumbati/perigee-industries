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
  sim.adjustSats(s, sim.SAT_BATCH);
  assert.equal(sim.shipDaysNeeded(s), 0, 'the plant is at Cape Canaveral');
  assert.equal(sim.launchBlocker(s), null, 'no shipping at Cape, so it can launch by hand');
  sim.setSite(s, 'vandenberg');
  assert.equal(sim.shipDaysNeeded(s), 3);
  sim.lockLoadout(s);
  assert.match(sim.loadoutBlocker(s, s.locked[0]), /Satellites arrive in 3 day/);
  idle(s, 3);
  assert.equal(sim.loadoutBlocker(s, s.locked[0]), null);
});
