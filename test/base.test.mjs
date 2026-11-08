import test from 'node:test';
import assert from 'node:assert/strict';
import * as sim from '../src/sim.js';
import * as B from '../src/base.js';
import { MODULES, BASE_W, STOCK_KEEP, SPE_CHANCE } from '../src/data.js';

const ALL = ['fastCores', 'gen1', 'heavyCores', 'hull', 'raptor', 'tiles', 'skyship', 'tanker', 'habitat', 'isru'];
const world = () => {
  const s = sim.createState();
  for (const t of ALL) s.tech.add(t);
  s.cash = 5000;
  s.sites.cape.pads.forEach((p) => { p.tower = true; });
  return s;
};
const withMock = (v, fn) => { const r = Math.random; Math.random = () => v; try { return fn(); } finally { Math.random = r; } };
const quiet = (s, days) => withMock(0.9, () => { for (let i = 0; i < days; i++) sim.tick(s); });
const place = (b, type, x, y, rot = 0) => {
  b.pending.push({ id: b.nextId++, type });
  assert.ok(B.placeModule(b, b.pending.at(-1).id, x, y, rot), `place ${type}`);
  return b.modules.at(-1);
};
const duct = (b, m1, e1, m2, e2) => assert.ok(B.connect(b, B.portId(m1, e1), B.portId(m2, e2)));
// A small working base: reactor + habitat + drone bay + smelter, all ducted together.
const smallBase = () => {
  const b = B.createBase('tranq');
  const rc = place(b, 'reactor', 2, 2);
  const hb = place(b, 'habitat', 2, 4);
  const dr = place(b, 'drones', 2, 6);
  const sm = place(b, 'smelter', 2, 8);
  duct(b, rc, 0, hb, 0); duct(b, hb, 1, dr, 0); duct(b, dr, 1, sm, 0);
  return { b, rc, hb, dr, sm };
};
const give = (s, type) => { s.fleet.push({ id: s.nextId++, type, serial: `${type}-t`, flights: 0, returnDay: 0, readyDay: 0 }); };

test('the first module ship founds the base at its site; later ships must use the same site', () => {
  const s = world();
  give(s, 'modHab');
  s.depot = { built: true, prop: 500 };
  sim.setRocket(s, 'modHab');
  assert.match(sim.launchBlocker(s), /Moon site/, 'default LEO is not a site');
  sim.setDest(s, 'shackleton');
  assert.equal(sim.modulePropNeed(s), 240);
  assert.equal(sim.launchBlocker(s), null);
  withMock(0.999, () => sim.launch(s));
  assert.equal(s.depot.prop, 260);
  quiet(s, 5);
  assert.equal(s.base.site, 'shackleton');
  assert.deepEqual(s.base.pending.map((p) => p.type), ['habitat']);
  give(s, 'modReactor');
  sim.setRocket(s, 'modReactor');
  sim.setDest(s, 'tranq');
  assert.match(sim.launchBlocker(s), /Your base is at Shackleton/);
});

test('module ships need a depot with enough propellant and are consumed', () => {
  const s = world();
  give(s, 'modHab');
  sim.setRocket(s, 'modHab');
  sim.setDest(s, 'shackleton');
  assert.match(sim.launchBlocker(s), /LEO depot/);
  s.depot = { built: true, prop: 100 };
  assert.match(sim.launchBlocker(s), /100\/240/);
  s.depot.prop = 300;
  withMock(0.999, () => sim.launch(s));
  assert.equal(sim.fleetOf(s, 'modHab').length, 0);
});

test('a failed module launch loses the ship but keeps the propellant', () => {
  const s = world();
  give(s, 'modHab');
  s.depot = { built: true, prop: 300 };
  sim.setRocket(s, 'modHab');
  sim.setDest(s, 'shackleton');
  withMock(0, () => sim.launch(s));
  assert.equal(s.depot.prop, 300);
  assert.equal(s.base, null);
});

