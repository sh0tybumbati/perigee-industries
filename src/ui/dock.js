// The docked control panels (Mission, Fleet, Factory, Sites, R&D, Skylink, Base). Each one draws a plain function of the game state.
import {
  ROCKETS, REGIONS, TECH, DESTINATIONS, BODIES, SAT_DESTS, SITES, SITE_IDS, LINE_COSTS, PAD_COSTS, TOWER_COST,
  BAY_BUY_COST, BAY_RENT_DEPOSIT, MAX_BAYS, DRONESHIP_COST, MAX_DRONESHIPS, RECOVERY_MODES, COMMODITIES, TANK_STEP,
  PLANT_COST, PLANT_MAX, PLANT_RATE, LEASE_FEE, BAY_FEE, MARKET_MIN, MARKET_MAX, DEPOT_CAP, TANKER_LOAD,
  MODULES, DRONE_POLICIES, STOCK_PRICES, STOCK_KEEP, LOCAL_RECIPES, DUCT_COST,
} from '../data.js';
import * as sim from '../sim.js';
import * as B from '../base.js';
import { COL, hex } from './ui.js';

const stateColor = { ready: COL.good, refit: COL.warn, flying: COL.accent };
const tenureColor = { owned: COL.good, leased: COL.warn, locked: COL.dim };
const tenureLabel = { owned: 'OWNED', leased: 'LEASED', locked: 'CLOSED' };

// A one-line version of the launch cost breakdown for the hover hint.
function costHint(s) {
  const c = sim.launchCosts(s);
  const short = { Operations: 'Ops', 'Refurbishment parts': 'Refurb', 'Expended upper stage': 'Upper stage', 'Hangar rental': 'Hangar', 'Pad lease': 'Pad lease' };
  const parts = c.items.map((i) => `${i.label.startsWith('Propellant') ? 'Fuel bought' : short[i.label] ?? i.label} $${i.amt}M`);
  return `${Math.round(c.fuel.fromTanks)} t ${c.fuel.type} from tanks${parts.length ? ' · ' : ''}${parts.join(' · ')}`;
}

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
      size: types.length > 6 ? 10 : 12, fill: on ? COL.btnOn : COL.btn, stroke: on ? COL.good : COL.accent,
      hint: `${ROCKETS[id].name}: ${ready} of ${total} ready.`,
    });
  });
  const v = sim.nextVehicle(s, s.rocket);
  const risk = Math.round(sim.failChance(s) * 100);
  if (v) {
    const proto = s.rocket === 'behemoth' ? ' (prototype)' : '';
    ui.label(X, Y + 122, `Next: ${v.serial}  ·  ${v.flights}/${r.coreLife} flights  ·  risk ~${risk}%${proto}`, { size: 12, color: COL.dimText });
  } else {
    ui.label(X, Y + 122, sim.fleetOf(s, s.rocket).length ? 'No hull ready: refit or in flight.' : 'None in the fleet. Build one in the Factory tab.', { size: 12, color: hex(COL.warn) });
  }

  // Launch site and recovery
  const site = s.sites[s.site];
  ui.label(X, Y + 146, `From ${SITES[s.site].short}`, { size: 12, bold: true, color: hex(tenureColor[site.status]) });
  ui.label(X + 118, Y + 147, `${site.status}  ·  ${Math.round(site.stock[sim.fuelNeed(s).type])} t ${sim.fuelNeed(s).type}`, { size: 11, color: COL.dimText });
  if (!r.catch) {
    ui.label(X + W - 262, Y + 148, 'Booster', { size: 11, color: COL.dimText });
    Object.entries(RECOVERY_MODES).forEach(([id, m], i) => {
      const on = s.recovery === id;
      ui.button(X + W - 204 + i * 68, Y + 142, 64, 22, m.name, () => { s.recovery = id; }, {
        size: 11, fill: on ? COL.btnOn : COL.btn, stroke: on ? COL.good : COL.accent, hint: m.hint,
      });
    });
  } else {
    ui.label(X + W, Y + 148, 'Tower catch: both stages return', { size: 11, right: true, color: COL.dimText });
  }

  if (!payload) {
    ui.heading(X, Y + 176, r.role === 'tanker' ? 'TANKER RUN' : r.role === 'module' ? 'MODULE DELIVERY' : 'DEPOT DEPLOYMENT');
    const need = sim.modulePropNeed(s);
    const lines = r.role === 'module'
      ? [`This hull becomes a ${MODULES[r.module].name} on your Moon base. ${MODULES[r.module].blurb}`,
        s.base ? `Your base is at ${DESTINATIONS[s.base.site].name}: pick that site on the Moon map.` : 'The first module ship founds the base at the Moon site you pick on the map.',
        `Burns ${need} t of depot propellant at launch (depot: ${Math.floor(s.depot.prop)} t).`]
      : r.role === 'tanker'
        ? [`Delivers ${TANKER_LOAD} t of CH4/LOX to the LEO depot, drawn from the launch site's methalox tanks.`,
          `Depot: ${Math.floor(s.depot.prop)} / ${DEPOT_CAP} t.`,
          s.depot.built ? 'Lunar cargo burns propellant from the depot at launch.' : 'The depot has to be deployed first.']
        : ['Deploys a depot Skyship into LEO. The hull stays on station and becomes the propellant depot.',
          `It holds ${DEPOT_CAP} t and boils off 0.4% per day, so fill it close to when you need it.`,
          'Single use: you only need one.'];
    lines.forEach((l, i) => ui.label(X, Y + 198 + i * 22, l, { size: 13, color: i ? COL.dimText : COL.text, wrap: W }));
  } else {
    renderContractsAndManifest(ui, s, X, Y + 172, W, actions);
  }

  const blocker = sim.launchBlocker(s);
  const total = sim.launchCost(s);
  ui.button(X, Y + 384, W, 38, blocker ? `LAUNCH  (${blocker})` : `LAUNCH to ${ed.name}  ($${total}M)`, () => actions.launch(), {
    enabled: !blocker, fill: 0x7a2a1d, stroke: COL.bad, size: blocker ? 12 : 15, hint: costHint(s),
  });
}

