// Mars economy probe: a late-game company (all tech, owned Cape, depot) tries to found a Mars base and use it.
// usage: node tools/mars-bot.mjs [runs] [years] [starting cash $M]
import * as sim from '../src/sim.js';
import * as B from '../src/base.js';
import { TECH, ROCKETS, MARS_WINDOWS, MARS_RETURN, MARS_DESTS, MODULES, EARTH_ORBITS } from '../src/data.js';

const N = +process.argv[2] || 6, YEARS = +process.argv[3] || 8, CASH0 = +process.argv[4] || 1500;
const D = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2010, 0, 1)) / 86400000) + 1;
const PLAN = ['modReactor', 'modReactor', 'modHab', 'modDrones', 'modIce', 'modRefinery'];
const BASE_SITE = 'utopia';
const out = [];

for (let run = 0; run < N; run++) {
  const s = sim.createState();
  for (const t of TECH) s.tech.add(t.id);
  s.cash = CASH0; s.day = D(2015, 1, 1); s.tutorial = 99;
  sim.acquireSite(s, 'cape', 'buy');
  for (let i = 0; i < 2; i++) sim.buyPad(s, 'cape');
  s.sites.cape.pads.forEach((_, i) => sim.buildTower(s, 'cape', i));
  for (let i = 0; i < 2; i++) sim.addBay(s, 'cape');
  for (let i = 0; i < 2; i++) sim.buyLine(s, 'cape');
  for (let i = 0; i < 2; i++) sim.buildPlant(s, 'cape', 'methalox');
  sim.expandTank(s, 'cape', 'methalox'); sim.expandTank(s, 'cape', 'methalox');
  s.fleet = [];
  const cape = s.sites.cape;
  const ev = {}; const mark = (k) => { if (!(k in ev)) ev[k] = s.day - D(2015, 1, 1); };
  const marsTrips = [];
  let modulesSent = 0, modulesLost = 0, payloadMars = 0, returns = 0, lostHulls = 0, cashMin = s.cash;
  const queued = (t) => cape.queue.filter((q) => q.type === t).length;
  const count = (t) => sim.fleetOf(s, t).length + queued(t);
  const END = s.day + YEARS * 365;
  let y = 0;

  while (s.day < END) {
    for (const c of s.contracts) c.acceptedDay ??= s.day;
    const base = s.marsBase;
    // ---- builds
    if (count('skyshipTanker') < 3 && sim.canSpend(s, 60)) sim.queueBuild(s, 'skyshipTanker');
    const earthSky = sim.fleetOf(s, 'skyship').filter((v) => v.site !== 'mars' && v.site !== 'moon').length + queued('skyship');
    if (earthSky < 2 && sim.canSpend(s, 70)) sim.queueBuild(s, 'skyship');
    const need = PLAN[modulesSent + (count(PLAN[modulesSent] ?? 'x') > 0 ? 0 : 0)];
    for (let i = modulesSent; i < PLAN.length; i++) {
      const t = PLAN[i];
      const have = count(t);
      const wanted = PLAN.slice(modulesSent).filter((x) => x === t).length;
      if (have < wanted && sim.canSpend(s, ROCKETS[t].buildCost + 20) && i - modulesSent < 6) { sim.queueBuild(s, t); break; }
    }
    // ---- place pending Mars modules in a column, duct them together
    if (base) {
      for (const p of [...base.pending]) {
        const len = MODULES[p.type].len;
        const yy = base.modules.reduce((n, m) => Math.max(n, m.y + MODULES[m.type].len + 1), 0);
        if (yy + len > 30) break;
        if (B.placeModule(base, p.id, 6, yy, 1)) {
          const m = base.modules.at(-1);
          const prev = base.modules.at(-2);
          if (prev && sim.canSpend(s, 1.5)) { B.connect(base, B.portId(prev, 1), B.portId(m, 0)) && (s.cash -= 1.5); }
        }
      }
      if (base.modules.length) mark('baseModules');
      if (base.stock.methalox >= 1) mark('firstFuel');
    }
    // ---- launches: one per free pad
    for (let k = 0; k < cape.pads.length; k++) {
      let did = false;
      const w = sim.marsWindow(s.day);
      // a. module ships to Mars
      if (w.open && modulesSent < PLAN.length) {
        sim.setRocket(s, PLAN[modulesSent]); sim.setDest(s, BASE_SITE); s.manifest = [];
        if (!sim.launchBlocker(s)) {
          const r = sim.launch(s);
          if (r.ok) { marsTrips.push(r.trip); did = true; modulesSent++; if (r.failed) { modulesLost++; modulesSent--; } mark('module1'); }
        }
      }
      // b. return flight
      if (!did && base) {
        const hull = s.fleet.find((v) => v.site === 'mars' && sim.vehicleState(s, v) === 'ready');
        const rc = s.contracts.filter((c) => c.origin === 'mars').sort((a, b) => b.payout - a.payout)[0];
        if (hull && rc && sim.marsReturnWindow(s.day).open) {
          s.manifest = []; sim.setRocket(s, 'skyship'); s.origin = 'mars'; s.dest = 'leo';
          if (sim.toggleContract(s, rc.id) && !sim.launchBlocker(s)) {
            const r = sim.launch(s);
            if (r.ok) { marsTrips.push(r.trip); did = true; returns++; mark('return1'); if (r.failed) lostHulls++; }
          }
          if (!did) { s.manifest = []; s.origin = 'earth'; }
        }
      }
      // c. cargo to the Mars base
      if (!did && base && w.open && base.modules.length) {
        const mc = s.contracts.filter((c) => c.dest === BASE_SITE && c.prop).sort((a, b) => b.payout - a.payout)[0];
        if (mc && sim.nextVehicle(s, 'skyship')) {
          s.origin = 'earth'; s.manifest = []; sim.setRocket(s, 'skyship'); sim.setDest(s, BASE_SITE);
          if (sim.toggleContract(s, mc.id) && !sim.launchBlocker(s)) {
            const r = sim.launch(s);
            if (r.ok) { marsTrips.push(r.trip); did = true; payloadMars++; mark('cargo1'); if (r.failed) lostHulls++; }
          }
          if (!did) s.manifest = [];
        }
      }
      // d. tanker runs to keep the depot full
      if (!did && s.depot.built && s.depot.prop < 440) {
        s.origin = 'earth'; s.manifest = []; sim.setRocket(s, 'skyshipTanker');
        if (!sim.launchBlocker(s)) { if (sim.launch(s).ok) did = true; }
      }
      // e. the depot itself
      if (!did && !s.depot.built && !s.trips.some((t) => t.role === 'depot' && t.status === 'enroute')) {
        if (count('skyshipDepot') < 1 && sim.canSpend(s, 80)) sim.queueBuild(s, 'skyshipDepot');
        s.origin = 'earth'; sim.setRocket(s, 'skyshipDepot');
        if (!sim.launchBlocker(s)) { if (sim.launch(s).ok) did = true; }
      }
      // f. Earth cargo with a spare Skyship
      if (!did) {
        s.origin = 'earth'; s.manifest = []; s.sats = 0;
        if (sim.nextVehicle(s, 'skyship') && !(w.open && modulesSent < PLAN.length) && sim.readyVehicles(s, 'skyship').filter((v) => v.site !== 'mars' && v.site !== 'moon').length) {
          sim.setRocket(s, 'skyship'); sim.setDest(s, 'leo');
          const cap = sim.capacity(s);
          let best = null;
          for (const dest of EARTH_ORBITS) {
            if (!sim.siteAllowsAny?.(dest) && false) continue;
            sim.setDest(s, dest); s.manifest = [];
            const cs = s.contracts.filter((c) => c.dest === dest && !c.origin).sort((a, b) => b.payout / b.mass - a.payout / a.mass);
            let mass = 0, pay = 0; const ids = [];
            for (const c of cs) { if (mass + c.mass <= cap.mass) { mass += c.mass; pay += c.payout; ids.push(c.id); } }
            if (ids.length && (!best || pay > best.pay)) best = { dest, ids, pay };
          }
          s.manifest = [];
          if (best && best.pay >= 15) {
            sim.setDest(s, best.dest);
            for (const id of best.ids) sim.toggleContract(s, id);
            if (!sim.launchBlocker(s)) sim.launch(s);
            else s.manifest = [];
          }
        }
      }
    }
    sim.tick(s);
    cashMin = Math.min(cashMin, s.cash);
    if (s.day % 365 === 0) mark('y' + (++y));
  }
  const marsIncome = marsTrips.filter((t) => t.status === 'done' && t.payout).reduce((n, t) => n + t.payout, 0);
  const lostMars = marsTrips.filter((t) => t.status === 'lost').length;
  if (process.env.DEBUG && s.marsBase) { const st = B.baseStatus(s.marsBase); const { byModule } = B.analyze(s.marsBase); console.log('RUN', run, s.marsBase.modules.map((m) => `${m.type}${m.crew ?? ''}:${(byModule.get(m.id).work).toFixed(2)}`).join(' '), JSON.stringify(st), JSON.stringify(Object.fromEntries(Object.entries(s.marsBase.stock).map(([k, v]) => [k, Math.round(v)]))), 'pending', s.marsBase.pending.length, 'fab', s.marsBase.fabQueue.length); }
  out.push({ ...ev, modulesSent, modulesLost, payloadMars, returns, lostMars, marsIncome: Math.round(marsIncome), cash: Math.round(s.cash), cashMin: Math.round(cashMin), hulls: s.fleet.length, marsHulls: s.fleet.filter((v) => v.site === 'mars').length, ch4: Math.round(s.marsBase?.stock.methalox ?? 0), mods: s.marsBase?.modules.length ?? 0 });
}
const med = (k) => { const v = out.map((o) => o[k]).filter((x) => x != null).sort((a, b) => a - b); return v.length ? `${v[Math.floor(v.length / 2)]} (${v[0]}-${v[v.length - 1]}, n=${v.length})` : 'never'; };
for (const k of ['module1', 'baseModules', 'firstFuel', 'cargo1', 'return1', 'modulesSent', 'modulesLost', 'mods', 'payloadMars', 'returns', 'lostMars', 'marsIncome', 'cash', 'cashMin', 'ch4', 'marsHulls']) console.log(k.padEnd(12), med(k));
