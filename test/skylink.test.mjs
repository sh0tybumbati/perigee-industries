import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/sim.js';
import { MARKETS, PLANS, SAT_CAPACITY, SAT_LIFE_DAYS } from '../src/data.js';

const fresh = () => { const s = sim.createState(); s.tech.add('gen1'); s.cash = 500; return s; };
const mk = (id) => MARKETS.find((m) => m.id === id);

test('a market needs Gen-1, enough satellites in orbit and the license fee', () => {
  const s = fresh();
  s.tech.delete('gen1');
  assert.match(sim.marketBlocker(s, 'us'), /Gen-1/);
  s.tech.add('gen1');
  assert.match(sim.marketBlocker(s, 'us'), /Needs 12 satellites/);
  s.constellation = 12;
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
  s.constellation = 200;
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
  s.constellation = 0;
  for (let i = 0; i < 30; i++) sim.tick(s);
  assert.equal(s.markets.us.subs, 0, 'no satellites, no subscribers');

  s.constellation = 100;
  s.markets.us.subs = 40; // capacity is only 22k
  assert.ok(Math.abs(sim.skylinkQuality(s) - (100 * SAT_CAPACITY) / 40) < 1e-9);
  const rev = sim.dailyRevenue(s);
  assert.ok(rev < (40 * 110) / 30 / 1000, 'revenue is scaled down by quality');
  sim.tick(s);
  assert.ok(s.markets.us.subs < 40, 'a congested network loses subscribers');
});

test('satellites decay over five years', () => {
  const s = fresh();
  s.constellation = 100;
  for (let i = 0; i < SAT_LIFE_DAYS; i++) sim.tick(s);
  assert.ok(s.constellation < 40 && s.constellation > 30, `about 100/e remain, got ${s.constellation}`);
});

test('the plan trades price against demand', () => {
  const run = (plan) => {
    const s = fresh();
    s.plan = plan;
    s.constellation = 1000;
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
  assert.equal(back.constellation, 0);
  assert.equal(back.plan, 'standard');
  const old = JSON.parse(sim.serialize(s));
  old.v = 8;
  old.constellation = { na: 40, eu: 10, apac: 0, sa: 0, af: 0, mar: 0 };
  delete old.markets;
  const m = sim.deserialize(JSON.stringify(old));
  assert.equal(m.constellation, 50);
  assert.equal(m.markets.eu.status, 'active');
  assert.equal(m.markets.in.status, 'locked');
});