function renderContractsAndManifest(ui, s, X, Y, W, actions) {
  ui.heading(X, Y, 'CONTRACTS  ·  click to load  ·  one destination per launch');
  const sorted = [...s.contracts].sort((a, b) => (b.dest === s.dest) - (a.dest === s.dest) || b.payout - a.payout);
  sorted.slice(0, 5).forEach((c, i) => {
    const y = Y + 16 + i * 25;
    const on = s.manifest.includes(c.id);
    const match = c.dest === s.dest;
    const d = DESTINATIONS[c.dest];
    ui.row(X, y, W, 23, {
      on, onClick: () => actions.toggleContract(c.id),
      hint: `${c.customer} → ${d.name}. Expires day ${c.expires}.${c.prop ? ` Burns ${c.prop} t of depot propellant.` : ''}`,
    });
    const dim = match ? COL.text : COL.dimText;
    ui.label(X + 8, y + 4, c.customer, { size: 12, bold: true, color: dim });
    ui.label(X + 160, y + 4, d.name, { size: 12, color: c.prop ? hex(COL.accent) : dim });
    ui.label(X + 330, y + 4, `${c.mass} t`, { size: 12, color: dim });
    ui.label(X + 385, y + 4, `${c.volume} m³`, { size: 12, color: dim });
    ui.label(X + W - 8, y + 3, `$${c.payout}M`, { size: 13, bold: true, color: hex(COL.good), right: true });
  });
  if (!s.contracts.length) ui.label(X, Y + 22, 'No contracts on the board. New ones arrive every few days.', { size: 12, color: COL.dimText });
  if (s.contracts.length > 5) ui.label(X + W, Y, `+${s.contracts.length - 5} more`, { size: 11, color: COL.dimText, right: true });

  const my = Y + 148;
  const t = sim.manifestTotals(s);
  const cap = sim.capacity(s);
  const fit = (v, c) => (v > c ? COL.bad : v / c > 0.85 ? COL.warn : COL.good);
  const half = (W - 12) / 2;
  ui.label(X, my, `Mass ${t.mass} / ${cap.mass} t`, { size: 12 });
  ui.bar(X, my + 16, half, 8, t.mass / cap.mass, fit(t.mass, cap.mass));
  ui.label(X + half + 12, my, `Volume ${t.volume} / ${cap.volume} m³`, { size: 12 });
  ui.bar(X + half + 12, my + 16, half, 8, t.volume / cap.volume, fit(t.volume, cap.volume));

  const need = sim.tliNeed(s);
  const gen1 = s.tech.has('gen1');
  const satsOk = SAT_DESTS.includes(s.dest);
  const ry = my + 30;
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
  ui.heading(X, Y, `HULLS  ·  ${s.fleet.length}`);
  if (!s.fleet.length) ui.label(X, Y + 20, 'No hulls. Queue one in the Factory tab.', { size: 13, color: hex(COL.warn) });
  const sorted = [...s.fleet].sort((a, b) => a.type.localeCompare(b.type) || a.serial.localeCompare(b.serial));
  sorted.slice(0, 9).forEach((v, i) => {
    const y = Y + 18 + i * 26;
    const st = sim.vehicleState(s, v);
    const r = ROCKETS[v.type];
    ui.row(X, y, W, 24, { on: v.type === s.rocket && st === 'ready' && v === sim.nextVehicle(s, v.type) });
    ui.label(X + 8, y + 5, v.serial, { size: 12, bold: true });
    ui.label(X + 78, y + 5, r.name, { size: 12, color: COL.dimText });
    const days = st === 'ready' ? '' : ` ${Math.max(1, (st === 'flying' ? v.returnDay : v.readyDay) - s.day)}d`;
    ui.label(X + 240, y + 5, `${st}${days}`, { size: 12, color: hex(stateColor[st]) });
    ui.label(X + 300, y + 5, SITES[v.site ?? 'cape'].short, { size: 11, color: COL.dimText });
    const wear = v.flights / r.coreLife;
    ui.bar(X + 392, y + 8, 80, 8, wear, wear > 0.7 ? COL.bad : wear > 0.4 ? COL.warn : COL.good);
    ui.label(X + W - 8, y + 5, `${v.flights}/${r.coreLife}`, { size: 12, right: true, color: COL.dimText });
  });
  if (sorted.length > 9) ui.label(X, Y + 18 + 9 * 26, `+${sorted.length - 9} more hulls`, { size: 12, color: COL.dimText });

  const dy = Y + 262;
  ui.heading(X, dy, `DRONESHIPS  ·  ${s.droneships.length}/${MAX_DRONESHIPS}`);
  if (s.droneships.length < MAX_DRONESHIPS) {
    ui.button(X + W - 190, dy - 4, 190, 22, `Buy droneship  $${DRONESHIP_COST}M`, () => actions.buyDroneship(), { enabled: sim.canSpend(s, DRONESHIP_COST), size: 11 });
  }
  s.droneships.forEach((d, i) => {
    const y = dy + 20 + i * 26;
    const left = d.busyUntil - s.day;
    ui.row(X, y, W, 24);
    ui.label(X + 8, y + 5, `Droneship ${i + 1}`, { size: 12, bold: true });
    ui.label(X + W - 8, y + 5, left > 0 ? `returning ${left}d` : 'READY', { size: 12, right: true, color: hex(left > 0 ? COL.warn : COL.good) });
  });
  ui.label(X, dy + 22 + s.droneships.length * 26, 'A droneship takes one landing, then needs 4 days to return. Without one free, pick RTLS or Expend.', { size: 11, color: COL.dimText, wrap: W });
}

