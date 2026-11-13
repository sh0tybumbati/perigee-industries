// Campaign bot: the pacing bot plus a late game. It buys sites, builds a Moon base and a Mars colony from module ships,
// and reports the day each goal chapter (GDD 2.21) is done. usage: node tools/campaign-bot.mjs [runs] [days]
// DEBUG=1 prints each run's end state.
import * as sim from '../src/sim.js';
const SATS_TECH = { 1: 'gen1', 2: 'gen2', 3: 'gen3' };
import { CHAPTERS, colonyCheck } from '../src/goals.js';
import * as B from '../src/base.js';
import { MODULES, MARKETS, TECH, ROCKETS, EARTH_ORBITS, LUNAR_DESTS, SAT_DESTS, DESTINATIONS } from '../src/data.js';
const GEN = !!process.env.GEN; // GEN=1: also research Gen-2/3, fly the best generation and license mobile markets
const ORDER = ['landing','gen1','fastCores','heavyCores','hull','raptor','tiles','skyship','plants','tanker','habitat','isru','ice','marsTransit'];
if (GEN) ORDER.splice(ORDER.indexOf('heavyCores'), 0, 'gen2'); if (GEN) ORDER.splice(ORDER.indexOf('skyship') + 1, 0, 'dtc');
const N = +process.argv[2] || 6, DAYS = +process.argv[3] || 9000;
const out = [];
const MOON_PLAN = ['modReactor', 'modReactor', 'modHab', 'modDrones', 'modIce', 'modRefinery'];
const MARS_PLAN = ['modReactor', 'modReactor', 'modHab', 'modHab', 'modHab', 'modDrones', 'modIce', 'modRefinery'];
// The module ships in the plan that the base does not have yet, counting ships already on their way.
const missingModules = (s, planList, body) => {
  const base = body === 'mars' ? s.marsBase : s.base;
  const have = {};
  for (const m of base?.modules ?? []) have[m.type] = (have[m.type] ?? 0) + 1;
  for (const m of base?.pending ?? []) have[m.type] = (have[m.type] ?? 0) + 1;
  for (const tr of s.trips) if (tr.role === 'module' && tr.status === 'enroute' && DESTINATIONS[tr.dest].body === body) { const k = ROCKETS[tr.type].module; have[k] = (have[k] ?? 0) + 1; }
  const used = {}, out = [];
  for (const type of planList) {
    const k = ROCKETS[type].module;
    used[k] = (used[k] ?? 0) + 1;
    if ((have[k] ?? 0) < used[k]) out.push(type);
  }
  return out;
};
const nextModule = (s, planList, body) => missingModules(s, planList, body)[0] ?? null;
// Put a pending module on the first spot where one of its ends is within duct reach of a free port, and duct it in.
function autoPlace(s, base, pm) {
  for (let y = 1; y < 28; y++) for (let x = 2; x < 44; x++) for (const rot of [1, 0]) {
    if (!B.canPlace(base, pm.type, x, y, rot)) continue;
    const tiles = B.tilesOf(pm.type, x, y, rot);
    let link = null;
    if (base.modules.length) {
      for (const end of [0, 1]) {
        const tile = end === 0 ? tiles[0] : tiles.at(-1);
        for (const m of base.modules) for (const e of [0, 1]) {
          const id = B.portId(m, e);
          const pt = B.portTile(m, e);
          if (B.portUsed(base, id)) continue;
          const d = Math.abs(pt.x - tile.x) + Math.abs(pt.y - tile.y);
          if (d >= 2 && d <= 8) { link = { end, id }; break; }
        }
        if (link) break;
      }
      if (!link) continue;
    }
    if (!B.placeModule(base, pm.id, x, y, rot)) continue;
    if (link && sim.canSpend(s, 1.5) && B.connect(base, B.portId(base.modules.at(-1), link.end), link.id)) s.cash -= 1.5;
    return true;
  }
  return false;
}
const cargoTypes = ['skyship', 'behemoth', 'peregrineHeavy', 'peregrine9'];
for (let seed = 0; seed < N; seed++) {
  const s = sim.createState(); const ms = {}; let marsCargo = 0, returns = 0; let lunar = 0, lost = 0, launches = 0, idleDays = 0;
  const mark = (k) => { if (!(k in ms)) ms[k] = s.day; };
  const cape = () => s.sites.cape;
  const count = (t) => sim.fleetOf(s, t).length + cape().queue.filter(q => q.type === t).length;
  for (let day = 0; day < DAYS; day++) {
    const nextT = ORDER.map(i => TECH.find(x => x.id === i)).find(t => !s.tech.has(t.id) && sim.techState(s, t.id) === 'available');
    for (const id of ORDER) {
      const t = TECH.find(x => x.id === id); const st = sim.techState(s, id);
      if (st === 'testing') {
        const q = cape().queue.filter(x => x.kind === 'test' && x.tech === id).length;
        if (s.trials[id].articles === 0 && q === 0) sim.queueTest(s, id);
        if (s.trials[id].articles > 0 && !sim.testFlightBlocker(s, id)) { sim.flyTest(s, id); if (s.tech.has(id)) mark(id); }
        break;
      }
      if (st === 'available') { if (sim.canSpend(s, t.cost + 30)) { sim.buyTech(s, id); if (s.tech.has(id)) mark(id); } break; }
    }
    if (sim.rocketUnlocked(s, 'behemoth')) mark('behemoth');
    const reserve = nextT ? Math.min(nextT.cost, 60) : 0;
    // best cargo hull to keep building
    let best = 'peregrine9';
    if (s.tech.has('heavyCores')) best = 'peregrineHeavy';
    if (sim.rocketUnlocked(s, 'behemoth') && (s.flightCounts.behemoth ?? 0) < 3) best = 'behemoth';
    if (s.tech.has('skyship')) best = 'skyship';
    const target = cape().pads.length + 1;
    if (!cargoTypes.some(t => count(t) > 0) && sim.canSpend(s, 12)) sim.queueBuild(s, 'peregrine9');
    if (count(best) < target && sim.canSpend(s, ROCKETS[best].buildCost + reserve)) sim.queueBuild(s, best);
    if (count('peregrine9') < 1 && best !== 'peregrine9' && sim.canSpend(s, 12)) sim.queueBuild(s, 'peregrine9');
    // infrastructure ladder: rent a hangar, buy the site, then grow it
    const hulls = s.fleet.length;
    if (cape().bays.length < 2 && hulls >= 2 && sim.canSpend(s, 3)) sim.addBay(s, 'cape');
    if (cape().status === 'leased' && s.cash > 160 && (hulls >= 3 || sim.rocketUnlocked(s, 'behemoth'))) sim.acquireSite(s, 'cape', 'buy');
    if (cape().status === 'owned') {
      if (cape().pads.length < 2 && s.cash > 140) sim.buyPad(s, 'cape');
      if (cape().pads.length < 3 && s.cash > 400) sim.buyPad(s, 'cape');
      if (cape().bays.length < 3 && hulls >= 3 && s.cash > 100) sim.addBay(s, 'cape');
      if (cape().lines < 2 && s.cash > 200) sim.buyLine(s, 'cape');
      if ((best === 'behemoth' || best === 'skyship') && s.cash > 80) cape().pads.forEach((p, i) => { if (!p.tower && s.cash > 80) sim.buildTower(s, 'cape', i); });
      if (s.tech.has('plants') && cape().plants.methalox < 2 && s.cash > 200 && s.tech.has('skyship')) sim.buildPlant(s, 'cape', 'methalox');
    }
    // license another Skylink market only while the constellation has spare capacity, cheapest first
    for (const m of MARKETS.slice().sort((a, b) => a.license - b.license)) if (!sim.marketBlocker(s, m.id) && s.cash > m.license + 8 && sim.totalLoad(s) < 0.6 * sim.skylinkCapacity(s)) sim.applyLicense(s, m.id);
    if (GEN && s.tech.has('gen2')) mark('gen2');
    if (GEN && MARKETS.some(m => m.cell && s.markets?.[m.id]?.status === 'active')) mark('mobile1');
    // ---- late game: more sites, then a Moon base and a Mars colony from module ships
    const spare = nextT ? Math.min(nextT.cost, 300) : 0;
    if (cape().status === 'owned') {
      if (s.sites.vandenberg.status !== 'owned' && s.cash > 85 + spare + 120) sim.acquireSite(s, 'vandenberg', 'buy');
      if (s.tech.has('skyship') && s.sites.boca.status !== 'owned' && s.cash > 220 + spare + 200) sim.acquireSite(s, 'boca', 'buy');
    }
    const moonPhase = s.tech.has('habitat') && s.tech.has('ice') && s.tech.has('skyship');
    const moonDone = nextModule(s, MOON_PLAN, 'moon') === null;
    const marsPhase = s.tech.has('marsTransit') && moonDone;
    const plan = marsPhase ? MARS_PLAN : moonPhase ? MOON_PLAN : null;
    const body = marsPhase ? 'mars' : 'moon';
    const nextType = plan ? nextModule(s, plan, body) : null;
    if (plan && s.depot.built) { // build every missing ship ahead of time, so a Mars window can send them all
      const miss = missingModules(s, plan, body);
      for (const type of new Set(miss)) if (count(type) < miss.filter((x) => x === type).length && sim.canSpend(s, ROCKETS[type].buildCost + 150)) sim.queueBuild(s, type);
    }
    for (const base of [s.base, s.marsBase]) {
      if (!base) continue;
      for (const pm of [...base.pending]) autoPlace(s, base, pm);
    }
    // keep the tanks
    for (const f of ['kerolox', 'methalox', 'lox', 'steel', 'aluminum']) if (cape().stock[f] < cape().cap[f] * 0.4 && s.market[f] < 1.1) sim.buyCommodity(s, 'cape', f, 200);
    if (s.tech.has('tanker')) {
      if (!s.depot.built && count('skyshipDepot') < 1 && !s.trips.some(t => t.role === 'depot' && t.status === 'enroute')) sim.queueBuild(s, 'skyshipDepot');
      if (count('skyshipTanker') < (nextType ? 6 : 2) && sim.canSpend(s, 60)) sim.queueBuild(s, 'skyshipTanker');
    }
    for (const c of s.contracts) c.acceptedDay ??= s.day; // the bot accepts every contract as it appears
    // Keep the satellite plant busy: a few batches of each researched generation, while cash allows.
    for (const g of [1, 2, 3]) {
      const want = g === 1 ? 48 : 60;
      const inQ = s.satQueue.filter((q) => q.gen === g).length * sim.SAT_BATCH;
      const keepCash = (typeof nextT !== 'undefined' && nextT ? nextT.cost + 12 : 15) + 10;
      if (s.tech.has(SATS_TECH[g]) && s.satQueue.length < 6 && s.satStock[g] + inQ < want && s.cash > keepCash + sim.satBatchCost(g)) sim.queueSats(s, g);
    }
    s.site = 'cape'; // the bot builds and flies its hulls at Cape Canaveral
    let launchedToday = 0;
    for (let k = 0; k < cape().pads.length; k++) {
      // late game duties first: module ships, Mars cargo, the way home, and a full depot
      if (plan && s.depot.built) {
        const w = sim.marsWindow(s.day);
        const baseSite = marsPhase ? 'utopia' : 'shackleton';
        let did = false;
        const base = marsPhase ? s.marsBase : s.base;
        if (nextType && (!marsPhase || w.open)) {
          s.origin = 'earth'; s.manifest = []; s.sats = 0;
          sim.setRocket(s, nextType); sim.setDest(s, baseSite);
          if (sim.nextVehicle(s, nextType) && !sim.launchBlocker(s)) {
            const r = sim.launch(s); launches++;
            if (r.ok) { did = true; if (r.failed) lost++; if (process.env.TRACE) console.log('day', s.day, 'sent', nextType, 'to', baseSite, 'depot', Math.round(s.depot.prop), r.failed ? 'FAILED' : ''); }
          } else if (process.env.TRACE && marsPhase && w.open && s.day % 5 === 0) console.log('day', s.day, 'blocked', nextType, sim.launchBlocker(s) ?? 'no vehicle', 'depot', Math.round(s.depot.prop), 'tankers', sim.fleetOf(s, 'skyshipTanker').length);
        }
        if (!did && marsPhase && base?.modules.length && !nextType) { // modules first: cargo and return flights burn the same depot propellant
          const hull = s.fleet.find((v) => v.site === 'mars' && sim.vehicleState(s, v) === 'ready');
          const rc = s.contracts.filter((c) => c.origin === 'mars').sort((a, b) => b.payout - a.payout)[0];
          if (hull && rc && sim.marsReturnWindow(s.day).open) {
            s.manifest = []; sim.setRocket(s, 'skyship'); s.origin = 'mars'; s.dest = 'leo';
            if (sim.toggleContract(s, rc.id) && !sim.launchBlocker(s)) { const r = sim.launch(s); launches++; if (r.ok) { did = true; returns++; if (r.failed) lost++; } }
            if (!did) { s.manifest = []; s.origin = 'earth'; }
          }
          const mc = s.contracts.filter((c) => c.dest === 'utopia' && c.prop).sort((a, b) => b.payout - a.payout)[0];
          if (!did && w.open && mc && sim.nextVehicle(s, 'skyship')) {
            s.origin = 'earth'; s.manifest = []; sim.setRocket(s, 'skyship'); sim.setDest(s, 'utopia');
            if (sim.toggleContract(s, mc.id) && !sim.launchBlocker(s)) { const r = sim.launch(s); launches++; if (r.ok) { did = true; marsCargo++; if (r.failed) lost++; } }
            if (!did) s.manifest = [];
          }
        }
        const want = marsPhase ? 460 : 300;
        if (!did && s.depot.prop < want && sim.fleetOf(s, 'skyshipTanker').length) {
          s.origin = 'earth'; s.manifest = []; sim.setRocket(s, 'skyshipTanker');
          if (!sim.launchBlocker(s)) { const r = sim.launch(s); launches++; if (r.ok) did = true; }
        }
        if (did) continue;
        s.origin = 'earth'; s.manifest = [];
      }
      // depot / tanker duty first
      if (s.tech.has('tanker')) {
        sim.setRocket(s, 'skyshipDepot');
        if (!s.depot.built && !sim.launchBlocker(s) && sim.fleetOf(s, 'skyshipDepot').length) { sim.launch(s); launches++; continue; }
        const lc = s.contracts.filter(c => c.prop).sort((a, b) => b.payout - a.payout)[0];
        sim.setRocket(s, 'skyshipTanker');
        if (s.depot.built && lc && s.depot.prop < lc.prop + 20 && !sim.launchBlocker(s)) { sim.launch(s); launches++; continue; }
      }
      let done = false;
      for (const type of cargoTypes) {
        if (!sim.nextVehicle(s, type)) continue;
        sim.setRocket(s, type); s.manifest = []; s.sats = 0;
        if (GEN) { s.satGen = 1; for (const g of [3, 2]) if (sim.satGenOk(s, g) && s.satStock[g] > 0) { s.satGen = g; break; } }
        s.recovery = !s.tech.has('landing') ? 'expend' : type === 'peregrineHeavy' && s.tech.has('droneship') && sim.freeDroneship(s) >= 0 ? 'drone' : 'rtls';
        const cap = sim.capacity(s);
        let bestPlan = null;
        for (const dest of [...EARTH_ORBITS, ...(type === 'skyship' ? LUNAR_DESTS : [])]) {
          if (!sim.destUnlocked(s, dest)) continue;
          sim.setDest(s, dest); s.manifest = []; s.sats = 0;
          let prop = s.depot.built ? s.depot.prop : 0;
          const cs = s.contracts.filter(c => c.dest === dest).sort((a, b) => b.payout / b.mass - a.payout / a.mass);
          const picked = [];
          for (const c of cs) { s.manifest.push(c.id); const t = sim.manifestTotals(s); if (t.mass > cap.mass || t.volume > cap.volume || sim.tliNeed(s) > prop) s.manifest.pop(); else picked.push(c.id); }
          const pay = sim.manifestTotals(s).payout;
          if (SAT_DESTS.includes(dest) && s.tech.has('gen1')) {
            const keep = nextT ? nextT.cost + 12 : 15;
            for (let q = 0; q < 80; q++) { sim.adjustSats(s, 6); const t = sim.manifestTotals(s); if (t.mass > cap.mass || t.volume > cap.volume || sim.launchCost(s) + keep > s.cash) { sim.adjustSats(s, -6); break; } }
          }
          const score = pay + s.sats * 0.1;
          if (score > 0 && (!bestPlan || score > bestPlan.score)) bestPlan = { score, dest, picked: [...picked], sats: s.sats };
          s.manifest = []; s.sats = 0;
        }
        if (!bestPlan || (type === 'behemoth' && bestPlan.score < 22)) continue;
        sim.setDest(s, bestPlan.dest); s.manifest = [...bestPlan.picked];
        if (bestPlan.sats) sim.adjustSats(s, bestPlan.sats);
        s._lockDay = s.day - 9; // the bot keeps satellites in stock at the site and accepts contracts as they appear
        if (sim.launchBlocker(s)) { delete s._lockDay; s.manifest = []; s.sats = 0; continue; }
        const isLunar = DESTINATIONS[bestPlan.dest].body === 'moon';
        const r = sim.launch(s); launches++; done = true;
        if (r.failed) lost++; else if (isLunar) { lunar++; mark('lunar1'); }
        break;
      }
      if (!done) idleDays++;
    }
    sim.tick(s);
    if (s.tech.has('isru')) mark('allTech');
    if (s.tech.has('marsTransit')) mark('marsTech');
    if (s.marsBase?.modules.length) mark('marsBaseDay');
    if ((s.marsBase?.stock.methalox ?? 0) >= 1) mark('marsFuelDay');
    for (const [k, v] of [['cash100', 100], ['cash275', 275], ['cash485', 485], ['cash1000', 1000]]) if (s.cash >= v) mark(k); // 275 ~ a minimal Vermilion build-out, 485 ~ Boca Chica
  }
  const gDay = process.env.GOALS ? Object.fromEntries(Object.entries(s.goals).map(([k, v]) => [`g:${k}`, v])) : {};
  const chDay = Object.fromEntries(CHAPTERS.map((c) => [`ch:${c.id}`, c.goals.every((g) => s.goals[g.id] != null) ? Math.max(...c.goals.map((g) => s.goals[g.id])) : undefined]));
  if (process.env.DEBUG) {
    const status = (b) => (b ? JSON.stringify({ mods: b.modules.map((m) => m.type + (m.crew ?? '')).join(' '), stock: Object.fromEntries(Object.entries(b.stock).map(([k, v]) => [k, Math.round(v)])) }) : 'none');
    console.log('RUN', seed, 'cargo', marsCargo, 'returns', returns, 'colonyDays', s.colonyDays, 'missing', colonyCheck(s).missing.join('; '), '\n  moon', status(s.base), '\n  mars', status(s.marsBase), '\n  cash', Math.round(s.cash), 'tech', [...s.tech].length);
  }
  const modLost = s.trips.filter((x) => x.role === 'module' && x.status === 'lost').length;
  out.push({ ...ms, modLost, marsCargo, returns, ...chDay, ...gDay, rev: +sim.dailyRevenue(s).toFixed(2), mobRev: +MARKETS.filter(m => m.cell).reduce((a, m) => a + sim.marketRevenue(s, m), 0).toFixed(2), cap: sim.skylinkCapacity(s), load: +sim.totalLoad(s).toFixed(1), q: +sim.skylinkQuality(s).toFixed(2), lunar, lost, cash: Math.round(s.cash), launches, fleet: s.fleet.length, income: +s.income.toFixed(2), idle: idleDays });
}
const med = (k) => { const v = out.map(o => o[k]).filter(x => x != null).sort((a, b) => a - b); return v.length ? `${v[Math.floor(v.length / 2)]} (${v[0]}-${v[v.length - 1]}, n=${v.length})` : 'never'; };
for (const k of ['marsTech', 'marsBaseDay', 'marsFuelDay', 'modLost', 'marsCargo', 'returns', ...CHAPTERS.map((c) => `ch:${c.id}`), ...(process.env.GOALS ? CHAPTERS.flatMap((c) => c.goals.map((g) => `g:${g.id}`)) : []), 'landing','fastCores','heavyCores','behemoth','skyship','tanker','lunar1','allTech','cash100','cash275','cash485','cash1000','gen2','mobile1','rev','mobRev','cap','load','q','lunar','launches','lost','cash','income','fleet']) console.log(k.padEnd(11), med(k));
