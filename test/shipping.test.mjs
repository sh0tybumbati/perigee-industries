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

test('shipping only starts once the contract is accepted, and unloading withdraws it', () => {
  const s = world();
  const c = contract(s, { region: 'eu' });
  idle(s, 10);
  assert.equal(c.acceptedDay, undefined, 'an offer on the board is not shipping');
  assert.ok(sim.toggleContract(s, c.id));
  assert.equal(c.acceptedDay, s.day);
  idle(s, 3);
  assert.ok(sim.toggleContract(s, c.id)); // unload
  assert.equal(c.acceptedDay, undefined);
  assert.ok(sim.toggleContract(s, c.id)); // load again: the clock restarts
  assert.match(sim.launchBlocker(s), /arrives in 6 day/);
});