export function renderFactory(ui, s, X, Y, W, actions, ctx) {
  const fsites = sim.factorySites(s);
  const fid = fsites.includes(ctx.factorySite) ? ctx.factorySite : 'cape';
  const site = s.sites[fid];
  ui.heading(X, Y, 'FACTORY SITE');
  fsites.forEach((id, i) => {
    const on = id === fid;
    ui.button(X + i * 160, Y + 16, 154, 24, `${SITES[id].short}  ·  ${tenureLabel[s.sites[id].status].toLowerCase()}`, () => actions.factorySite(id), {
      size: 12, fill: on ? COL.btnOn : COL.btn, stroke: on ? COL.good : COL.accent,
      hint: SITES[id].catchDiscount ? 'Catch vehicles build 15% cheaper and faster here.' : 'Home factory.',
    });
  });
  const next = LINE_COSTS[site.lines];
  ui.label(X, Y + 50, `Lines ${site.lines}/${LINE_COSTS.length}`, { size: 13, bold: true });
  if (site.status === 'owned' && next !== undefined) {
    ui.button(X + W - 190, Y + 46, 190, 24, `Add line  $${next}M`, () => actions.buyLine(fid), { enabled: sim.canSpend(s, next), size: 12 });
  } else if (site.status !== 'owned') {
    ui.label(X + W, Y + 52, 'Own the site to add lines', { size: 12, right: true, color: COL.dimText });
  }

  // Steel yard
  const m = s.market.steel;
  ui.label(X, Y + 78, `Steel ${Math.round(site.stock.steel)} / ${site.cap.steel} t`, { size: 12 });
  ui.bar(X + 150, Y + 82, 150, 8, site.stock.steel / site.cap.steel, COL.accent);
  ui.label(X + 312, Y + 78, `spot $${sim.spot(s, 'steel').toFixed(3)}M/t`, { size: 11, color: hex(m > 1.15 ? COL.bad : m < 0.9 ? COL.good : COL.dim) });
  ui.button(X + W - 130, Y + 74, 130, 22, 'Buy 100 t', () => actions.buyCommodity(fid, 'steel', 100), { size: 11, enabled: !sim.buyBlocker(s, fid, 'steel') });

  ui.heading(X, Y + 104, `BUILD QUEUE  ·  ${site.queue.length}`);
  if (!site.queue.length) ui.label(X, Y + 122, 'Nothing in production here.', { size: 12, color: COL.dimText });
  site.queue.slice(0, 3).forEach((q, i) => {
    const y = Y + 120 + i * 26;
    const r = ROCKETS[q.type];
    const working = i < site.lines;
    ui.row(X, y, W, 24);
    ui.label(X + 8, y + 5, r.name, { size: 12, bold: true });
    ui.bar(X + 190, y + 8, 190, 9, (q.total - q.daysLeft) / q.total, working ? COL.accent : COL.dim);
    ui.label(X + 392, y + 5, working ? `${q.daysLeft}d left` : 'waiting', { size: 12, color: COL.dimText });
    if (q.daysLeft === q.total) ui.button(X + W - 74, y + 2, 72, 20, 'Cancel', () => actions.cancelBuild(fid, q.id), { size: 11, hint: 'Refunds 50% of the build cost.' });
  });
  if (site.queue.length > 3) ui.label(X, Y + 120 + 3 * 26, `+${site.queue.length - 3} more queued`, { size: 11, color: COL.dimText });

  const by = Y + 208;
  ui.heading(X, by, 'BUILD  ·  steel from this yard, shortages bought at +10%');
  const types = Object.keys(ROCKETS);
  const cw = (W - 8) / 2;
  types.forEach((id, i) => {
    const r = ROCKETS[id];
    const blocker = sim.buildBlocker(s, id, fid);
    const { cost, days } = sim.buildCostAt(id, fid);
    const x = X + (i % 2) * (cw + 8);
    const y = by + 18 + Math.floor(i / 2) * 31;
    const nm = r.role === 'module' ? r.name : r.short;
    ui.button(x, y, cw, 27, blocker === 'Locked' ? `${nm}: locked` : `${nm}  $${cost}M · ${days}d`, () => actions.queueBuild(id, fid), {
      enabled: !blocker, size: 12,
      hint: blocker && blocker !== 'Locked' ? `${r.name}: ${blocker}` : `${r.name}: ${r.payload ? `${r.payload} t, ` : ''}rated ${r.coreLife} flight${r.coreLife > 1 ? 's' : ''}. ${r.steel} t of steel.`,
    });
  });
}

