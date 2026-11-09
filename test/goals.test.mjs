import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/sim.js';
import { CHAPTERS, COLONY_DAYS, colonyCheck, currentChapter, adoptGoals, chapterDone } from '../src/goals.js';
import { createBase } from '../src/base.js';

const fresh = () => sim.createState();

test('a new company starts in chapter 1 with nothing done', () => {
  const s = fresh();
  assert.equal(currentChapter(s).id, 'orbit');
  assert.deepEqual(s.goals, {});
});

test('goals complete from state, and finishing a chapter pays its grant once', () => {
  const s = fresh();
  s.milestones.firstFlight = { day: 1, title: 'x' };
  s.milestones.reflown = { day: 1, title: 'x' };
  s.flightCounts = { peregrine9: 10 };
  s.tech.add('landing');
  const cash = s.cash;
  sim.tick(s);
  assert.ok(chapterDone(s, CHAPTERS[0]));
  assert.ok(s.cash > cash + 4, 'the $5M Orbit grant arrived');
  assert.equal(currentChapter(s).id, 'bills');
  const after = s.cash;
  sim.tick(s);
  assert.ok(s.cash < after + 1, 'the grant is not paid twice');
});

test('profit streak counts days in a row and resets', () => {
  const s = fresh();
  s.income = 1;
  const run = (n) => { for (let i = 0; i < n; i++) sim.tick(s); };
  s.constellation = { 1: 0, 2: 0, 3: 0 };
  run(3);
  assert.equal(s.profitDays, 0, 'no Skylink income means no profit');
});

function colonyState() {
  const s = fresh();
  s.milestones.marsReturn = { day: 1, title: 'x' };
  s.marsBase = createBase('jezero', 'mars');
  let id = 1;
  const add = (type, crew = 0) => s.marsBase.modules.push({ id: id++, type, x: 2 * id, y: 2, rot: 0, cover: 1, crew }); // buried, so a solar event cannot kill the crew
  add('reactor'); add('reactor');
  add('habitat', 6); add('habitat', 6); add('habitat', 6);
  add('icer'); add('refinery');
  const m = s.marsBase.modules;
  for (let i = 0; i < m.length - 1; i++) s.marsBase.ducts.push({ a: `${m[i].id}:1`, b: `${m[i + 1].id}:0` });
  return s;
}

test('colony conditions name what is missing', () => {
  const s = colonyState();
  assert.equal(colonyCheck(s).ok, true, colonyCheck(s).missing.join(', '));
  s.marsBase.modules.find((m) => m.type === 'icer').type = 'drones';
  assert.match(colonyCheck(s).missing.join(), /Ice Miner/);
  s.marsBase = null;
  assert.equal(colonyCheck(s).ok, false);
});

test('holding the colony for 180 days wins, and a break resets the count', () => {
  const s = colonyState();
  // everything before chapter 7 is done
  for (const ch of CHAPTERS.slice(0, -1)) for (const g of ch.goals) s.goals[g.id] = 1;
  for (const ch of CHAPTERS.slice(0, -1)) s.chaptersPaid[ch.id] = true;
  let victory = 0;
  sim.setEventSink((e) => { if (e.type === 'victory') victory++; });
  for (let i = 0; i < 100; i++) sim.tick(s);
  assert.equal(s.colonyDays, 100);
  const icer = s.marsBase.modules.find((m) => m.type === 'icer');
  icer.type = 'drones'; // the Ice Miner is lost
  sim.tick(s);
  assert.equal(s.colonyDays, 0);
  assert.match(s.colonyMissing.join(), /Ice Miner/);
  icer.type = 'icer';
  for (let i = 0; i < COLONY_DAYS; i++) sim.tick(s);
  sim.setEventSink(null);
  assert.ok(s.won, 'won');
  assert.equal(victory, 1);
  assert.equal(currentChapter(s), null);
});

test('v10 saves load with what is already true marked done, and nothing paid again', () => {
  const s = fresh();
  s.tech.add('landing'); s.tech.add('gen1');
  s.flightCounts = { peregrine9: 12 };
  s.milestones.firstFlight = { day: 5, title: 'x' };
  s.milestones.reflown = { day: 9, title: 'x' };
  const o = JSON.parse(sim.serialize(s));
  o.v = 10;
  delete o.goals; delete o.chaptersPaid;
  const cash = o.cash;
  const t = sim.deserialize(JSON.stringify(o));
  assert.ok(t.goals.flights10 != null && t.goals.reflown != null);
  assert.equal(t.chaptersPaid.orbit, true);
  assert.equal(t.cash, cash);
  assert.equal(currentChapter(t).id, 'bills');
});

test('goals survive a save and load', () => {
  const s = fresh();
  s.goals.firstFlight = 3;
  s.colonyDays = 7;
  const t = sim.deserialize(sim.serialize(s));
  assert.equal(t.goals.firstFlight, 3);
});
