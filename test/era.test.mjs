import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/sim.js';
import { PROTOS, ROCKETS, ODDS_LEARNING, TECH } from '../src/data.js';

const withMock = (v, fn) => { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } };
const idle = (s, n) => { for (let i = 0; i < n; i++) sim.tick(s); };

test('the company starts in January 2010 with an expendable booster and no reuse', () => {
  const s = sim.createState();
  assert.equal(sim.dateOf(s.day).text, '1 Jan 2010');
  assert.equal(s.cash, 60);
  assert.equal(sim.recoveryOf(s), 'expend');
  s.recovery = 'rtls';
  assert.equal(sim.recoveryOf(s), 'expend', 'RTLS is locked until Booster Landing is researched');
  s.recovery = 'drone';
  assert.equal(sim.recoveryOf(s), 'expend');
  assert.equal(sim.buyDroneship(s), false, 'droneships need research too');
});

test('an expended booster is lost and the next flight needs a new hull', () => {
  const s = sim.createState();
  sim.setDest(s, 'leo');
  s.contracts.push({ id: 900, customer: 'X', dest: 'leo', mass: 5, volume: 10, payout: 3, expires: 99 });
  sim.toggleContract(s, 900);
  const r = withMock(0.999, () => sim.launch(s));
  assert.ok(r.ok && !r.failed);
  assert.equal(sim.fleetOf(s, 'peregrine9').length, 0);
});

test('booster landing is a funded test: build an article, fly it, and the dice decide', () => {
  const s = sim.createState();
  s.cash = 500;
  assert.equal(sim.techState(s, 'landing'), 'available');
  assert.ok(sim.buyTech(s, 'landing'));
  assert.equal(sim.techState(s, 'landing'), 'testing');
  assert.ok(!s.tech.has('landing'));
  assert.equal(sim.techState(s, 'fastCores'), 'locked', 'dependants wait for the test to succeed');
  assert.match(sim.testFlightBlocker(s, 'landing'), /Build a test article/);
  const alu = s.sites.cape.stock.aluminum;
  assert.ok(sim.queueTest(s, 'landing'));
  assert.equal(s.sites.cape.stock.aluminum, alu - PROTOS.landing.t, 'the article uses aluminum');
  idle(s, PROTOS.landing.days + 1);
  assert.equal(s.trials.landing.articles, 1);
  const pad = s.sites.cape.pads[0];
  // a failed roll: the article is lost, the pad closes, the odds improve
  const odds0 = sim.testOdds(s, 'landing');
  const fail = withMock(0.999, () => sim.flyTest(s, 'landing'));
  assert.deepEqual([fail.ok, fail.success], [true, false]);
  assert.equal(s.trials.landing.articles, 0);
  assert.equal(s.trials.landing.attempts, 1);
  assert.ok(pad.busyUntil > s.day + 10, 'the pad is closed for repairs');
  assert.ok(Math.abs(sim.testOdds(s, 'landing') - (odds0 + ODDS_LEARNING)) < 1e-9);
  assert.ok(!s.tech.has('landing'));
  // try again and succeed
  pad.busyUntil = 0;
  assert.ok(sim.queueTest(s, 'landing'));
  idle(s, PROTOS.landing.days + 1);
  const ok = withMock(0, () => sim.flyTest(s, 'landing'));
  assert.equal(ok.success, true);
  assert.ok(s.tech.has('landing'));
  assert.equal(s.trials.landing, undefined);
  assert.equal(sim.recoveryOf(s), 'rtls');
  assert.equal(sim.techState(s, 'fastCores'), 'available');
});

test('test odds are capped, and every protected tech has an article', () => {
  const s = sim.createState();
  s.trials.hull = { articles: 0, attempts: 99 };
  assert.equal(sim.testOdds(s, 'hull'), 0.9);
  for (const id of Object.keys(PROTOS)) assert.ok(TECH.some((t) => t.id === id), id);
});

test('aluminum: Peregrine hulls need it, a shortage is bought at spot plus the rush premium', () => {
  const s = sim.createState();
  s.cash = 500;
  s.sites.cape.stock.aluminum = 0;
  const before = s.cash;
  assert.ok(sim.queueBuild(s, 'peregrine9'));
  const metal = ROCKETS.peregrine9.steel * sim.spot(s, 'aluminum') * 1.1;
  assert.ok(Math.abs(before - s.cash - (ROCKETS.peregrine9.buildCost + metal)) < 0.01);
  s.sites.cape.stock.steel = 400;
  const steelBefore = s.sites.cape.stock.steel;
  assert.ok(sim.queueBuild(s, 'peregrine9'));
  assert.equal(s.sites.cape.stock.steel, steelBefore, 'Peregrines do not use steel');
});

