// Play-through bot: plays the whole tech tree headless and prints median days to milestones.
// usage: node tools/pacing-bot.mjs [runs] [days]
import * as sim from '../src/sim.js';
import { MARKETS, TECH, ROCKETS, EARTH_ORBITS, LUNAR_DESTS, SAT_DESTS, DESTINATIONS } from '../src/data.js';
const ORDER = ['landing','gen1','fastCores','heavyCores','hull','raptor','tiles','skyship','plants','tanker','habitat','isru'];
const N = +process.argv[2] || 20, DAYS = +process.argv[3] || 2500;
const out = [];
const cargoTypes = ['skyship', 'behemoth', 'peregrineHeavy', 'peregrine9'];
for (let seed = 0; seed < N; seed++) {
  const s = sim.createState(); const ms = {}; let lunar = 0, lost = 0, launches = 0, idleDays = 0;
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
    for (const m of MARKETS.slice().sort((a, b) => a.license - b.license)) if (!sim.marketBlocker(s, m.id) && s.cash > m.license + 8 && sim.totalSubs(s) < 0.6 * sim.skylinkCapacity(s)) sim.applyLicense(s, m.id);
    // keep the tanks stocked while prices are good
    for (const f of ['kerolox', 'methalox', 'lox', 'steel', 'aluminum']) if (cape().stock[f] < cape().cap[f] * 0.4 && s.market[f] < 1.1) sim.buyCommodity(s, 'cape', f, 200);
    if (s.tech.has('tanker')) {
      if (!s.depot.built && count('skyshipDepot') < 1 && !s.trips.some(t => t.role === 'depot' && t.status === 'enroute')) sim.queueBuild(s, 'skyshipDepot');
      if (count('skyshipTanker') < 2 && sim.canSpend(s, 60)) sim.queueBuild(s, 'skyshipTanker');
    }
    for (const c of s.contracts) c.acceptedDay ??= s.day; // the bot accepts every contract as it appears
    let launchedToday = 0;
    for (let k = 0; k < cape().pads.length; k++) {
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
            for (let q = 0; q < 10; q++) { sim.adjustSats(s, 6); const t = sim.manifestTotals(s); if (t.mass > cap.mass || t.volume > cap.volume || sim.launchCost(s) + keep > s.cash) { sim.adjustSats(s, -6); break; } }
          }
          const score = pay + s.sats * 0.1;
          if (score > 0 && (!bestPlan || score > bestPlan.score)) bestPlan = { score, dest, picked: [...picked], sats: s.sats };
          s.manifest = []; s.sats = 0;
        }
        if (!bestPlan || (type === 'behemoth' && bestPlan.score < 22)) continue;
        sim.setDest(s, bestPlan.dest); s.manifest = [...bestPlan.picked];
        if (bestPlan.sats) sim.adjustSats(s, bestPlan.sats);
        if (sim.launchBlocker(s)) { s.manifest = []; s.sats = 0; continue; }
        const isLunar = DESTINATIONS[bestPlan.dest].body === 'moon';
        const r = sim.launch(s); launches++; done = true;
        if (r.failed) lost++; else if (isLunar) { lunar++; mark('lunar1'); }
        break;
      }
      if (!done) idleDays++;
    }
    sim.tick(s);
    if (s.tech.has('isru')) mark('allTech');
    for (const [k, v] of [['cash100', 100], ['cash275', 275], ['cash485', 485], ['cash1000', 1000]]) if (s.cash >= v) mark(k); // 275 ~ a minimal Vermilion build-out, 485 ~ Boca Chica
  }
  out.push({ ...ms, lunar, lost, cash: Math.round(s.cash), launches, fleet: s.fleet.length, income: +s.income.toFixed(2), idle: idleDays });
}
const med = (k) => { const v = out.map(o => o[k]).filter(x => x != null).sort((a, b) => a - b); return v.length ? `${v[Math.floor(v.length / 2)]} (${v[0]}-${v[v.length - 1]}, n=${v.length})` : 'never'; };
for (const k of ['landing','fastCores','heavyCores','behemoth','skyship','tanker','lunar1','allTech','cash100','cash275','cash485','cash1000','lunar','launches','lost','cash','income','fleet']) console.log(k.padEnd(11), med(k));
