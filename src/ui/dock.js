// The docked control panels (Mission, Fleet, Factory, R&D, Skylink). Each one draws a plain function of the game state.
import {
  ROCKETS, REGIONS, TECH, DESTINATIONS, BODIES, SAT_DESTS, PAD_NAMES, PAD_COSTS, LINE_COSTS,
  DEPOT_CAP, TANKER_LOAD, TANKER_PROP_COST, MODULES, DRONE_POLICIES, STOCK_PRICES, STOCK_KEEP, LOCAL_RECIPES, DUCT_COST,
} from '../data.js';
import * as sim from '../sim.js';
import * as B from '../base.js';
import { COL, hex } from './ui.js';

const stateColor = { ready: COL.good, refit: COL.warn, flying: COL.accent };

export function renderMission(ui, s, X, Y, W, actions) {
  const r = sim.rocketDef(s);
  const eff = sim.effDest(s);
  const ed = DESTINATIONS[eff];
  const payload = r.role === 'payload';

  ui.heading(X, Y, 'DESTINATION  ·  click an orbit or a pin on the map');
  ui.label(X, Y + 16, ed.name, { size: 18, bold: true });
  ui.label(X + W, Y + 21, `${BODIES[ed.body].name}  ·  ${ed.kind === 'site' ? 'landing site' : 'orbit'}  ·  ${ed.days} day${ed.days > 1 ? 's' : ''} one way`, {
    size: 12, right: true, color: COL.dimText,
  });
  let req = 'No propellant needed. Any vehicle can fly here.';
  let reqColor = COL.dimText;
  if (!sim.destUnlocked(s, eff)) {
    req = `Locked: research ${TECH.find((t) => t.id === ed.locked).name}.`;
    reqColor = hex(COL.bad);
  } else if (ed.body !== 'earth') {
    req = `Needs a Skyship and ${ed.prop} t of depot propellant per tonne of payload.`;
    reqColor = hex(COL.warn);
  }
  if (r.role === 'module') { req = 'Module ships land at a Moon landing site and stay there as a base module.'; reqColor = hex(COL.warn); }
  else if (!payload) { req = 'Tankers and depot ships always work in LEO.'; reqColor = COL.dimText; }
  ui.label(X, Y + 44, req, { size: 12, color: reqColor });

  // Vehicle selector
  ui.heading(X, Y + 68, 'VEHICLE');
  const types = Object.keys(ROCKETS).filter((id) => sim.fleetOf(s, id).length || id === s.rocket);
  const bw = (W - (types.length - 1) * 5) / types.length;
  types.forEach((id, i) => {
    const total = sim.fleetOf(s, id).length;
    const ready = sim.readyVehicles(s, id).length;
    const on = id === s.rocket;
    ui.button(X + i * (bw + 5), Y + 84, bw, 30, `${ROCKETS[id].short} ${ready}/${total}`, () => actions.pickRocket(id), {
      size: 12, fill: on ? COL.btnOn : COL.btn, stroke: on ? COL.good : COL.accent,
      hint: `${ROCKETS[id].name}: ${ready} of ${total} ready.`,
    });
  });
  const v = sim.nextVehicle(s, s.rocket);
  const cap = sim.capacity(s);
  const risk = Math.round(sim.failChance(s) * 100);
  if (v) {
    const proto = s.rocket === 'behemoth' ? ' (prototype)' : '';
    ui.label(X, Y + 122, `Next: ${v.serial}  ·  ${v.flights}/${r.coreLife} flights  ·  risk ~${risk}%${proto}`, { size: 12, color: COL.dimText });
  } else {
    ui.label(X, Y + 122, sim.fleetOf(s, s.rocket).length ? 'No hull ready: refit or in flight.' : 'None in the fleet. Build one in the Factory tab.', { size: 12, color: hex(COL.warn) });
  }
  if (payload && !r.catch) {
    ui.label(X + W - 150, Y + 122, 'Recovery', { size: 11, color: COL.dimText });
    ui.button(X + W - 96, Y + 118, 46, 22, 'RTLS', () => { s.recovery = 'rtls'; }, {
      size: 11, fill: s.recovery === 'rtls' ? COL.btnOn : COL.btn, stroke: s.recovery === 'rtls' ? COL.good : COL.accent,
      hint: 'RTLS: -2 days turnaround, but -20% payload (fuel reserve).',
    });
    ui.button(X + W - 46, Y + 118, 46, 22, 'Drone', () => { s.recovery = 'drone'; }, {
      size: 11, fill: s.recovery === 'drone' ? COL.btnOn : COL.btn, stroke: s.recovery === 'drone' ? COL.good : COL.accent,
      hint: 'Droneship: full payload, longer turnaround, $0.3M fee.',
    });
  }

  if (!payload) {
    ui.heading(X, Y + 150, r.role === 'tanker' ? 'TANKER RUN' : r.role === 'module' ? 'MODULE DELIVERY' : 'DEPOT DEPLOYMENT');
    const need = sim.modulePropNeed(s);
    const lines = r.role === 'module'
      ? [`This hull becomes a ${MODULES[r.module].name} on your Moon base. ${MODULES[r.module].blurb}`,
        s.base ? `Your base is at ${DESTINATIONS[s.base.site].name}: pick that site on the Moon map.` : 'The first module ship founds the base at the Moon site you pick on the map.',
        `Burns ${need} t of depot propellant at launch (depot: ${Math.floor(s.depot.prop)} t).`]
      : r.role === 'tanker'
      ? [`Delivers ${TANKER_LOAD} t of CH4/LOX to the LEO depot ($${TANKER_PROP_COST}M of propellant per run).`,
        `Depot: ${Math.floor(s.depot.prop)} / ${DEPOT_CAP} t.`,
        s.depot.built ? 'Lunar cargo burns propellant from the depot at launch.' : 'The depot has to be deployed first.']
      : ['Deploys a depot Skyship into LEO. The hull stays on station and becomes the propellant depot.',
        `It holds ${DEPOT_CAP} t and boils off 0.4% per day, so fill it close to when you need it.`,
        'Single use: you only need one.'];
    lines.forEach((l, i) => ui.label(X, Y + 172 + i * 22, l, { size: 13, color: i ? COL.dimText : COL.text, wrap: W }));
  } else {
    renderContractsAndManifest(ui, s, X, Y + 146, W, actions);
  }

  const blocker = sim.launchBlocker(s);
  ui.button(X, Y + 380, W, 40, blocker ? `LAUNCH  (${blocker})` : `LAUNCH to ${ed.name}  ($${sim.launchCost(s)}M)`, () => actions.launch(), {
    enabled: !blocker, fill: 0x7a2a1d, stroke: COL.bad, size: blocker ? 12 : 15,
  });
}

