import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/sim.js';
import { MARKETS, PLANS, SATS } from '../src/data.js';
const SAT_CAPACITY = SATS[1].capacity, SAT_LIFE_DAYS = SATS[1].life;
const sats = (s, n, g = 1) => { s.constellation = { 1: 0, 2: 0, 3: 0, [g]: n }; };

const fresh = () => { const s = sim.createState(); s.tech.add('gen1'); s.cash = 500; return s; };
const mk = (id) => MARKETS.find((m) => m.id === id);

test('a market needs Gen-1, enough satellites in orbit and the license fee', () => {
  const s = fresh();
  s.tech.delete('gen1');
  assert.match(sim.marketBlocker(s, 'us'), /Gen-1/);
  s.tech.add('gen1');
  assert.match(sim.marketBlocker(s, 'us'), /Needs 12 satellites/);
  sats(s, 12);
  s.cash = 5;
  assert.match(sim.marketBlocker(s, 'us'), /Not enough cash/);
  s.cash = 500;
  assert.equal(sim.marketBlocker(s, 'us'), null);
  assert.equal(sim.applyLicense(s, 'us'), true);
  assert.equal(s.cash, 500 - mk('us').license);
  assert.equal(s.markets.us.status, 'pending');
  assert.equal(sim.marketBlocker(s, 'us'), 'Approval pending');
});

test('approval takes the market lead time, then subscribers grow', () => {
  const s = fresh();
  sats(s, 200);
  sim.applyLicense(s, 'us');
  for (let i = 0; i < mk('us').lead - 1; i++) sim.tick(s);
  assert.equal(s.markets.us.status, 'pending');
  assert.equal(sim.dailyRevenue(s), 0);
  sim.tick(s);
  assert.equal(s.markets.us.status, 'active');
  for (let i = 0; i < 200; i++) sim.tick(s);
  assert.ok(s.markets.us.subs > 5 && s.markets.us.subs <= mk('us').subs);
  assert.ok(sim.dailyRevenue(s) > 0);
});

test('subscribers cannot sign up without satellite capacity, and congestion cuts quality and drives churn', () => {
  const s = fresh();
  s.markets.us = { status: 'active', readyDay: 0, subs: 0 };
  sats(s, 0);
  for (let i = 0; i < 30; i++) sim.tick(s);
  assert.equal(s.markets.us.subs, 0, 'no satellites, no subscribers');

  sats(s, 100);
  s.markets.us.subs = 40; // capacity is only 22k
  assert.ok(Math.abs(sim.skylinkQuality(s) - (100 * SAT_CAPACITY) / 40) < 1e-9);
  const rev = sim.dailyRevenue(s);
  assert.ok(rev < (40 * 110) / 30 / 1000, 'revenue is scaled down by quality');
  sim.tick(s);
  assert.ok(s.markets.us.subs < 40, 'a congested network loses subscribers');
});

test('satellites decay over five years', () => {
  const s = fresh();
  sats(s, 100);
  for (let i = 0; i < SAT_LIFE_DAYS; i++) sim.tick(s);
  assert.ok(s.constellation[1] < 40 && s.constellation[1] > 30, `about 100/e remain, got ${s.constellation[1]}`);
});

test('the plan trades price against demand', () => {
  const run = (plan) => {
    const s = fresh();
    s.plan = plan;
    sats(s, 1000);
    s.markets.us = { status: 'active', readyDay: 0, subs: 0 };
    for (let i = 0; i < 600; i++) sim.tick(s);
    return { subs: s.markets.us.subs, rev: sim.marketRevenue(s, mk('us')) };
  };
  const b = run('budget'), p = run('premium');
  assert.ok(b.subs > p.subs, 'budget has more subscribers');
  assert.ok(Math.abs(b.subs - mk('us').subs * PLANS.budget.demand) < 1, 'and reaches its ceiling');
  assert.ok(sim.setPlan !== undefined);
  const s = fresh();
  sim.setPlan(s, 'premium');
  assert.equal(s.plan, 'premium');
  sim.setPlan(s, 'nonsense');
  assert.equal(s.plan, 'premium');
});