test('placement stays inside the grid and never overlaps', () => {
  const b = B.createBase('tranq');
  assert.equal(B.canPlace(b, 'habitat', BASE_W - 5, 0, 0), true);
  assert.equal(B.canPlace(b, 'habitat', BASE_W - 4, 0, 0), false, 'runs off the edge');
  assert.equal(B.canPlace(b, 'habitat', 0, -1, 0), false);
  place(b, 'habitat', 5, 5, 0);
  assert.equal(B.canPlace(b, 'reactor', 7, 5, 0), false, 'overlaps');
  assert.equal(B.canPlace(b, 'reactor', 7, 4, 1), false, 'vertical tube crossing the habitat');
  assert.equal(B.canPlace(b, 'reactor', 10, 5, 0), true, 'touching is fine');
});

test('ducts need two free ports on different modules, within reach', () => {
  const b = B.createBase('tranq');
  const a = place(b, 'habitat', 2, 2);
  const c = place(b, 'reactor', 2, 4);
  const far = place(b, 'smelter', 30, 20);
  assert.ok(B.ductBlocker(b, B.portId(a, 0), B.portId(a, 1)));
  assert.match(B.ductBlocker(b, B.portId(a, 0), B.portId(far, 0)), /reach/);
  assert.ok(B.connect(b, B.portId(a, 0), B.portId(c, 0)));
  assert.match(B.ductBlocker(b, B.portId(a, 0), B.portId(c, 1)), /already/);
});

test('power is shared across a network and only inside it', () => {
  const b = B.createBase('tranq');
  const rc = place(b, 'reactor', 2, 2);
  const hb = place(b, 'habitat', 2, 4);
  const lone = place(b, 'smelter', 20, 20);
  duct(b, rc, 0, hb, 0);
  const { nets, byModule } = B.analyze(b);
  assert.equal(nets.length, 2);
  assert.equal(byModule.get(hb.id).powerFactor, 1);
  assert.equal(byModule.get(lone.id).powerFactor, 0, 'the smelter has no reactor');
});

test('brownout scales machines when demand exceeds supply', () => {
  const b = B.createBase('tranq');
  const rc = place(b, 'reactor', 2, 2);
  const sm1 = place(b, 'smelter', 2, 4);
  const sm2 = place(b, 'smelter', 2, 6);
  const sm3 = place(b, 'smelter', 2, 8);
  duct(b, rc, 0, sm1, 0); duct(b, sm1, 1, sm2, 0); duct(b, sm2, 1, sm3, 0);
  const net = B.analyze(b).nets[0];
  assert.ok(net.demand > net.supply);
  assert.equal(+net.powerFactor.toFixed(3), +(1 / 1.5).toFixed(3));
});

test('an unpowered habitat loses crew', () => {
  const s = world();
  s.base = B.createBase('tranq');
  const hb = place(s.base, 'habitat', 2, 2);
  s.day = 2;
  for (let i = 0; i < 6; i++) { sim.tick(s); }
  assert.ok(hb.crew < 6);
});

test('drones bury habitats before other modules, using regolith they dig', () => {
  const s = world();
  const { b, hb, rc } = smallBase();
  s.base = b;
  b.policy = 'bury';
  quiet(s, 25);
  assert.ok(hb.cover > 0.3, `habitat cover ${hb.cover}`);
  assert.ok(hb.cover > rc.cover, 'habitat first');
  assert.ok(b.dug > 0);
});

test('mine policy only digs, balanced does both', () => {
  const run = (policy) => { const s = world(); const { b, hb } = smallBase(); s.base = b; b.policy = policy; b.modules.find((m) => m.type === 'smelter').rot = 0; quiet(s, 10); return { b, hb }; };
  assert.equal(run('mine').hb.cover, 0);
  assert.ok(run('balanced').hb.cover > 0);
});