function renderContractsAndManifest(ui, s, X, Y, W, actions) {
  ui.heading(X, Y, 'CONTRACTS  ·  click to load  ·  one destination per launch');
  const sorted = [...s.contracts].sort((a, b) => (b.dest === s.dest) - (a.dest === s.dest) || b.payout - a.payout);
  sorted.slice(0, 6).forEach((c, i) => {
    const y = Y + 16 + i * 26;
    const on = s.manifest.includes(c.id);
    const match = c.dest === s.dest;
    const d = DESTINATIONS[c.dest];
    ui.row(X, y, W, 24, {
      on, onClick: () => actions.toggleContract(c.id),
      hint: `${c.customer} → ${d.name}. Expires day ${c.expires}.${c.prop ? ` Burns ${c.prop} t of depot propellant.` : ''}`,
    });
    const dim = match ? COL.text : COL.dimText;
    ui.label(X + 8, y + 5, c.customer, { size: 12, bold: true, color: dim });
    ui.label(X + 160, y + 5, d.name, { size: 12, color: c.prop ? hex(COL.accent) : dim });
    ui.label(X + 330, y + 5, `${c.mass} t`, { size: 12, color: dim });
    ui.label(X + 385, y + 5, `${c.volume} m³`, { size: 12, color: dim });
    ui.label(X + W - 8, y + 4, `$${c.payout}M`, { size: 13, bold: true, color: hex(COL.good), right: true });
  });
  if (!s.contracts.length) ui.label(X, Y + 22, 'No contracts on the board. New ones arrive every few days.', { size: 12, color: COL.dimText });
  if (s.contracts.length > 6) ui.label(X + W, Y, `+${s.contracts.length - 6} more`, { size: 11, color: COL.dimText, right: true });

  const my = Y + 178;
  const t = sim.manifestTotals(s);
  const cap = sim.capacity(s);
  const fit = (v, c) => (v > c ? COL.bad : v / c > 0.85 ? COL.warn : COL.good);
  const half = (W - 12) / 2;
  ui.label(X, my, `Mass ${t.mass} / ${cap.mass} t`, { size: 12 });
  ui.bar(X, my + 17, half, 8, t.mass / cap.mass, fit(t.mass, cap.mass));
  ui.label(X + half + 12, my, `Volume ${t.volume} / ${cap.volume} m³`, { size: 12 });
  ui.bar(X + half + 12, my + 17, half, 8, t.volume / cap.volume, fit(t.volume, cap.volume));

  const need = sim.tliNeed(s);
  const gen1 = s.tech.has('gen1');
  const satsOk = SAT_DESTS.includes(s.dest);
  const ry = my + 32;
  if (need) {
    ui.label(X, ry + 3, `Payout $${t.payout}M  ·  TLI propellant ${need} t needed, depot ${Math.floor(s.depot.prop)} t`, {
      size: 12, color: hex(s.depot.prop >= need && s.rocket === 'skyship' ? COL.good : COL.warn),
    });
  } else if (gen1 && satsOk) {
    const region = REGIONS.find((x) => x.id === s.region);
    ui.label(X, ry + 3, `Payout $${t.payout}M  ·  Skylink sats ${s.sats}`, { size: 12, color: hex(COL.good) });
    ui.button(X + 250, ry, 170, 22, `To ${region.name}`, () => actions.cycleRegion(), { size: 11, hint: 'Click to change the target region.' });
    ui.button(X + 428, ry, 50, 22, `-${sim.SAT_BATCH}`, () => sim.adjustSats(s, -sim.SAT_BATCH), { enabled: s.sats > 0, size: 11 });
    ui.button(X + 486, ry, 50, 22, `+${sim.SAT_BATCH}`, () => sim.adjustSats(s, sim.SAT_BATCH), { enabled: s.sats < sim.rocketDef(s).sats, size: 11 });
  } else {
    ui.label(X, ry + 3, `Payout $${t.payout}M${gen1 ? '  ·  Skylink satellites ride to LEO or Polar LEO' : '  ·  Research Skylink Gen-1 for satellite batches'}`, {
      size: 12, color: COL.dimText,
    });
  }
}