export function renderSites(ui, s, X, Y, W, actions, ctx) {
  const view = ctx.siteView && s.sites[ctx.siteView] ? ctx.siteView : s.site;
  ui.heading(X, Y, 'LAUNCH SITES  ·  click to view, the launch site is highlighted');
  SITE_IDS.forEach((id, i) => {
    const st = s.sites[id];
    const y = Y + 16 + i * 28;
    const d = SITES[id];
    ui.row(X, y, W, 26, { on: id === view, onClick: () => actions.viewSite(id), hint: d.blurb });
    ui.label(X + 10, y + 6, d.name, { size: 13, bold: true, color: st.status === 'locked' ? COL.dimText : COL.text });
    ui.label(X + 230, y + 7, tenureLabel[st.status], { size: 11, bold: true, color: hex(tenureColor[st.status]) });
    ui.label(X + 300, y + 7, st.status === 'locked' ? '' : `${st.pads.length} pad${st.pads.length === 1 ? '' : 's'} · ${st.bays.length} hangar${st.bays.length === 1 ? '' : 's'}`, { size: 11, color: COL.dimText });
    if (id === s.site) ui.label(X + W - 10, y + 7, 'LAUNCH SITE', { size: 11, bold: true, right: true, color: hex(COL.good) });
  });

  const st = s.sites[view];
  const d = SITES[view];
  const y0 = Y + 106;
  ui.label(X, y0, `${d.short}  ·  ${tenureLabel[st.status].toLowerCase()}`, { size: 15, bold: true, color: hex(tenureColor[st.status]) });
  if (st.status !== 'owned') {
    if (st.status === 'locked' && d.price.lease !== undefined) {
      ui.button(X + W - 270, y0 - 4, 130, 24, `Lease  $${d.price.lease}M`, () => actions.acquireSite(view, 'lease'), { size: 12, enabled: !sim.siteBlocker(s, view, 'lease') });
    }
    ui.button(X + W - 134, y0 - 4, 134, 24, `Buy  $${d.price.buy}M`, () => actions.acquireSite(view, 'buy'), { size: 12, enabled: !sim.siteBlocker(s, view, 'buy') });
  } else if (view !== s.site) {
    ui.button(X + W - 134, y0 - 4, 134, 24, 'Launch from here', () => actions.setSite(view), { size: 12 });
  }
  if (st.status === 'locked') {
    ui.label(X, y0 + 26, d.blurb, { size: 12, color: COL.dimText, wrap: W });
    ui.label(X, y0 + 50, d.allowDests ? 'Reaches: LEO family only.' : `Cannot reach: ${(d.noDests ?? []).map((x) => DESTINATIONS[x].name).join(', ')}.`, { size: 12, color: COL.dimText, wrap: W });
    return;
  }
  if (st.status === 'leased') {
    ui.label(X, y0 + 22, `Leased: $${LEASE_FEE}M per launch, $${BAY_FEE}M per refit in a rented hangar, no towers, plants or extra pads.`, { size: 11, color: COL.dimText, wrap: W });
  } else if (view !== s.site) {
    ui.label(X, y0 + 22, d.blurb, { size: 11, color: COL.dimText, wrap: W });
  }

  // Pads
  const py = y0 + 38;
  ui.heading(X, py, `PADS  ·  ${st.pads.length}/${st.status === 'owned' ? d.pads.length : 1}`);
  d.pads.forEach((name, i) => {
    const y = py + 16 + i * 24;
    const pad = st.pads[i];
    if (pad) {
      const left = pad.busyUntil - s.day;
      ui.row(X, y, W, 22);
      ui.label(X + 8, y + 4, pad.name, { size: 12, bold: true });
      ui.label(X + 120, y + 4, pad.tower ? 'catch tower' : 'no tower', { size: 11, color: hex(pad.tower ? COL.good : COL.dim) });
      ui.label(X + 220, y + 4, left > 0 ? `busy ${left}d` : 'ready', { size: 11, color: hex(left > 0 ? COL.warn : COL.good) });
      if (!pad.tower && st.status === 'owned') {
        ui.button(X + W - 170, y + 1, 170, 20, `Build tower  $${TOWER_COST}M`, () => actions.buildTower(view, i), { size: 11, enabled: !sim.towerBlocker(s, view, i) });
      }
    } else if (i === st.pads.length && st.status === 'owned') {
      ui.row(X, y, W, 22, { fill: 0x0a101c });
      ui.label(X + 8, y + 4, `${name}  (not built)`, { size: 12, color: COL.dimText });
      ui.button(X + W - 170, y + 1, 170, 20, `Build pad  $${PAD_COSTS[i]}M`, () => actions.buyPad(view), { size: 11, enabled: !sim.padBlocker(s, view) });
    }
  });

  // Hangars
  const hy = py + 16 + d.pads.length * 24 + 6;
  const maxBays = MAX_BAYS[st.status];
  ui.label(X, hy, `HANGARS  ${st.bays.length}/${maxBays}  ·  ${st.bays.map((b) => (b.tenure === 'owned' ? 'owned' : 'rented')).join(', ')}`, { size: 12, bold: true, color: hex(COL.accent) });
  if (st.bays.length < maxBays) {
    ui.button(X + W - 170, hy - 3, 170, 22, st.status === 'owned' ? `Buy hangar  $${BAY_BUY_COST}M` : `Rent hangar  $${BAY_RENT_DEPOSIT}M`, () => actions.addBay(view), { size: 11, enabled: !sim.bayBlocker(s, view) });
  }

  // Fuel and materials
  const fy = hy + 26;
  ui.heading(X, fy, 'TANKS AND MATERIALS  ·  spot price drifts, bulk buys are 10% cheaper');
  Object.keys(COMMODITIES).forEach((type, i) => {
    const y = fy + 16 + i * 44;
    const m = s.market[type];
    const isFuel = type !== 'steel';
    ui.row(X, y, W, 41);
    ui.label(X + 8, y + 3, COMMODITIES[type].name, { size: 12, bold: true });
    ui.bar(X + 190, y + 7, 140, 8, st.stock[type] / st.cap[type], st.stock[type] < st.cap[type] * 0.2 ? COL.warn : COL.accent);
    ui.label(X + 338, y + 3, `${Math.round(st.stock[type])} / ${st.cap[type]} t`, { size: 11 });
    ui.label(X + W - 8, y + 3, `$${sim.spot(s, type).toFixed(3)}M/t`, { size: 11, bold: true, right: true, color: hex(m > 1.15 ? COL.bad : m < 0.9 ? COL.good : COL.dim) });
    ui.button(X + 8, y + 19, 86, 19, 'Buy 100 t', () => actions.buyCommodity(view, type, 100), { size: 10, enabled: !sim.buyBlocker(s, view, type) });
    ui.button(X + 100, y + 19, 86, 19, 'Fill tank', () => actions.buyCommodity(view, type, 99999), { size: 10, enabled: !sim.buyBlocker(s, view, type) });
    ui.button(X + 192, y + 19, 138, 19, `Tank +${TANK_STEP[type].t} t  $${TANK_STEP[type].cost}M`, () => actions.expandTank(view, type), { size: 10, enabled: !sim.tankBlocker(s, view, type) });
    if (isFuel) {
      const lvl = st.plants[type];
      const b = sim.plantBlocker(s, view, type);
      ui.button(X + 336, y + 19, W - 344, 19, lvl >= PLANT_MAX ? `Plant L${lvl}: ${lvl * PLANT_RATE} t/day` : `Plant L${lvl + 1}  $${PLANT_COST}M${lvl ? `  (now ${lvl * PLANT_RATE} t/day)` : ''}`, () => actions.buildPlant(view, type), {
        size: 10, enabled: !b, hint: b ?? `A plant makes ${PLANT_RATE} t per day per level at about 30% of the base price.`,
      });
    }
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