test('smelters turn regolith into oxygen, iron and silica when powered and staffed', () => {
  const s = world();
  const { b } = smallBase();
  s.base = b;
  b.policy = 'mine';
  quiet(s, 30);
  assert.ok(b.stock.oxygen > 20 && b.stock.iron > 8 && b.stock.silica > 15, JSON.stringify(b.stock));
});

test('a smelter without crew works at reduced rate', () => {
  const s = world();
  const { b, hb } = smallBase();
  s.base = b;
  b.policy = 'mine';
  hb.crew = 0;
  b.modules.find((m) => m.type === 'habitat').crew = 0;
  withMock(0.9, () => B.tickBase(s));
  assert.equal(b.stock.oxygen, 0);
});

test('selling surplus keeps the reserve and pays out', () => {
  const s = world();
  s.base = B.createBase('tranq');
  s.base.stock = { regolith: 5, oxygen: 100, iron: 200, silica: 50 };
  const cash = s.cash;
  const got = B.sellSurplus(s);
  assert.equal(s.base.stock.oxygen, STOCK_KEEP.oxygen);
  assert.equal(s.base.stock.iron, STOCK_KEEP.iron);
  assert.equal(s.base.stock.silica, 50, 'below reserve: untouched');
  assert.equal(s.base.stock.regolith, 5);
  assert.ok(got > 0 && s.cash === cash + got);
});

test('the fabricator builds modules from stockpiled materials', () => {
  const s = world();
  const b = (s.base = B.createBase('tranq'));
  const rc = place(b, 'reactor', 2, 2);
  const fb = place(b, 'fab', 2, 4);
  const hb = place(b, 'habitat', 2, 6);
  duct(b, rc, 0, fb, 0); duct(b, fb, 1, hb, 0);
  assert.equal(B.recipeBlocker(s, 'habitat'), 'Needs 80 t iron');
  b.stock = { regolith: 0, oxygen: 100, iron: 200, silica: 100 };
  assert.equal(B.recipeBlocker(s, 'habitat'), null);
  const cash = s.cash;
  assert.ok(B.queueLocalBuild(s, 'habitat'));
  assert.equal(b.stock.iron, 120);
  assert.equal(s.cash, cash - 18);
  quiet(s, 21);
  assert.deepEqual(b.pending.map((p) => p.type), ['habitat']);
  assert.equal(b.fabQueue.length, 0);
});

test('solar storms hit unburied habitats far harder than buried ones', () => {
  const crewLost = (cover) => {
    const s = world();
    const b = (s.base = B.createBase('tranq'));
    const rc = place(b, 'reactor', 2, 2);
    const hb = place(b, 'habitat', 2, 4);
    duct(b, rc, 0, hb, 0);
    hb.cover = cover;
    const seq = [SPE_CHANCE / 2, 0.5, 0.9, 0.2, 0.4, 0.1, 0.3, 0.6]; // storm, then fixed rolls
    let i = 0;
    const real = Math.random;
    Math.random = () => seq[i++ % seq.length];
    try { B.tickBase(s); } finally { Math.random = real; }
    return b.lastSpe?.dead ?? -1;
  };
  assert.ok(crewLost(0) > crewLost(0.9));
  assert.equal(crewLost(1), 0);
});

test('lost crew are replaced over time at a cost', () => {
  const s = world();
  const { b, hb } = smallBase();
  s.base = b;
  hb.crew = 3;
  const cash = s.cash;
  quiet(s, 3);
  assert.equal(hb.crew, MODULES.habitat.crew);
  assert.ok(s.cash < cash + 1);
});

test('base survives a save round trip, and v3 saves load without a base', () => {
  const s = world();
  const { b } = smallBase();
  s.base = b;
  quiet(s, 5);
  assert.deepStrictEqual(sim.deserialize(sim.serialize(s)), s);
  const v3 = JSON.parse(sim.serialize(world()));
  v3.v = 3;
  delete v3.base;
  assert.equal(sim.deserialize(JSON.stringify(v3)).base, null);
});