export function renderFleet(ui, s, X, Y, W, actions) {
  ui.heading(X, Y, `LAUNCH PADS  ·  ${s.pads.length}/${PAD_NAMES.length}`);
  PAD_NAMES.forEach((name, i) => {
    const y = Y + 18 + i * 28;
    const pad = s.pads[i];
    if (pad) {
      const left = pad.busyUntil - s.day;
      ui.row(X, y, W, 24);
      ui.label(X + 10, y + 5, name, { size: 13, bold: true });
      ui.label(X + W - 10, y + 5, left > 0 ? `busy ${left}d` : 'READY', { size: 13, right: true, color: hex(left > 0 ? COL.warn : COL.good) });
    } else if (i === s.pads.length) {
      ui.row(X, y, W, 24, { fill: 0x0a101c });
      ui.label(X + 10, y + 5, `${name}  (not built)`, { size: 13, color: COL.dimText });
      ui.button(X + W - 130, y + 1, 128, 22, `Build $${PAD_COSTS[i]}M`, () => actions.buyPad(), { enabled: sim.canSpend(s, PAD_COSTS[i]), size: 12 });
    }
  });

  const hy = Y + 112;
  ui.heading(X, hy, `HULLS  ·  ${s.fleet.length}`);
  if (!s.fleet.length) ui.label(X, hy + 20, 'No hulls. Queue one in the Factory tab.', { size: 13, color: hex(COL.warn) });
  const sorted = [...s.fleet].sort((a, b) => a.type.localeCompare(b.type) || a.serial.localeCompare(b.serial));
  sorted.slice(0, 11).forEach((v, i) => {
    const y = hy + 18 + i * 26;
    const st = sim.vehicleState(s, v);
    const r = ROCKETS[v.type];
    ui.row(X, y, W, 24, { on: v.type === s.rocket && st === 'ready' && v === sim.nextVehicle(s, v.type) });
    ui.label(X + 8, y + 5, v.serial, { size: 12, bold: true });
    ui.label(X + 78, y + 5, r.name, { size: 12, color: COL.dimText });
    const days = st === 'ready' ? '' : ` ${Math.max(1, (st === 'flying' ? v.returnDay : v.readyDay) - s.day)}d`;
    ui.label(X + 250, y + 5, `${st}${days}`, { size: 12, color: hex(stateColor[st]) });
    const wear = v.flights / r.coreLife;
    ui.bar(X + 340, y + 8, 120, 8, wear, wear > 0.7 ? COL.bad : wear > 0.4 ? COL.warn : COL.good);
    ui.label(X + W - 8, y + 5, `${v.flights}/${r.coreLife}`, { size: 12, right: true, color: COL.dimText });
  });
  if (sorted.length > 11) ui.label(X, hy + 18 + 11 * 26, `+${sorted.length - 11} more hulls`, { size: 12, color: COL.dimText });
}