test('satellite launches join the global pool; v8 saves migrate', () => {
  const s = fresh();
  const back = sim.deserialize(sim.serialize(s));
  assert.equal(sim.satCount(back), 0);
  assert.equal(back.plan, 'standard');
  const old = JSON.parse(sim.serialize(s));
  old.v = 8;
  old.constellation = { na: 40, eu: 10, apac: 0, sa: 0, af: 0, mar: 0 };
  delete old.markets;
  const m = sim.deserialize(JSON.stringify(old));
  assert.equal(m.constellation[1], 50);
  assert.equal(m.markets.eu.status, 'active');
  assert.equal(m.markets.in.status, 'locked');
});

const gen2 = () => { const s = fresh(); s.tech.add('gen2'); s.cash = 500; return s; };

test('generations: capacity adds up and Gen-3 is Skyship only', () => {
  const s = gen2();
  s.constellation = { 1: 10, 2: 10, 3: 2 };
  assert.ok(Math.abs(sim.skylinkCapacity(s) - (10 * 0.3 + 10 * 1.2 + 2 * 5)) < 1e-9);
  assert.equal(sim.satGenOk(s, 2), true);
  assert.equal(sim.satGenOk(s, 3), false, 'not researched');
  s.tech.add('gen3');
  assert.equal(sim.satGenOk(s, 3), false, 'a Peregrine cannot carry it');
  s.tech.add('skyship');
  s.rocket = 'skyship';
  assert.equal(sim.satGenOk(s, 3), true);
  s.satGen = 3;
  sim.setRocket(s, 'peregrine9');
  assert.equal(s.satGen, 1, 'back to Gen-1 on a rocket that cannot carry Gen-3');
});

test('the Gen button cycles through researched generations; a Gen-2 batch is heavier and dearer', () => {
  const s = gen2();
  s.rocket = 'peregrine9';
  s.dest = 'leo';
  sim.cycleSatGen(s);
  assert.equal(s.satGen, 2);
  sim.cycleSatGen(s);
  assert.equal(s.satGen, 1);
  s.satGen = 2;
  s.sats = 24;
  assert.ok(Math.abs(sim.manifestTotals(s).mass - 24 * SATS[2].mass) < 1e-9);
  assert.ok(sim.launchCosts(s).items.some((i) => /Gen-2 Mini/.test(i.label) && Math.abs(i.amt - 24 * 0.7) < 0.01));
});

test('mobile markets need Gen-2 research and Gen-2 or newer satellites, and load the network lightly', () => {
  const s = fresh();
  sats(s, 100);
  assert.match(sim.marketBlocker(s, 'cell-us'), /Direct-to-Cell/);
  s.tech.add('gen2');
  assert.match(sim.marketBlocker(s, 'cell-us'), /Direct-to-Cell/, 'Gen-2 alone does not open mobile');
  s.tech.add('dtc');
  assert.match(sim.marketBlocker(s, 'cell-us'), /Gen-2 or newer/, 'Gen-1 satellites do not count');
  sats(s, 40, 2);
  assert.equal(sim.marketBlocker(s, 'cell-us'), null);
  assert.ok(sim.applyLicense(s, 'cell-us'));
  for (let i = 0; i < 61; i++) sim.tick(s);
  assert.equal(s.markets['cell-us'].status, 'active');
  for (let i = 0; i < 300; i++) sim.tick(s);
  const subs = s.markets['cell-us'].subs;
  assert.ok(subs > 100, `mobile subscribers grow, got ${subs}`);
  assert.ok(Math.abs(sim.totalLoad(s) - subs * 0.04) < 1e-6, 'a mobile user loads the network at 4% of a broadband user');
  assert.equal(sim.totalSubs(s), 0, 'broadband subscriber count excludes mobile');
  assert.ok(sim.dailyRevenue(s) > 0);
});

test('v9 saves migrate to generations', () => {
  const s = fresh();
  const old = JSON.parse(sim.serialize(s));
  old.v = 9;
  old.constellation = 77;
  delete old.satGen;
  const back = sim.deserialize(JSON.stringify(old));
  assert.deepEqual(back.constellation, { 1: 77, 2: 0, 3: 0 });
  assert.equal(back.satGen, 1);
  assert.equal(back.markets['cell-us'].status, 'locked');
});