test('v5 saves load into the new era with landing research and an aluminum yard', () => {
  const s = sim.createState();
  const o = JSON.parse(sim.serialize(s));
  o.v = 5; o.tech = ['fastCores']; delete o.trials; delete o.sites.cape.stock.aluminum; delete o.sites.cape.cap.aluminum; o.recovery = 'rtls';
  const back = sim.deserialize(JSON.stringify(o));
  assert.ok(back.tech.has('landing') && back.tech.has('droneship') && back.tech.has('fastCores'));
  assert.ok(back.sites.cape.stock.aluminum > 0 && back.sites.cape.cap.aluminum > 0);
  assert.equal(back.recovery, 'rtls');
  assert.deepEqual(back.trials, {});
});

test('a test article in the queue does not count as a cargo hull for the investor rescue', () => {
  const s = sim.createState();
  s.cash = 500;
  sim.buyTech(s, 'landing');
  sim.queueTest(s, 'landing');
  s.fleet = [];
  s.cash = 0;
  sim.tick(s);
  assert.match(s.log.at(-1), /emergency funding/);
});

test('milestones are recorded once, with their date, and sent to a listener', () => {
  const s = sim.createState();
  const seen = [];
  sim.setEventSink((e) => seen.push(e));
  try {
    sim.milestone(s, 'x', 'Something', 'text');
    sim.milestone(s, 'x', 'Something', 'text');
    assert.equal(seen.filter((e) => e.type === 'milestone').length, 1);
    assert.deepEqual(s.milestones.x, { day: s.day, title: 'Something' });
    s.cash = 500;
    sim.buyTech(s, 'gen1');
    assert.ok(s.milestones['tech:gen1'], 'research completion is a milestone');
    sim.note(s, 'Hull SKY-01 LOST on ascent');
    sim.note(s, 'Queued something');
    assert.deepEqual(seen.filter((e) => e.type === 'note').slice(-2).map((e) => e.kind), ['bad', 'info']);
  } finally { sim.setEventSink(null); }
});

test('a test article that is ready asks for an auto-pause', () => {
  const s = sim.createState();
  s.cash = 500;
  sim.buyTech(s, 'landing');
  sim.queueTest(s, 'landing');
  const seen = [];
  sim.setEventSink((e) => seen.push(e));
  try { idle(s, 7); } finally { sim.setEventSink(null); }
  assert.ok(seen.some((e) => e.type === 'note' && e.pause && /test flight/.test(e.msg)));
});

test('cash history keeps 90 days, and runway counts the days of overhead left', () => {
  const s = sim.createState();
  idle(s, 120);
  assert.equal(s.cashHistory.length, 90);
  s.cash = 50;
  s.sats = 0;
  assert.equal(sim.runwayDays(s), Math.floor((50 - 5) / (sim.OVERHEAD_PER_DAY - sim.dailyRevenue(s))));
  s.constellation = { na: 1e9, eu: 1e9, apac: 1e9, sa: 1e9, af: 1e9, mar: 1e9 };
  assert.equal(sim.runwayDays(s), Infinity);
});

test('the Mars window warns 30 days ahead and when it opens', () => {
  const s = sim.createState();
  s.tech.add('marsTransit');
  s.cash = 5000;
  const w = sim.marsWindow(1).opens;
  s.day = w - 31;
  const seen = [];
  sim.setEventSink((e) => seen.push(e));
  try { idle(s, 32); } finally { sim.setEventSink(null); }
  const msgs = seen.filter((e) => e.type === 'note' && e.pause).map((e) => e.msg);
  assert.ok(msgs.some((m) => /opens in 30 days/.test(m)), msgs.join('|'));
  assert.ok(msgs.some((m) => /OPEN/.test(m)), msgs.join('|'));
});

test('the tutorial follows what the player does, and old saves skip it', () => {
  const s = sim.createState();
  assert.equal(sim.tutorialStep(s).id, 'load');
  s.contracts.push({ id: 901, customer: 'X', dest: 'leo', mass: 5, volume: 10, payout: 3, expires: 99 });
  sim.toggleContract(s, 901);
  assert.equal(sim.tutorialStep(s).id, 'launch');
  s.totalLaunches = 1;
  s.fleet = [];
  assert.equal(sim.tutorialStep(s).id, 'hull');
  sim.queueBuild(s, 'peregrine9');
  assert.equal(sim.tutorialStep(s).id, 'gen1');
  s.cash = 500;
  sim.buyTech(s, 'gen1');
  sim.buyTech(s, 'landing');
  assert.equal(sim.tutorialStep(s).id, 'article');
  sim.queueTest(s, 'landing');
  assert.equal(sim.tutorialStep(s).id, 'fly');
  s.tech.add('landing');
  assert.equal(sim.tutorialStep(s), null);
  const old = JSON.parse(sim.serialize(sim.createState()));
  delete old.tutorial;
  assert.equal(sim.tutorialStep(sim.deserialize(JSON.stringify(old))), null);
  const skip = sim.createState();
  sim.skipTutorial(skip);
  assert.equal(sim.tutorialStep(skip), null);
});