export function renderFactory(ui, s, X, Y, W, actions) {
  ui.heading(X, Y, `PRODUCTION LINES  ·  ${s.lines}/${LINE_COSTS.length}`);
  const next = LINE_COSTS[s.lines];
  if (next !== undefined) {
    ui.button(X + W - 190, Y - 4, 190, 24, `Add line  $${next}M`, () => actions.buyLine(), { enabled: sim.canSpend(s, next), size: 12 });
  }
  ui.heading(X, Y + 28, `BUILD QUEUE  ·  ${s.queue.length}`);
  if (!s.queue.length) ui.label(X, Y + 48, 'Nothing in production. Pick a vehicle below.', { size: 13, color: COL.dimText });
  s.queue.slice(0, 4).forEach((q, i) => {
    const y = Y + 46 + i * 28;
    const r = ROCKETS[q.type];
    const working = i < s.lines;
    ui.row(X, y, W, 25);
    ui.label(X + 8, y + 6, r.name, { size: 12, bold: true });
    ui.bar(X + 190, y + 8, 190, 9, (q.total - q.daysLeft) / q.total, working ? COL.accent : COL.dim);
    ui.label(X + 392, y + 6, working ? `${q.daysLeft}d left` : 'waiting', { size: 12, color: COL.dimText });
    if (q.daysLeft === q.total) ui.button(X + W - 74, y + 2, 72, 21, 'Cancel', () => actions.cancelBuild(q.id), { size: 11, hint: 'Refunds 50% of the build cost.' });
  });
  if (s.queue.length > 4) ui.label(X, Y + 46 + 4 * 28, `+${s.queue.length - 4} more queued`, { size: 12, color: COL.dimText });

  const by = Y + 176;
  ui.heading(X, by, 'BUILD');
  const types = Object.keys(ROCKETS);
  const cw = (W - 8) / 2;
  types.forEach((id, i) => {
    const r = ROCKETS[id];
    const blocker = sim.buildBlocker(s, id);
    const x = X + (i % 2) * (cw + 8);
    const y = by + 18 + Math.floor(i / 2) * 31;
    ui.button(x, y, cw, 27, blocker === 'Locked' ? `${r.role === 'module' ? r.name : r.short}: locked` : `${r.role === 'module' ? r.name : r.short}  $${r.buildCost}M · ${r.buildDays}d`, () => actions.queueBuild(id), {
      enabled: !blocker, size: 12,
      hint: blocker && blocker !== 'Locked' ? `${r.name}: ${blocker}` : `${r.name}: ${r.payload ? `${r.payload} t, ` : ''}rated ${r.coreLife} flight${r.coreLife > 1 ? 's' : ''}. ${r.buildDays} days to build.`,
    });
  });
}

