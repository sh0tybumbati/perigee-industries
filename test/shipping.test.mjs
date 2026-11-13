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
  assert.match(sim.launchBlocker(s), /Payload for Orion Media arrives in 6 day/);
  idle(s, 5);
  assert.match(sim.launchBlocker(s), /arrives in 1 day/);
  idle(s, 1);
  assert.equal(sim.launchBlocker(s), null);
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

test('drafting ships nothing; locking in accepts, freezes and starts the clock; cancel forgets it', () => {
  const s = world();
  const c = contract(s, { region: 'eu' });
  idle(s, 10);
  assert.ok(sim.toggleContract(s, c.id));
  assert.equal(c.acceptedDay, undefined, 'a draft is not shipping');
  assert.equal(sim.shipDaysNeeded(s), 6);
  assert.ok(sim.lockLoadout(s));
  assert.equal(c.acceptedDay, s.day);
  assert.equal(sim.toggleContract(s, c.id), false, 'the loadout is frozen');
  assert.equal(sim.setDest(s, 'gto'), false);
  assert.equal(sim.setSite(s, 'cape'), false);
  idle(s, 3);
  assert.ok(sim.cancelLoadout(s));
  assert.equal(c.acceptedDay, undefined);
  assert.equal(s.lock, null);
  assert.ok(sim.toggleContract(s, c.id)); // unload the draft
  assert.ok(sim.toggleContract(s, c.id));
  assert.ok(sim.lockLoadout(s)); // the clock restarts
  assert.match(sim.launchBlocker(s), /arrives in 6 day/);
});

test('two contracts and satellites lock in together and launch when the last part arrives', () => {
  const s = world();
  s.tech.add('gen1');
  s.cash = 5000;
  const near = contract(s, { region: 'na' });
  const far = contract(s, { region: 'eu', dest: 'leo' });
  assert.ok(sim.toggleContract(s, near.id));
  assert.ok(sim.toggleContract(s, far.id));
  sim.adjustSats(s, sim.SAT_BATCH);
  assert.ok(s.sats > 0);
  assert.ok(sim.lockLoadout(s));
  for (let i = 0; i < 5; i++) { idle(s, 1); assert.equal(sim.autoLaunchReady(s), false); }
  idle(s, 1);
  assert.equal(sim.autoLaunchReady(s), true, 'the Europe payload lands on day 6');
  const r = sim.launch(s);
  assert.ok(r.ok);
  assert.equal(s.lock, null);
  assert.equal(s.manifest.length, 0);
});

test('a locked contract does not expire while it ships', () => {
  const s = world();
  const c = contract(s, { region: 'apac', expires: s.day + 3 });
  sim.toggleContract(s, c.id);
  sim.lockLoadout(s);
  idle(s, 6);
  assert.ok(s.contracts.includes(c));
});

test('satellites alone need two days of shipping', () => {
  const s = world();
  s.tech.add('gen1');
  sim.adjustSats(s, sim.SAT_BATCH);
  assert.match(sim.launchBlocker(s), /Lock in the loadout/);
  sim.lockLoadout(s);
  assert.match(sim.launchBlocker(s), /Satellites arrive in 2 day/);
  idle(s, 2);
  assert.equal(sim.launchBlocker(s), null);
});