export function renderTech(ui, s, X, Y, W, actions) {
  TECH.forEach((t, i) => {
    const y = Y + i * 38;
    const st = sim.techState(s, t.id);
    const afford = sim.canSpend(s, t.cost);
    const stroke = st === 'owned' ? COL.good : st === 'available' && afford ? COL.accent : COL.line;
    ui.row(X, y, W, 35, {
      stroke, fill: st === 'owned' ? 0x123524 : COL.row,
      onClick: st === 'available' && afford ? () => actions.buyTech(t.id) : null,
      hint: st === 'locked' ? `${t.name} needs: ${sim.techBlockers(s, t.id).join(', ')}` : t.desc,
    });
    const dim = st === 'locked';
    ui.label(X + 10, y + 3, t.name, { size: 13, bold: true, color: dim ? COL.dimText : COL.text });
    const sub = st === 'locked' ? `Needs: ${sim.techBlockers(s, t.id).join(', ')}` : t.desc;
    ui.label(X + 10, y + 19, sub, { size: 11, color: COL.dimText });
    ui.label(X + W - 10, y + 8, st === 'owned' ? 'DONE' : `$${t.cost}M`, {
      size: 13, bold: true, right: true, color: st === 'owned' ? hex(COL.good) : afford || dim ? COL.dimText : hex(COL.bad),
    });
  });
}

export function renderSkylink(ui, s, X, Y, W, actions) {
  ui.heading(X, Y, 'SKYLINK COVERAGE  ·  click to set the target region for the next satellite batch');
  REGIONS.forEach((r, i) => {
    const y = Y + 22 + i * 40;
    const cov = sim.coverage(s, r);
    const sel = s.region === r.id;
    ui.row(X, y, W, 36, { on: sel, onClick: () => actions.pickRegion(r.id) });
    ui.label(X + 10, y + 9, r.name, { size: 14, bold: sel });
    ui.bar(X + 190, y + 13, 180, 11, cov, cov < 0.3 ? COL.bad : cov < 0.7 ? COL.warn : COL.good);
    ui.label(X + 382, y + 9, `${Math.round(cov * 100)}%`, { size: 13 });
    ui.label(X + W - 10, y + 9, `$${sim.regionRevenue(s, r).toFixed(2)}M/day`, { size: 13, right: true, color: COL.dimText });
  });
  const total = sim.dailyRevenue(s);
  ui.label(X, Y + 22 + 6 * 40 + 8, `Total: $${total.toFixed(2)}M/day  ·  overhead $${sim.OVERHEAD_PER_DAY}M/day`, { size: 14, bold: true, color: hex(COL.good) });
  ui.label(X, Y + 22 + 6 * 40 + 32, 'Satellites decay over 5 years. Keep launching batches to LEO or Polar LEO to hold coverage.', { size: 12, color: COL.dimText, wrap: W });
}

// ---- Moon base --------------------------------------------------------------------------------------

export function renderBase(ui, s, X, Y, W, actions, ctx) {
  const base = s.base;
  if (!base) {
    ui.heading(X, Y, 'MOON BASE');
    [
      'No base yet.',
      'Research Moon Habitat Core, build a Habitat Skyship in the Factory, and fly it to a Moon landing site.',
      'The first module ship founds the base at the site you choose on the Moon map. Every later module goes to the same site.',
      'Module ships burn depot propellant, so fill the LEO depot first.',
    ].forEach((l, i) => ui.label(X, Y + 22 + i * 26, l, { size: i ? 13 : 16, bold: !i, color: i ? COL.dimText : COL.text, wrap: W }));
    return;
  }
  const site = DESTINATIONS[base.site].name;
  ui.label(X, Y, `Base at ${site}`, { size: 17, bold: true });
  const open = ctx.view !== 'closed';
  ui.button(X + W - 150, Y - 3, 150, 26, open ? 'Close base view' : 'Open base view', () => (open ? actions.closeBase() : actions.openBase()), { size: 12 });
  ['control', 'modules'].forEach((id, i) => {
    ui.button(X + i * 108, Y + 28, 102, 22, id === 'control' ? 'Control' : 'Modules', () => actions.baseSub(id), {
      size: 12, fill: ctx.sub === id ? COL.btnOn : COL.btn, stroke: ctx.sub === id ? COL.good : COL.accent,
    });
  });
  const y0 = Y + 58;
  if (ctx.sub === 'modules') renderBaseModules(ui, s, X, y0, W, actions);
  else renderBaseControl(ui, s, X, y0, W, actions, ctx);
}

function renderBaseControl(ui, s, X, Y, W, actions, ctx) {
  const base = s.base;
  const st = B.baseStatus(base);
  const powerOk = st.supply >= st.demand && st.unpowered === 0;
  ui.label(X, Y, `Power ${st.supply.toFixed(2)} / ${st.demand.toFixed(2)} MW`, { size: 13, bold: true, color: hex(powerOk ? COL.good : COL.bad) });
  ui.label(X + 190, Y, `Crew ${st.crew}`, { size: 13, bold: true });
  ui.label(X + 270, Y, `Drones ${st.drones}`, { size: 13, bold: true });
  ui.label(X + 360, Y, `${st.networks} network${st.networks === 1 ? '' : 's'}`, { size: 13, color: hex(st.networks > 1 ? COL.warn : COL.dim) });
  if (st.unpowered) ui.label(X + W, Y, `${st.unpowered} unpowered`, { size: 12, right: true, color: hex(COL.bad) });

  ui.label(X, Y + 28, 'Drone focus', { size: 12, color: COL.dimText });
  Object.entries(DRONE_POLICIES).forEach(([id, p], i) => {
    ui.button(X + 90 + i * 100, Y + 24, 94, 24, p.name, () => actions.setPolicy(id), {
      size: 12, fill: base.policy === id ? COL.btnOn : COL.btn, stroke: base.policy === id ? COL.good : COL.accent, hint: p.hint,
    });
  });

  ui.heading(X, Y + 60, `MODULES WAITING  ·  ${base.pending.length}`);
  if (!base.pending.length) ui.label(X, Y + 80, 'None. Fly module ships to the site, or build modules with a Fabricator.', { size: 12, color: COL.dimText });
  base.pending.slice(0, 4).forEach((p, i) => {
    const y = Y + 78 + i * 26;
    const on = ctx.mode.kind === 'place' && ctx.mode.pendingId === p.id;
    ui.row(X, y, W, 23, { on });
    ui.label(X + 8, y + 4, MODULES[p.type].name, { size: 13, bold: true });
    ui.label(X + 150, y + 5, `${MODULES[p.type].len} tiles · ${MODULES[p.type].blurb}`, { size: 11, color: COL.dimText });
    ui.button(X + W - 80, y + 1, 78, 21, on ? 'Placing' : 'Place', () => actions.startPlace(p.id), { size: 11 });
  });
  if (base.pending.length > 4) ui.label(X + W, Y + 78 + 4 * 26, `+${base.pending.length - 4} more`, { size: 11, right: true, color: COL.dimText });

  const hint = ctx.mode.kind === 'place' ? 'Click the grid to place. R rotates. Right click or Esc cancels.'
    : ctx.mode.kind === 'duct' ? 'Click a port, then a second port. Right click or Esc stops.' : '';
  if (hint) ui.label(X, Y + 186, hint, { size: 12, color: hex(COL.warn) });

  ui.button(X, Y + 208, 230, 28, ctx.mode.kind === 'duct' ? 'Stop connecting' : `Connect ducts ($${DUCT_COST}M each)`, () => actions.toggleDuct(), {
    size: 12, fill: ctx.mode.kind === 'duct' ? COL.btnOn : COL.btn, stroke: ctx.mode.kind === 'duct' ? COL.good : COL.accent,
    hint: 'Ducts join the ports at the ends of two modules. Only connected modules share power and crew.',
  });
  ui.button(X + 240, Y + 208, 110, 28, 'Rotate (R)', () => actions.rotate(), { size: 12, enabled: ctx.mode.kind === 'place' });
  ui.label(X + W, Y + 215, `${base.ducts.length} duct${base.ducts.length === 1 ? '' : 's'}`, { size: 12, right: true, color: COL.dimText });

  ui.heading(X, Y + 248, 'STOCKPILE');
  const stock = base.stock;
  [['Regolith', stock.regolith], ['Oxygen', stock.oxygen], ['Iron', stock.iron], ['Silica', stock.silica]].forEach(([name, v], i) => {
    ui.label(X + i * 134, Y + 266, `${name}`, { size: 11, color: COL.dimText });
    ui.label(X + i * 134, Y + 280, `${v.toFixed(1)} t`, { size: 15, bold: true });
  });
  const surplus = Object.entries(STOCK_PRICES).reduce((n, [r, price]) => n + Math.max(0, stock[r] - STOCK_KEEP[r]) * price, 0);
  ui.button(X, Y + 308, 250, 26, `Sell surplus  ($${surplus.toFixed(1)}M)`, () => actions.sellSurplus(), {
    size: 12, enabled: surplus >= 0.1, hint: `Keeps ${STOCK_KEEP.oxygen} t oxygen, ${STOCK_KEEP.iron} t iron and ${STOCK_KEEP.silica} t silica for local building.`,
  });
  if (base.lastSpe) {
    ui.label(X + W, Y + 314, `Last solar storm: day ${base.lastSpe.day}, ${base.lastSpe.dead} crew lost`, { size: 12, right: true, color: hex(base.lastSpe.dead ? COL.bad : COL.dim) });
  }
}

function renderBaseModules(ui, s, X, Y, W, actions) {
  const base = s.base;
  const { byModule } = B.analyze(base);
  ui.heading(X, Y, `MODULES  ·  ${base.modules.length}`);
  if (!base.modules.length) ui.label(X, Y + 20, 'Nothing placed yet. Place a pending module from the Control tab.', { size: 12, color: COL.dimText });
  base.modules.slice(0, 7).forEach((m, i) => {
    const y = Y + 18 + i * 25;
    const net = byModule.get(m.id);
    const def = MODULES[m.type];
    ui.row(X, y, W, 23);
    ui.label(X + 8, y + 4, def.name, { size: 12, bold: true });
    ui.bar(X + 120, y + 7, 100, 8, m.cover, m.cover > 0.7 ? COL.good : m.cover > 0.3 ? COL.warn : COL.bad);
    ui.label(X + 228, y + 4, `${Math.round(m.cover * 100)}% buried`, { size: 11, color: COL.dimText });
    ui.label(X + W - 8, y + 4, net.powerFactor > 0 ? `${def.crew ? `crew ${m.crew}/${def.crew} · ` : ''}powered ${Math.round(net.powerFactor * 100)}%${def.need ? ` · staffed ${Math.round(net.staffFactor * 100)}%` : ''}` : 'NO POWER', {
      size: 11, right: true, color: hex(net.powerFactor > 0 ? COL.good : COL.bad),
    });
  });
  if (base.modules.length > 7) ui.label(X, Y + 18 + 7 * 25, `+${base.modules.length - 7} more`, { size: 11, color: COL.dimText });

  const fy = Y + 208;
  ui.heading(X, fy, 'FABRICATOR  ·  build modules from local materials');
  const hasFab = base.modules.some((m) => m.type === 'fab');
  if (!hasFab) {
    ui.label(X, fy + 20, 'Needs a Fabricator module (research Lunar ISRU Mining).', { size: 12, color: COL.dimText });
    return;
  }
  const cw = (W - 8) / 2;
  Object.entries(LOCAL_RECIPES).forEach(([type, r], i) => {
    const blocker = B.recipeBlocker(s, type);
    ui.button(X + (i % 2) * (cw + 8), fy + 18 + Math.floor(i / 2) * 32, cw, 28, `${MODULES[type].name}  Fe${r.iron} Si${r.silica} O${r.oxygen} $${r.cash}M`, () => actions.queueLocal(type), {
      size: 11, enabled: !blocker, hint: blocker ? `${MODULES[type].name}: ${blocker}` : `${MODULES[type].name}: ${r.days} days.`,
    });
  });
  base.fabQueue.slice(0, 3).forEach((q, i) => {
    const y = fy + 86 + i * 24;
    ui.row(X, y, W, 21);
    ui.label(X + 8, y + 3, MODULES[q.type].name, { size: 12, bold: true });
    ui.bar(X + 150, y + 6, 200, 8, (q.total - q.daysLeft) / q.total, COL.accent);
    ui.label(X + W - 8, y + 3, `${Math.ceil(q.daysLeft)}d left`, { size: 11, right: true, color: COL.dimText });
  });
}
