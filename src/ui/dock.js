// The docked control panels (Mission, Fleet, Factory, Sites, R&D, Skylink, Base). Each one draws a plain function of the game state.
import {
  ROCKETS, REGIONS, TECH, DESTINATIONS, BODIES, SAT_DESTS, SITES, SITE_IDS, LINE_COSTS, PAD_COSTS, TOWER_COST,
  BAY_BUY_COST, BAY_RENT_DEPOSIT, MAX_BAYS, DRONESHIP_COST, MAX_DRONESHIPS, RECOVERY_MODES, COMMODITIES, TANK_STEP,
  PLANT_COST, PLANT_MAX, MARKETS, PLANS, SATS, WELL_COST, MAX_WELLS, PLANT_RATE, LEASE_FEE, BAY_FEE, MARKET_MIN, MARKET_MAX, DEPOT_CAP, TANKER_LOAD,
  SAT_BATCH_DAYS, PROTOS, MARS_RETURN, MODULES, DRONE_POLICIES, STOCK_PRICES, STOCK_KEEP, LOCAL_RECIPES, DUCT_COST, MARS_ROUTES,
} from '../data.js';
import * as sim from '../sim.js';
import * as B from '../base.js';
import { COL, hex } from './ui.js';
import { drawRocket } from './art.js';
import { EXTRA, MAP_BOTTOM, PHONE } from '../layout.js';

// The tall desktop dock has room for more contract rows and locked loadouts than a phone (GDD 2.25).
export const CONTRACT_ROWS = PHONE ? 5 : 9;
const LOCK_ROWS = PHONE ? 2 : 4;
const TALL = !PHONE; // the other tabs also spread out on a tall screen
const GROW = (CONTRACT_ROWS - 5) * 25;
const LOCK_PAD = (LOCK_ROWS - 2) * 20 + 10; // room under the manifest for the locked-loadout rows

const clipTo = (str, n) => (str.length > n ? `${str.slice(0, n - 1)}…` : str);

function icon(ui, x, y, w, h, type) {
  const g = ui.scene.add.graphics();
  drawRocket(g, x, y, w, h, type);
  ui.container.add(g);
}

const stateColor = { ready: COL.good, refit: COL.warn, flying: COL.accent, shipping: COL.accent };
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
  } else if (sim.originIsMars(s)) {
    const w = sim.marsReturnWindow(s.day);
    req = `${w.open ? `Return window open ${w.closesIn} more days` : `Return window opens in ${w.opensIn} days`} · ${MARS_RETURN.hullFuel} t + ${MARS_RETURN.fuelPerTon} t/t of Mars base methalox, ${MARS_RETURN.ascentRisk * 100}% ascent and ${MARS_RETURN.landRisk * 100}% landing risk`;
    reqColor = hex(w.open ? COL.good : COL.warn);
  } else if (ed.body === 'mars') {
    const w = sim.marsWindow(s.day);
    const win = w.open ? `Window open ${w.closesIn} more days` : `Window opens in ${w.opensIn} days`;
    req = s.marsRoute === 'moon'
      ? `${win} · Moon route: ${MARS_ROUTES.moon.hullFuel} t + ${MARS_ROUTES.moon.fuelPerTon} t/t base methalox, ${Math.round(sim.marsRisks(s).moonLand * 100)}% landing risk`
      : `${win} · Direct: ${ed.prop} t/t depot propellant, +${Math.round(sim.marsRisks(s).ascent * 100)}% ascent and ${Math.round(sim.marsRisks(s).land * 100)}% landing risk`;
    reqColor = hex(w.open ? COL.good : COL.warn);
  } else if (ed.body !== 'earth') {
    req = `Needs a Skyship and ${ed.prop} t of depot propellant per tonne of payload.`;
    reqColor = hex(COL.warn);
  }
  if (r.role === 'module') { req = 'Module ships land at a Moon or Mars landing site and stay there as a base module.'; reqColor = hex(COL.warn); }
  else if (!payload) { req = 'Tankers and depot ships always work in LEO.'; reqColor = COL.dimText; }
  ui.label(X, Y + 44, req, { size: req.length > 80 ? 11 : 12, color: reqColor });

  // Vehicle selector
  ui.heading(X, Y + 68, 'VEHICLE');
  const types = Object.keys(ROCKETS).filter((id) => sim.fleetOf(s, id).length || id === s.rocket);
  const bw = (W - (types.length - 1) * 5) / types.length;
  types.forEach((id, i) => {
    const total = sim.fleetOf(s, id).length;
    const here = (v) => sim.hullOrigin(v) === sim.flightOrigin(s) && (sim.flightOrigin(s) !== 'earth' || sim.hullSite(v) === s.site);
    const ready = sim.readyVehicles(s, id).filter(here).length; // ready at the selected launch site
    const on = id === s.rocket;
    ui.button(X + i * (bw + 5), Y + 84, bw, 30, `${ROCKETS[id].short} ${ready}/${total}`, () => actions.pickRocket(id), {
      size: types.length > 6 ? 10 : 12, fill: on ? COL.btnOn : COL.btn, stroke: on ? COL.good : COL.accent,
      hint: `${ROCKETS[id].name}: ${ready} ready here, ${total} in the fleet.`,
    });
    if (bw > 150) icon(ui, X + i * (bw + 5) + 6, Y + 86, 18, 26, id);
  });
  const v = sim.nextVehicle(s, s.rocket);
  const risk = Math.round(sim.failChance(s) * 100);
  if (v) {
    const proto = s.rocket === 'behemoth' ? ' (prototype)' : '';
    ui.label(X, Y + 122, `Next: ${v.serial}  ·  ${v.flights}/${sim.coreLife(s, s.rocket)} flights  ·  risk ~${risk}%${proto}`, { size: 12, color: COL.dimText });
  } else {
    ui.label(X, Y + 122, sim.fleetOf(s, s.rocket).length ? (sim.launchBlocker(s) ?? 'No hull ready here.') : 'None in the fleet. Build one in the Factory tab.', { size: 12, color: hex(COL.warn), wrap: W });
  }

  // Launch site and recovery
  const site = s.sites[s.site];
  const moon = sim.originIsMoon(s) || sim.originIsMars(s);
  const marsPick = payload && DESTINATIONS[eff].body === 'mars' && s.rocket === 'skyship';
  const hullsAt = (where) => sim.fleetOf(s, 'skyship').filter((x) => x.site === where).length;
  const originPick = payload && s.dest === 'leo' && hullsAt('mars') > 0;
  if (sim.originIsMars(s)) {
    ui.label(X, Y + 146, 'From the Mars base', { size: 12, bold: true, color: hex(COL.accent) });
    ui.label(X + 150, Y + 147, `${Math.round(s.marsBase?.stock.methalox ?? 0)} t methalox · ${hullsAt('mars')} hull(s)`, { size: 11, color: COL.dimText });
  } else if (sim.originIsMoon(s)) {
    ui.label(X, Y + 146, 'From the Moon base', { size: 12, bold: true, color: hex(COL.accent) });
    ui.label(X + 142, Y + 147, `${Math.round(s.base?.stock.methalox ?? 0)} t methalox · ${hullsAt('moon')} hull(s)`, { size: 11, color: COL.dimText });
  } else {
    ui.label(X, Y + 146, `From ${SITES[s.site].letter} · ${SITES[s.site].short}`, { size: 12, bold: true, color: hex(tenureColor[site.status]) });
    ui.label(X + 150, Y + 147, sim.propParts(sim.fuelNeed(s).type, 1).map((p) => `${Math.round(site.stock[p.type])} t ${p.type === 'lox' ? 'LOX' : p.type === 'kerolox' ? 'RP-1' : 'CH4'}`).join(' · '), { size: 11, color: COL.dimText });
  }
  if (originPick) {
    [['earth', 'From Earth'], ['mars', 'From Mars']].forEach(([id, name], i) => {
      const on = s.origin === id;
      ui.button(X + W - 214 + i * 108, Y + 142, 104, 22, name, () => actions.setOrigin(id), {
        size: 11, fill: on ? COL.btnOn : COL.btn, stroke: on ? COL.good : COL.accent, hint: id === 'mars' ? 'Fly a Mars-based Skyship home to LEO.' : 'Launch from an Earth pad.',
      });
    });
  } else if (marsPick) {
    [['direct', 'Direct'], ['moon', 'From Moon']].forEach(([id, name], i) => {
      const on = s.marsRoute === id;
      ui.button(X + W - 214 + i * 108, Y + 142, 104, 22, name, () => actions.setMarsRoute(id), {
        size: 11, fill: on ? COL.btnOn : COL.btn, stroke: on ? COL.good : COL.accent, hint: MARS_ROUTES[id].name,
      });
    });
  } else if (!r.catch) {
    ui.label(X + W - 262, Y + 148, 'Booster', { size: 11, color: COL.dimText });
    Object.entries(RECOVERY_MODES).forEach(([id, m], i) => {
      const on = sim.recoveryOf(s) === id;
      const ok = sim.recoveryAllowed(s, id);
      ui.button(X + W - 204 + i * 68, Y + 142, 64, 22, m.name, () => { s.recovery = id; }, {
        size: 11, enabled: ok, fill: on ? COL.btnOn : COL.btn, stroke: on ? COL.good : COL.accent,
        hint: ok ? m.hint : `Research ${id === 'rtls' ? 'Booster Landing' : 'Droneship Recovery'} first.`,
      });
    });
  } else {
    ui.label(X + W, Y + 148, 'Tower catch: both stages return', { size: 11, right: true, color: COL.dimText });
  }

  if (!payload) {
    ui.heading(X, Y + 176, r.role === 'tanker' ? 'TANKER RUN' : r.role === 'module' ? 'MODULE DELIVERY' : 'DEPOT DEPLOYMENT');
    const need = sim.modulePropNeed(s);
    const lines = r.role === 'module'
      ? [`This hull becomes a ${MODULES[r.module].name} on your ${DESTINATIONS[s.dest].body === 'mars' ? 'Mars' : 'Moon'} base. ${MODULES[r.module].blurb}`,
        (() => {
          const body = DESTINATIONS[s.dest].body === 'mars' ? 'mars' : 'moon';
          const there = sim.baseOn(s, body);
          const name = body === 'mars' ? 'Mars' : 'Moon';
          return there ? `Your ${name} base is at ${DESTINATIONS[there.site].name}: pick that site on the ${name} map.` : `The first module ship founds the ${name} base at the site you pick on the map.`;
        })(),
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

  renderReceipt(ui, s);
  const blocker = sim.launchBlocker(s);
  const total = sim.launchCost(s);
  if (payload && (s.manifest.length || s.sats) && (sim.shipDaysNeeded(s) > 0)) {
    ui.button(X, Y + 384 + (payload ? GROW + LOCK_PAD : 0), W, 38, `LOCK IN LOADOUT  ·  ships ${sim.shipDaysNeeded(s)}d, then launches ($${total}M)`, () => actions.lockLoadout(), {
      fill: 0x1d5a3a, stroke: COL.good, size: 13, hint: 'Accept the contracts: the payloads ship to the launch site and the rocket launches by itself when they all arrive. You can then build and lock in another loadout.',
    });
  } else {
    ui.button(X, Y + 384 + (payload ? GROW + LOCK_PAD : 0), W, 38, blocker ? `LAUNCH  (${blocker})` : `LAUNCH to ${ed.name}  ($${total}M)`, () => actions.launch(), {
      enabled: !blocker, fill: 0x7a2a1d, stroke: COL.bad, size: blocker ? 12 : 15, hint: costHint(s),
    });
  }
}

// The itemized launch cost as a receipt on the map (GDD 2.13).
function renderReceipt(ui, s) {
  const r = sim.rocketDef(s);
  const t = sim.manifestTotals(s);
  if (r.role === 'payload' && !t.payout && !s.sats) return;
  const c = sim.launchCosts(s);
  const rows = c.items.length + 1;
  const hasHull = r.role === 'payload' && sim.recoveryOf(s) === 'expend';
  const h = 30 + rows * 14 + (r.role === 'payload' ? 34 : 6) + (hasHull ? 14 : 0);
  const x = 462 + EXTRA;
  const w = 232;
  const y = MAP_BOTTOM - h - 4;
  const g = ui.scene.add.graphics();
  g.fillStyle(0x0b1220, 0.88).fillRect(x, y, w, h);
  g.lineStyle(1, COL.line).strokeRect(x + 0.5, y + 0.5, w, h);
  g.lineStyle(2, COL.warn).lineBetween(x, y, x + w, y);
  ui.container.add(g);
  ui.label(x + 8, y + 5, 'LAUNCH RECEIPT', { size: 11, color: hex(COL.warn), bold: true });
  let ly = y + 22;
  c.items.forEach((i) => {
    ui.label(x + 8, ly, i.label.startsWith('Propellant') ? 'Propellant bought' : i.label, { size: 11, color: COL.dimText });
    ui.label(x + w - 8, ly, `$${i.amt}M`, { size: 11, right: true });
    ly += 14;
  });
  if (!c.items.length) { ui.label(x + 8, ly, 'Fuel already in the tanks', { size: 11, color: COL.dimText }); ly += 14; }
  ui.label(x + 8, ly + 2, 'Total now', { size: 12, bold: true });
  ui.label(x + w - 8, ly + 2, `$${c.total}M`, { size: 12, bold: true, right: true, color: hex(COL.bad) });
  ly += 18;
  if (hasHull) {
    const b = sim.buildCostAt(s.rocket, s.site);
    ui.label(x + 8, ly, 'Booster lost: next hull', { size: 11, color: COL.dimText });
    ui.label(x + w - 8, ly, `~$${b.cost}M`, { size: 11, right: true, color: COL.dimText });
    ly += 14;
  }
  if (r.role === 'payload') {
    ui.label(x + 8, ly, 'Payout on arrival', { size: 11, color: COL.dimText });
    ui.label(x + w - 8, ly, `+$${t.payout}M`, { size: 11, right: true, color: hex(COL.good) });
    const net = t.payout - c.total;
    ui.label(x + 8, ly + 15, 'Estimated profit', { size: 12, bold: true });
    ui.label(x + w - 8, ly + 15, `${net >= 0 ? '+' : '-'}$${Math.abs(net).toFixed(1)}M`, { size: 12, bold: true, right: true, color: hex(net >= 0 ? COL.good : COL.bad) });
  }
}

// A small padlock: the mark of a contract that is booked on a locked-in loadout.
function lockIcon(ui, x, y, col) {
  const g = ui.scene.add.graphics();
  g.lineStyle(2, col).strokeRoundedRect(x + 5, y + 1, 7, 7, 3);
  g.fillStyle(col).fillRoundedRect(x + 2, y + 7, 13, 10, 2);
  g.fillStyle(0x0b1220).fillRect(x + 8, y + 10, 1.5, 4);
  ui.container.add(g);
}

function renderContractsAndManifest(ui, s, X, Y, W, actions) {
  ui.heading(X, Y, 'CONTRACTS  ·  click to load  ·  one destination per launch');
  const sorted = [...s.contracts].sort((a, b) => (b.dest === s.dest) - (a.dest === s.dest) || b.payout - a.payout);
  const ROWS = CONTRACT_ROWS;
  const maxScroll = Math.max(0, sorted.length - ROWS);
  const scroll = Math.min(actions.contractScroll ?? 0, maxScroll);
  if (maxScroll) {
    ui.button(X + W - 44, Y - 3, 20, 16, '▲', () => actions.scrollContracts(-1), { size: 9, enabled: scroll > 0, hint: 'Scroll the contract board (or use the mouse wheel).' });
    ui.button(X + W - 20, Y - 3, 20, 16, '▼', () => actions.scrollContracts(1), { size: 9, enabled: scroll < maxScroll, hint: 'Scroll the contract board (or use the mouse wheel).' });
  }
  sorted.slice(scroll, scroll + ROWS).forEach((c, i) => {
    const y = Y + 16 + i * 25;
    const on = s.manifest.includes(c.id);
    const match = c.dest === s.dest;
    const d = DESTINATIONS[c.dest];
    const best = c.origin === 'mars' ? null : sim.bestSiteFor(s, c);
    const region = REGIONS.find((r) => r.id === c.region);
    const ship = SITE_IDS.filter((id) => s.sites[id].status !== 'locked').map((id) => `${SITES[id].letter} ${sim.shipDays(c, id)}d`).join(', ');
    const lk = sim.loadoutOf(s, c);
    ui.row(X, y, W, 23, {
      on, onClick: () => (lk ? actions.cancelLoadout(lk.id) : actions.toggleContract(c.id)),
      hint: lk ? `Locked in: ${c.customer}'s payload is shipping and launches by itself. Click to cancel this whole loadout.` : `${c.customer}${region ? ` (${region.name})` : ''} → ${d.name}. Expires day ${c.expires}.${region ? ` Shipping starts when you load it: ${ship}.` : ''}${c.prop ? ` Burns ${c.prop} t of depot propellant.` : ''}`,
    });
    const dim = match ? COL.text : COL.dimText;
    ui.label(X + 8, y + 4, c.customer, { size: 12, bold: true, color: dim });
    ui.label(X + 160, y + 4, d.name, { size: 12, color: c.prop ? hex(COL.accent) : dim });
    ui.label(X + 300, y + 4, `${c.mass} t`, { size: 12, color: dim });
    ui.label(X + 345, y + 4, `${c.volume} m³`, { size: 12, color: dim });
    if (lk) {
      lockIcon(ui, X + 405, y + 3, COL.accent);
      const left = sim.contractReady(s, c, lk.site) - s.day;
      ui.label(X + 428, y + 5, left > 0 ? `${left}d` : 'ready', { size: 11, color: hex(left > 0 ? COL.accent : COL.good) });
    } else if (best) {
      // Shipping only starts once the contract is loaded, so the board shows how long the payload will take after that.
      const days = sim.shipDays(c, best.id);
      const padWait = Math.max(0, best.day - days - s.day);
      const col = padWait === 0 ? COL.good : padWait <= 3 ? COL.warn : COL.dim;
      const gb = ui.scene.add.graphics();
      gb.fillStyle(0x0b1220).fillRoundedRect(X + 405, y + 3, 17, 17, 3).lineStyle(1, col).strokeRoundedRect(X + 405, y + 3, 17, 17, 3);
      ui.container.add(gb);
      ui.label(X + 413.5, y + 5, SITES[best.id].letter, { size: 12, bold: true, color: hex(col), center: true });
      ui.label(X + 428, y + 5, days ? `${days}d ship` : 'now', { size: 11, color: hex(col) });
    } else if (c.origin === 'mars') {
      ui.label(X + 405, y + 5, 'Mars', { size: 11, color: hex(COL.accent) });
    } else {
      ui.label(X + 405, y + 5, 'no site', { size: 11, color: hex(COL.bad) });
    }
    ui.label(X + W - 8, y + 3, `$${c.payout}M`, { size: 13, bold: true, color: hex(COL.good), right: true });
  });
  if (!s.contracts.length) ui.label(X, Y + 22, 'No contracts on the board. New ones arrive every few days.', { size: 12, color: COL.dimText });
  if (maxScroll) ui.label(X + W - 52, Y, `${scroll + 1}-${scroll + Math.min(ROWS, sorted.length)} of ${sorted.length}`, { size: 11, color: COL.dimText, right: true });

  const my = Y + 148 + GROW;
  const t = sim.manifestTotals(s);
  const cap = sim.capacity(s);
  const fit = (v, c) => (v > c ? COL.bad : v / c > 0.85 ? COL.warn : COL.good);
  const half = (W - 12) / 2;
  ui.label(X, my, `Mass ${t.mass} / ${cap.mass} t`, { size: 12 });
  ui.bar(X, my + 16, half, 8, t.mass / cap.mass, fit(t.mass, cap.mass));
  ui.label(X + half + 12, my, `Volume ${t.volume} / ${cap.volume} m³`, { size: 12 });
  ui.bar(X + half + 12, my + 16, half, 8, t.volume / cap.volume, fit(t.volume, cap.volume));

  const need = sim.tliNeed(s);
  const gen1 = s.tech.has('gen1') && sim.flightOrigin(s) === 'earth';
  const satsOk = SAT_DESTS.includes(s.dest);
  const ry = my + 30;
  if (!s.manifest.length && !s.sats && s.locked.length) {
    s.locked.slice(0, LOCK_ROWS).forEach((l, i) => {
      const yy = ry + i * 20;
      const why = sim.loadoutBlocker(s, l);
      lockIcon(ui, X, yy, COL.accent);
      ui.label(X + 24, yy + 3, `${ROCKETS[l.rocket].short} to ${DESTINATIONS[l.dest].name}${l.sats ? `, ${l.sats} sats` : ''}  ·  ${why ?? 'launching'}`, { size: 11, color: hex(why ? COL.accent : COL.good) });
      ui.button(X + W - 64, yy, 64, 17, 'Cancel', () => actions.cancelLoadout(l.id), { size: 10, hint: 'Withdraw this loadout: its contracts go back to the board.' });
    });
    if (s.locked.length > LOCK_ROWS) ui.label(X + W - 72, ry + LOCK_ROWS * 20, `+${s.locked.length - LOCK_ROWS} more locked`, { size: 10, right: true, color: COL.dimText });
  } else if (need) {
    ui.label(X, ry + 3, `Payout $${t.payout}M  ·  TLI propellant ${need} t needed, depot ${Math.floor(s.depot.prop)} t`, {
      size: 12, color: hex(s.depot.prop >= need && s.rocket === 'skyship' ? COL.good : COL.warn),
    });
  } else if (gen1 && satsOk) {
    ui.label(X, ry + 3, `Payout $${t.payout}M  ·  sats ${s.sats} (${s.satStock[s.satGen]} ${SATS[s.satGen].name} built)`, { size: 12, color: hex(COL.good) });
    ui.button(X + 250, ry, 170, 22, SATS[s.satGen].name, () => actions.cycleSatGen(), { size: 11, hint: `Click to change the satellite generation. ${SATS[s.satGen].capacity}k subscribers each, ${SATS[s.satGen].mass} t, $${SATS[s.satGen].cost}M.` });
    ui.button(X + 428, ry, 50, 22, `-${sim.SAT_BATCH}`, () => sim.adjustSats(s, -sim.SAT_BATCH), { enabled: s.sats > 0, size: 11 });
    ui.button(X + 486, ry, 50, 22, `+${sim.SAT_BATCH}`, () => sim.adjustSats(s, sim.SAT_BATCH), { enabled: s.sats < Math.min(sim.rocketDef(s).sats, s.satStock[s.satGen]), size: 11, hint: s.satStock[s.satGen] ? undefined : 'No satellites built: queue a batch in the Factory tab.' });
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
  const HULL_ROWS = PHONE ? 9 : 12;
  sorted.slice(0, HULL_ROWS).forEach((v, i) => {
    const y = Y + 18 + i * 26;
    const st = sim.vehicleState(s, v);
    const r = ROCKETS[v.type];
    const to = sim.nextShipSite(s, v);
    const canShip = to && !sim.shipHullBlocker(s, v, to);
    ui.row(X, y, W, 24, {
      on: v.type === s.rocket && st === 'ready' && v === sim.nextVehicle(s, v.type),
      onClick: canShip ? () => actions.shipHull(v.id, to) : null,
      hint: canShip ? `Click to ship ${v.serial} to ${SITES[to].short}: ${sim.hullMoveDays(sim.hullSite(v), to)} days, $${sim.hullMoveCost(v.type)}M. Launches from a site need a hull there.` : st === 'shipping' ? `${v.serial} is on its way to ${SITES[v.transit.to].short}.` : undefined,
    });
    icon(ui, X + 6, y + 1, 14, 22, v.type);
    ui.label(X + 28, y + 5, v.serial, { size: 12, bold: true });
    ui.label(X + 92, y + 5, r.name, { size: 12, color: COL.dimText });
    const days = st === 'ready' ? '' : ` ${Math.max(1, (st === 'shipping' ? v.transit.arrive : st === 'flying' ? v.returnDay : v.readyDay) - s.day)}d`;
    ui.label(X + 240, y + 5, `${st}${days}`, { size: 12, color: hex(stateColor[st]) });
    ui.label(X + 300, y + 5, st === 'shipping' ? `→ ${SITES[v.transit.to].letter}` : v.site === 'moon' ? 'Moon base' : v.site === 'mars' ? 'Mars base' : SITES[v.site ?? 'cape'].short, { size: 11, color: hex(st === 'shipping' || v.site === 'moon' || v.site === 'mars' ? COL.accent : COL.dim) });
    const life = sim.coreLife(s, v.type);
    const wear = v.flights / life;
    ui.bar(X + 392, y + 8, 80, 8, wear, wear > 0.7 ? COL.bad : wear > 0.4 ? COL.warn : COL.good);
    ui.label(X + W - 8, y + 5, `${v.flights}/${life}`, { size: 12, right: true, color: COL.dimText });
  });
  if (sorted.length > HULL_ROWS) ui.label(X, Y + 18 + HULL_ROWS * 26, `+${sorted.length - HULL_ROWS} more hulls`, { size: 12, color: COL.dimText });

  const dy = PHONE ? Y + 262 : Y + 38 + Math.max(1, Math.min(sorted.length, HULL_ROWS)) * 26 + (sorted.length > HULL_ROWS ? 14 : 0);
  ui.heading(X, dy, `DRONESHIPS  ·  ${s.droneships.length}/${MAX_DRONESHIPS}`);
  if (s.droneships.length < MAX_DRONESHIPS) {
    ui.button(X + W - 190, dy - 4, 190, 22, `Buy droneship  $${DRONESHIP_COST}M`, () => actions.buyDroneship(), { enabled: s.tech.has('droneship') && sim.canSpend(s, DRONESHIP_COST), size: 11, hint: s.tech.has('droneship') ? undefined : 'Research Droneship Recovery first.' });
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
  const QROWS = TALL ? 5 : 2; // build queue rows
  const BP = TALL ? 30 : 23; // pitch of the build buttons
  ui.heading(X, Y, 'FACTORY SITE');
  fsites.forEach((id, i) => {
    const on = id === fid;
    ui.button(X + i * 160, Y + 16, 154, 24, `${SITES[id].short}  ·  ${tenureLabel[s.sites[id].status].toLowerCase()}`, () => actions.factorySite(id), {
      size: 12, fill: on ? COL.btnOn : COL.btn, stroke: on ? COL.good : COL.accent,
      hint: SITES[id].catchDiscount ? 'Catch vehicles build 15% cheaper and faster here.' : 'Home factory.',
    });
  });
  const next = sim.lineCostOf(fid, site.lines);
  ui.label(X, Y + 50, `Lines ${site.lines}/${LINE_COSTS.length - (SITES[fid].bare ? 1 : 0)}`, { size: 13, bold: true });
  if (site.status === 'owned' && next !== undefined) {
    ui.button(X + W - 190, Y + 46, 190, 24, `${site.lines ? 'Add line' : 'Build first line'}  $${next}M`, () => actions.buyLine(fid), { enabled: sim.canSpend(s, next), size: 12 });
  } else if (site.status !== 'owned') {
    ui.label(X + W, Y + 52, 'Own the site to add lines', { size: 12, right: true, color: COL.dimText });
  }

  // Aluminum and steel yards
  ['aluminum', 'steel'].forEach((metal, k) => {
    const m = s.market[metal];
    const y = Y + 70 + k * 22;
    ui.label(X, y + 4, `${metal === 'steel' ? 'Steel' : 'Aluminum'} ${Math.round(site.stock[metal])} / ${site.cap[metal]} t`, { size: 12 });
    ui.bar(X + 150, y + 8, 150, 8, site.stock[metal] / site.cap[metal], COL.accent);
    ui.label(X + 312, y + 4, `$${sim.spot(s, metal).toFixed(3)}M/t`, { size: 11, color: hex(m > 1.15 ? COL.bad : m < 0.9 ? COL.good : COL.dim) });
    ui.button(X + W - 130, y, 130, 20, 'Buy 100 t', () => actions.buyCommodity(fid, metal, 100), { size: 11, enabled: !sim.buyBlocker(s, fid, metal) });
  });

  ui.heading(X, Y + 116, `BUILD QUEUE  ·  ${site.queue.length}`);
  if (!site.queue.length) ui.label(X, Y + 134, 'Nothing in production here.', { size: 12, color: COL.dimText });
  site.queue.slice(0, QROWS).forEach((q, i) => {
    const y = Y + 132 + i * 26;
    const r = q.kind === 'test' ? { name: PROTOS[q.tech].name } : ROCKETS[q.type];
    const working = i < site.lines;
    ui.row(X, y, W, 24);
    ui.label(X + 8, y + 5, r.name, { size: 12, bold: true });
    ui.bar(X + 190, y + 8, 190, 9, (q.total - q.daysLeft) / q.total, working ? COL.accent : COL.dim);
    ui.label(X + 392, y + 5, working ? `${q.daysLeft}d left` : 'waiting', { size: 12, color: COL.dimText });
    if (q.daysLeft === q.total) ui.button(X + W - 74, y + 2, 72, 20, 'Cancel', () => actions.cancelBuild(fid, q.id), { size: 11, hint: 'Refunds 50% of the build cost.' });
  });
  if (site.queue.length > QROWS) ui.label(X, Y + 132 + QROWS * 26, `+${site.queue.length - QROWS} more queued`, { size: 11, color: COL.dimText });

  const qShown = Math.min(site.queue.length, QROWS);
  const by = Y + 188 + Math.max(0, qShown - 2) * 26 + (site.queue.length > QROWS ? 14 : 0);
  ui.heading(X, by, 'BUILD  ·  metal from this yard, shortages bought at +10%');
  const types = Object.keys(ROCKETS);
  const cw = (W - 8) / 2;
  types.forEach((id, i) => {
    const r = ROCKETS[id];
    const blocker = sim.buildBlocker(s, id, fid);
    const { cost, days } = sim.buildCostAt(id, fid);
    const x = X + (i % 2) * (cw + 8);
    const y = by + 16 + Math.floor(i / 2) * BP;
    const nm = r.role === 'module' ? r.name : r.short;
    ui.button(x, y, cw, BP - 2, blocker === 'Locked' ? `${nm}: locked` : `${nm}  $${cost}M · ${days}d`, () => actions.queueBuild(id, fid), {
      enabled: !blocker, size: 12,
      hint: blocker && blocker !== 'Locked' ? `${r.name}: ${blocker}` : `${r.name}: ${r.payload ? `${r.payload} t, ` : ''}rated ${sim.coreLife(s, id)} flight${sim.coreLife(s, id) > 1 ? 's' : ''}. ${r.steel} t of ${r.metal === 'aluminum' ? 'aluminum' : 'steel'}.`,
    });
    if (blocker !== 'Locked') icon(ui, x + 6, y + 1, 11, BP - 4, id);
  });
  if (s.tech.has('gen1')) renderSatPlant(ui, s, X, by + 22 + Math.ceil(types.length / 2) * BP, W, actions);
}

// Skylink satellites are built ahead of time, one batch at a time, and kept in stock (GDD 2.23).
function renderSatPlant(ui, s, X, Y, W, actions) {
  const stock = [1, 2, 3].filter((g) => s.tech.has(SATS[g].tech)).map((g) => `${SATS[g].name} ${s.satStock[g]}`).join(' · ');
  const q = s.satQueue[0];
  ui.heading(X, Y, `SATELLITE PLANT  ·  built: ${stock}`);
  ui.label(X + W, Y, q ? `${SATS[q.gen].name} batch ${q.daysLeft}d${s.satQueue.length > 1 ? `  ·  +${s.satQueue.length - 1} queued` : ''}` : 'idle', { size: 11, right: true, color: q ? COL.dimText : hex(COL.warn) });
  const gens = [1, 2, 3].filter((g) => s.tech.has(SATS[g].tech));
  const bw = (W - 8 * (gens.length - 1)) / gens.length;
  gens.forEach((g, i) => {
    const blocker = sim.satBuildBlocker(s, g);
    ui.button(X + i * (bw + 8), Y + 15, bw, 22, `${SATS[g].name} x${sim.SAT_BATCH}  $${sim.satBatchCost(g)}M · ${SAT_BATCH_DAYS[g]}d`, () => actions.queueSats(g), {
      size: 11, enabled: !blocker, hint: blocker ?? `Queue ${sim.SAT_BATCH} ${SATS[g].name} satellites. They wait in stock until a loadout takes them.${SATS[g].only ? ' Gen-3 only flies on a Skyship.' : ''}`,
    });
  });
}

export function renderSites(ui, s, X, Y, W, actions, ctx) {
  const view = ctx.siteView && s.sites[ctx.siteView] ? ctx.siteView : s.site;
  ui.heading(X, Y, 'LAUNCH SITES  ·  click to view, the launch site is highlighted');
  SITE_IDS.forEach((id, i) => {
    const st = s.sites[id];
    const y = Y + 16 + i * 24;
    const d = SITES[id];
    ui.row(X, y, W, 22, { on: id === view, onClick: () => actions.viewSite(id), hint: d.blurb });
    ui.label(X + 10, y + 4, d.name, { size: 13, bold: true, color: st.status === 'locked' ? COL.dimText : COL.text });
    ui.label(X + 230, y + 5, tenureLabel[st.status], { size: 11, bold: true, color: hex(tenureColor[st.status]) });
    ui.label(X + 300, y + 5, st.status === 'locked' ? '' : `${st.pads.length} pad${st.pads.length === 1 ? '' : 's'} · ${st.bays.length} hangar${st.bays.length === 1 ? '' : 's'}`, { size: 11, color: COL.dimText });
    if (st.status === 'locked' && d.requires && s.sites[d.requires].status !== 'owned') ui.label(X + 300, y + 5, `Requires ${SITES[d.requires].short}`, { size: 11, bold: true, color: hex(COL.warn) });
    if (id === s.site) ui.label(X + W - 10, y + 5, 'LAUNCH SITE', { size: 11, bold: true, right: true, color: hex(COL.good) });
  });

  const st = s.sites[view];
  const d = SITES[view];
  const y0 = Y + 120;
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
    ui.label(X, y0 + 56, d.allowDests ? 'Reaches: LEO family only.' : `Cannot reach: ${(d.noDests ?? []).map((x) => DESTINATIONS[x].name).join(', ')}.`, { size: 12, color: COL.dimText, wrap: W });
    return;
  }
  if (st.status === 'leased') {
    ui.label(X, y0 + 22, `Leased: $${LEASE_FEE}M per launch, $${BAY_FEE}M per refit in a rented hangar, no towers, plants or extra pads.`, { size: 11, color: COL.dimText, wrap: W });
  } else if (view !== s.site) {
    ui.label(X, y0 + 22, d.blurb, { size: 11, color: COL.dimText, wrap: W });
  }

  // Pads: one row each for small sites, a summary and build buttons when there are dozens
  const py = y0 + 38;
  const owned = st.status === 'owned';
  ui.heading(X, py, `PADS  ·  ${st.pads.length}/${owned ? d.pads.length : 1}`);
  let padsEnd;
  if (d.pads.length > 4) {
    const towers = st.pads.filter((p) => p.tower).length;
    const ready = st.pads.filter((p) => p.busyUntil <= s.day).length;
    const nextBare = st.pads.findIndex((p) => !p.tower);
    ui.row(X, py + 16, W, 22);
    ui.label(X + 8, py + 21, st.pads.length ? `${st.pads.length} built · ${towers} towered · ${ready} ready` : 'No pads yet: bare land', { size: 11, bold: true, color: st.pads.length ? COL.text : COL.dimText });
    if (owned) {
      const nextCost = sim.padCostOf(view, st.pads.length);
      ui.button(X + W - 340, py + 17, 164, 20, `Build pad  $${nextCost}M`, () => actions.buyPad(view), { size: 11, enabled: !sim.padBlocker(s, view), hint: sim.padBlocker(s, view) ?? `A new pad on open land: $${nextCost}M.` });
      ui.button(X + W - 170, py + 17, 170, 20, `Build tower  $${TOWER_COST}M`, () => actions.buildTower(view, nextBare), { size: 11, enabled: nextBare >= 0 && !sim.towerBlocker(s, view, nextBare), hint: 'Catch tower on the next pad without one.' });
    }
    padsEnd = py + 16 + 22 + 8;
  } else {
    d.pads.forEach((name, i) => {
      const y = py + 16 + i * 24;
      const pad = st.pads[i];
      if (pad) {
        const left = pad.busyUntil - s.day;
        ui.row(X, y, W, 22);
        ui.label(X + 8, y + 4, pad.name, { size: 12, bold: true });
        ui.label(X + 120, y + 4, pad.tower ? 'catch tower' : 'no tower', { size: 11, color: hex(pad.tower ? COL.good : COL.dim) });
        ui.label(X + 220, y + 4, left > 0 ? `busy ${left}d` : 'ready', { size: 11, color: hex(left > 0 ? COL.warn : COL.good) });
        if (!pad.tower && owned) {
          ui.button(X + W - 170, y + 1, 170, 20, `Build tower  $${TOWER_COST}M`, () => actions.buildTower(view, i), { size: 11, enabled: !sim.towerBlocker(s, view, i) });
        }
      } else if (i === st.pads.length && owned) {
        ui.row(X, y, W, 22, { fill: 0x0a101c });
        ui.label(X + 8, y + 4, `${name}  (not built)`, { size: 12, color: COL.dimText });
        ui.button(X + W - 170, y + 1, 170, 20, `Build pad  $${sim.padCostOf(view, i)}M`, () => actions.buyPad(view), { size: 11, enabled: !sim.padBlocker(s, view) });
      }
    });
    padsEnd = py + 16 + d.pads.length * 24 + 6;
  }

  // Hangars
  const hy = padsEnd;
  const maxBays = sim.maxBaysOf(view, st.status);
  const bayName = d.bare ? 'megahangar' : 'hangar';
  ui.label(X, hy, `${bayName.toUpperCase()}S  ${st.bays.length}/${maxBays}  ·  ${st.bays.length ? st.bays.map((b) => (b.tenure === 'owned' ? 'owned' : 'rented')).join(', ') : 'none built'}`, { size: 12, bold: true, color: hex(COL.accent) });
  if (st.bays.length < maxBays) {
    const bc = sim.bayCostOf(view, st.status);
    ui.button(X + W - 170, hy - 3, 170, 22, owned ? `Build ${bayName}  $${bc}M` : `Rent hangar  $${bc}M`, () => actions.addBay(view), { size: 11, enabled: !sim.bayBlocker(s, view) });
  }

  // Gas wells (natural gas sites)
  let wy = hy + 25;
  if (d.gas) {
    ui.label(X, wy, `GAS WELLS  ${st.wells ?? 0}/${MAX_WELLS}  ·  feed methalox plants (RP-1 gets nothing)`, { size: 12, bold: true, color: hex(COL.accent) });
    if (owned) ui.button(X + W - 170, wy - 3, 170, 22, `Drill well  $${WELL_COST}M`, () => actions.buildWell(view), { size: 11, enabled: !sim.wellBlocker(s, view) });
    wy += 25;
  }

  // Fuel and materials
  const fy = wy;
  ui.heading(X, fy, 'TANKS AND MATERIALS  ·  spot price drifts, bulk buys are 10% cheaper');
  Object.keys(COMMODITIES).forEach((type, i) => {
    const y = fy + 16 + i * (TALL ? 40 : 30);
    const m = s.market[type];
    const isFuel = type === 'kerolox' || type === 'methalox' || type === 'lox';
    const tp = TALL ? 8 : 0; // extra height of a tank row
    ui.row(X, y, W, 28 + tp);
    ui.label(X + 8, y + 1 + tp / 2, COMMODITIES[type].name, { size: 11, bold: true });
    ui.bar(X + 190, y + 5 + tp / 2, 140, 8, st.cap[type] ? st.stock[type] / st.cap[type] : 0, st.stock[type] < st.cap[type] * 0.2 ? COL.warn : COL.accent);
    ui.label(X + 338, y + 1 + tp / 2, `${Math.round(st.stock[type])} / ${st.cap[type]} t`, { size: 11 });
    ui.label(X + W - 8, y + 1 + tp / 2, `$${sim.spot(s, type).toFixed(4)}M/t`, { size: 11, bold: true, right: true, color: hex(m > 1.15 ? COL.bad : m < 0.9 ? COL.good : COL.dim) });
    ui.button(X + 8, y + 14 + tp / 2, 86, 14 + tp / 2, 'Buy 100 t', () => actions.buyCommodity(view, type, 100), { size: 10, enabled: !sim.buyBlocker(s, view, type) });
    ui.button(X + 100, y + 14 + tp / 2, 86, 14 + tp / 2, 'Fill tank', () => actions.buyCommodity(view, type, 99999), { size: 10, enabled: !sim.buyBlocker(s, view, type) });
    ui.button(X + 192, y + 14 + tp / 2, 138, 14 + tp / 2, `Tank +${TANK_STEP[type].t} t  $${TANK_STEP[type].cost}M`, () => actions.expandTank(view, type), { size: 10, enabled: !sim.tankBlocker(s, view, type) });
    if (isFuel) {
      const lvl = st.plants[type];
      const b = sim.plantBlocker(s, view, type);
      ui.button(X + 336, y + 14 + tp / 2, W - 344, 14 + tp / 2, lvl >= PLANT_MAX ? `Plant L${lvl}: ${lvl * PLANT_RATE[type]} t/day` : `Plant L${lvl + 1}  $${PLANT_COST}M${lvl ? `  (now ${lvl * PLANT_RATE[type]} t/day)` : ''}`, () => actions.buildPlant(view, type), {
        size: 10, enabled: !b, hint: b ?? `A plant makes ${PLANT_RATE[type]} t per day per level at about 30% of the base price${SITES[view].gas && type === 'methalox' ? ', 15% for levels fed by a gas well' : ''}.`,
      });
    }
  });
}

export function renderTech(ui, s, X, Y, W, actions, ctx) {
  const fid = ctx.factorySite && s.sites[ctx.factorySite]?.lines ? ctx.factorySite : 'cape';
  const clip = (str, n) => (str.length > n ? `${str.slice(0, n - 1)}…` : str);
  TECH.forEach((t, i) => {
    const P = TALL ? 27 : 20; // row pitch
    const o = TALL ? 3 : 0; // text drop in a taller row
    const y = Y + i * P;
    const st = sim.techState(s, t.id);
    const afford = sim.canSpend(s, t.cost);
    const stroke = st === 'owned' ? COL.good : st === 'testing' ? COL.warn : st === 'available' && afford ? COL.accent : COL.line;
    ui.row(X, y, W, P - 2, {
      stroke, fill: st === 'owned' ? 0x123524 : COL.row,
      onClick: st === 'available' && afford ? () => actions.buyTech(t.id) : null,
      hint: st === 'locked' ? `${t.name} needs: ${sim.techBlockers(s, t.id).join(', ')}` : t.desc,
    });
    const dim = st === 'locked';
    ui.label(X + 10, y + 2 + o, t.name, { size: TALL ? 13 : 12, bold: true, color: dim ? COL.dimText : COL.text });
    if (st === 'testing') {
      const tr = s.trials[t.id];
      const p = PROTOS[t.id];
      ui.label(X + 168, y + 3 + o, `${Math.round(sim.testOdds(s, t.id) * 100)}% odds · ${tr.attempts} failed · ${tr.articles} ready`, { size: 10, color: hex(COL.warn) });
      const buildB = sim.testBuildBlocker(s, t.id, fid);
      ui.button(X + W - 232, y + 1 + o / 2, 112, 16 + o, `Build $${sim.testBuildAt(t.id, fid).cost}M · ${sim.testBuildAt(t.id, fid).days}d`, () => actions.queueTest(t.id, fid), {
        size: 10, enabled: !buildB, hint: buildB ?? `${p.name}: ${p.t} t of ${p.metal}.`,
      });
      const flyB = sim.testFlightBlocker(s, t.id);
      ui.button(X + W - 116, y + 1 + o / 2, 112, 16 + o, `Fly test $${p.ops}M`, () => actions.flyTest(t.id), {
        size: 10, enabled: !flyB, fill: flyB ? COL.btn : COL.btnOn, stroke: flyB ? COL.accent : COL.warn, hint: flyB ?? `Success or failure is a dice roll. A failure closes the pad for ${sim.rdAt(s.site).failClosed} days.`,
      });
      return;
    }
    const sub = st === 'locked' ? `Needs: ${sim.techBlockers(s, t.id).join(', ')}` : t.desc;
    ui.label(X + 168, y + 3 + o, clip(sub, TALL ? 60 : 56), { size: TALL ? 11 : 10, color: COL.dimText });
    ui.label(X + W - 10, y + 2 + o, st === 'owned' ? 'DONE' : `$${t.cost}M`, {
      size: 12, bold: true, right: true, color: st === 'owned' ? hex(COL.good) : afford || dim ? COL.dimText : hex(COL.bad),
    });
  });
}

function renderTimeline(ui, s, X, Y) {
  const list = Object.values(s.milestones ?? {}).sort((a, b) => b.day - a.day).slice(0, TALL ? 10 : 4);
  ui.heading(X, Y, 'COMPANY TIMELINE');
  if (!list.length) ui.label(X, Y + 18, 'Nothing yet. Fly something.', { size: 12, color: COL.dimText });
  list.forEach((m, i) => {
    ui.label(X, Y + 18 + i * 17, sim.dateOf(m.day).text, { size: 12, color: COL.dimText });
    ui.label(X + 100, Y + 18 + i * 17, m.title, { size: 12, bold: i === 0, color: i === 0 ? hex(0xffd166) : COL.text });
  });
}

export function renderSkylink(ui, s, X, Y, W, actions, ctx) {
  const cap = sim.skylinkCapacity(s);
  const load = sim.totalLoad(s);
  const q = sim.skylinkQuality(s);
  const mobileOpen = s.tech.has('dtc');
  const tab = mobileOpen && ctx?.skyTab === 'mobile' ? 'mobile' : 'broadband';
  ui.heading(X, Y, 'SKYLINK  ·  one constellation, licensed markets');
  const gens = [1, 2, 3].filter((g) => s.constellation[g] >= 0.5).map((g) => `${SATS[g].name} ${Math.round(s.constellation[g])}`).join(' · ');
  ui.label(X, Y + 18, `${Math.round(sim.satCount(s))} satellites`, { size: 13, bold: true });
  ui.label(X + 118, Y + 20, gens, { size: 11, color: COL.dimText });
  ui.label(X + 300, Y + 19, `capacity ${cap.toFixed(1)}k  ·  load ${load.toFixed(1)}k`, { size: 11, color: COL.dimText });
  ui.bar(X + 300, Y + 32, W - 300, 4, cap ? Math.min(1, load / cap) : 0, q < 1 ? COL.bad : load > cap * 0.85 ? COL.warn : COL.good);
  ui.label(X + W, Y + 1, `${q < 1 ? `CONGESTED ${Math.round(q * 100)}%  ·  ` : ''}$${sim.dailyRevenue(s).toFixed(3)}M/day`, { size: 12, bold: true, right: true, color: hex(q < 1 ? COL.bad : sim.dailyRevenue(s) >= sim.OVERHEAD_PER_DAY ? COL.good : COL.warn) });

  ui.label(X, Y + 42, 'Plan', { size: 12, color: COL.dimText });
  Object.entries(PLANS).forEach(([id, p], i) => {
    ui.button(X + 36 + i * 80, Y + 38, 76, 22, p.name, () => actions.setPlan(id), {
      size: 11, fill: s.plan === id ? COL.btnOn : COL.btn, stroke: s.plan === id ? COL.good : COL.accent, hint: `${p.hint} Price x${p.price}, demand x${p.demand}.`,
    });
  });
  [['broadband', 'Broadband'], ['mobile', 'Mobile']].forEach(([id, label], i) => {
    const locked = id === 'mobile' && !mobileOpen;
    ui.button(X + W - 190 + i * 96, Y + 38, 92, 22, locked ? 'Mobile (Gen-2)' : label, () => actions.skyTab(id), {
      size: 10, enabled: !locked, fill: tab === id ? COL.btnOn : COL.btn, stroke: tab === id ? COL.good : COL.accent,
      hint: locked ? 'Research Skylink Gen-2 to sell mobile service through carriers.' : undefined,
    });
  });

  const list = MARKETS.filter((m) => !!m.cell === (tab === 'mobile'));
  const y0 = Y + 68;
  const rowH = TALL ? 31 : list.length > 9 ? 23 : 25;
  const ro = TALL ? 4 : 0;
  list.forEach((m, i) => {
    const y = y0 + i * rowH;
    const st = s.markets[m.id];
    const blocker = sim.marketBlocker(s, m.id);
    const have = sim.satCount(s, m.cell ? 2 : 1);
    ui.row(X, y, W, rowH - 2, { fill: st.status === 'active' ? 0x123524 : COL.row, hint: `${m.name}: up to ${m.subs}k subscribers at $${m.arpu}/month${m.cell ? ' (light users: they load the network at ' + (m.load * 100) + '% of a broadband user)' : ''}. License $${m.license}M, approval ${m.lead} days, needs ${m.minSats} ${m.cell ? 'Gen-2 or newer ' : ''}satellites.` });
    ui.label(X + 8, y + 3 + ro, m.name, { size: 12, bold: true, color: st.status === 'locked' && have < m.minSats ? COL.dimText : COL.text });
    if (st.status === 'active') {
      ui.label(X + 190, y + 4 + ro, `${st.subs.toFixed(1)}k / ${sim.demandCeiling(s, m).toFixed(1)}k subs`, { size: 11 });
      ui.label(X + W - 8, y + 4 + ro, `$${sim.marketRevenue(s, m).toFixed(3)}M/day`, { size: 11, bold: true, right: true, color: hex(COL.good) });
    } else if (st.status === 'pending') {
      ui.label(X + 190, y + 4 + ro, `approval in ${Math.max(0, st.readyDay - s.day)} days`, { size: 11, bold: true, color: hex(COL.warn) });
    } else {
      ui.label(X + 190, y + 4 + ro, have >= m.minSats ? 'ready to license' : `needs ${m.minSats}${m.cell ? ' Gen-2+' : ''} satellites`, { size: 11, color: have >= m.minSats ? COL.text : COL.dimText });
      ui.button(X + W - 132, y + 1, 130, rowH - 4, `License  $${m.license}M · ${m.lead}d`, () => actions.applyLicense(m.id), { size: 10, enabled: !blocker, hint: blocker ?? `Pay $${m.license}M and wait ${m.lead} days for approval.` });
    }
  });
  const ey = y0 + list.length * rowH + 4;
  ui.label(X, ey, tab === 'mobile' ? 'Mobile users are light, but there are many of them. They share capacity with broadband.' : 'Satellites decay, so capacity shrinks if launches stop. Congestion drives subscribers away: switch plan or launch more.', { size: 11, color: COL.dimText, wrap: W });
  renderTimeline(ui, s, X, ey + 30);
}

// ---- Moon base --------------------------------------------------------------------------------------

export function renderBase(ui, s, X, Y, W, actions, ctx) {
  const base = ctx.base;
  const mars = ctx.body === 'mars';
  const name = mars ? 'Mars' : 'Moon';
  if (!base) {
    ui.heading(X, Y, `${name.toUpperCase()} BASE`);
    (mars ? [
      'No base yet.',
      'Research Mars Transfer, build a Habitat Skyship in the Factory, and fly it to a Mars landing site in a launch window.',
      'The first module ship founds the base at Jezero Crater or Utopia Planitia. Utopia has ice, so only it can make fuel.',
      'Module ships burn depot propellant, and the trip takes 180 days.',
    ] : [
      'No base yet.',
      'Research Moon Habitat Core, build a Habitat Skyship in the Factory, and fly it to a Moon landing site.',
      'The first module ship founds the base at the site you choose on the Moon map. Every later module goes to the same site.',
      'Module ships burn depot propellant, so fill the LEO depot first.',
    ]).forEach((l, i) => ui.label(X, Y + 22 + i * 26, l, { size: i ? 13 : 16, bold: !i, color: i ? COL.dimText : COL.text, wrap: W }));
    return;
  }
  const site = DESTINATIONS[base.site].name;
  ui.label(X, Y, `${name} base at ${site}`, { size: 17, bold: true });
  const open = ctx.view !== 'closed';
  ui.button(X + W - 150, Y - 3, 150, 26, open ? 'Close base view' : 'Open base view', () => (open ? actions.closeBase() : actions.openBase(ctx.body)), { size: 12 });
  ['control', 'modules'].forEach((id, i) => {
    ui.button(X + i * 108, Y + 28, 102, 22, id === 'control' ? 'Control' : 'Modules', () => actions.baseSub(id), {
      size: 12, fill: ctx.sub === id ? COL.btnOn : COL.btn, stroke: ctx.sub === id ? COL.good : COL.accent,
    });
  });
  const y0 = Y + 58;
  if (ctx.sub === 'modules') renderBaseModules(ui, s, X, y0, W, actions, ctx);
  else renderBaseControl(ui, s, X, y0, W, actions, ctx);
}

function renderBaseControl(ui, s, X, Y, W, actions, ctx) {
  const base = ctx.base;
  const PEND = TALL ? 6 : 4; // pending-module rows
  const PS = (PEND - 4) * 26; // everything below moves down by the extra rows
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
  base.pending.slice(0, PEND).forEach((p, i) => {
    const y = Y + 78 + i * 26;
    const on = ctx.mode.kind === 'place' && ctx.mode.pendingId === p.id;
    ui.row(X, y, W, 23, { on });
    ui.label(X + 8, y + 4, MODULES[p.type].name, { size: 13, bold: true });
    const warn = B.habitatWarning(base, p.type);
    ui.label(X + 150, y + 5, clipTo(warn ?? `${MODULES[p.type].len} tiles · ${MODULES[p.type].blurb}`, 52), { size: 11, color: warn ? hex(COL.warn) : COL.dimText });
    ui.button(X + W - 80, y + 1, 78, 21, on ? 'Placing' : 'Place', () => actions.startPlace(p.id), { size: 11 });
  });
  if (base.pending.length > PEND) ui.label(X + W, Y + 78 + PEND * 26, `+${base.pending.length - PEND} more`, { size: 11, right: true, color: COL.dimText });

  const hint = ctx.mode.kind === 'place' ? 'Click the grid to place. R rotates. Right click or Esc cancels.'
    : ctx.mode.kind === 'duct' ? 'Click a port, then a second port. Right click or Esc stops.' : '';
  const risk = B.crewAtRisk(base);
  if (hint) ui.label(X, Y + PS + 186, hint, { size: 12, color: hex(COL.warn) });
  else if (risk) ui.label(X, Y + PS + 186, `Crew at risk: ${risk} habitat${risk === 1 ? ' has' : 's have'} no power. Connect to a reactor or solar array with a duct.`, { size: 12, bold: true, color: hex(COL.bad) });

  ui.button(X, Y + PS + 208, 230, 28, ctx.mode.kind === 'duct' ? 'Stop connecting' : `Connect ducts ($${DUCT_COST}M each)`, () => actions.toggleDuct(), {
    size: 12, fill: ctx.mode.kind === 'duct' ? COL.btnOn : COL.btn, stroke: ctx.mode.kind === 'duct' ? COL.good : COL.accent,
    hint: 'Ducts join the ports at the ends of two modules. Only connected modules share power and crew.',
  });
  ui.button(X + 240, Y + PS + 208, 110, 28, 'Rotate (R)', () => actions.rotate(), { size: 12, enabled: ctx.mode.kind === 'place' });
  ui.button(X + 356, Y + PS + 208, 90, 28, 'Undo (Z)', () => actions.undo(), {
    size: 12, enabled: B.undoBlocker(base) === null, hint: B.undoBlocker(base) ?? 'Take back the last duct (refunded) or module placement.',
  });
  ui.label(X + W, Y + PS + 215, `${base.ducts.length} duct${base.ducts.length === 1 ? '' : 's'}`, { size: 12, right: true, color: COL.dimText });

  ui.heading(X, Y + PS + 248, 'STOCKPILE');
  const stock = base.stock;
  [['Regolith', stock.regolith], ['Oxygen', stock.oxygen], ['Iron', stock.iron], ['Silica', stock.silica], ['Ice', stock.ice], ['Methalox', stock.methalox]].forEach(([name, v], i) => {
    ui.label(X + i * 89, Y + PS + 266, `${name}`, { size: 11, color: COL.dimText });
    ui.label(X + i * 89, Y + PS + 280, `${v.toFixed(1)} t`, { size: 14, bold: true });
  });
  const surplus = Object.entries(STOCK_PRICES).reduce((n, [r, price]) => n + Math.max(0, stock[r] - STOCK_KEEP[r]) * price, 0);
  ui.button(X, Y + PS + 308, 250, 26, `Sell surplus  ($${surplus.toFixed(1)}M)`, () => actions.sellSurplus(), {
    size: 12, enabled: surplus >= 0.1, hint: `Keeps ${STOCK_KEEP.oxygen} t oxygen, ${STOCK_KEEP.iron} t iron and ${STOCK_KEEP.silica} t silica for local building.`,
  });
  if (base.storm) ui.label(X, Y + PS + 338, `Dust storm: everything that digs or moves runs at half speed, ${base.storm.daysLeft} more days.`, { size: 12, color: hex(COL.warn) });
  if (base.lastSpe) {
    ui.label(X + W, Y + PS + 314, `Last solar storm: day ${base.lastSpe.day}, ${base.lastSpe.dead} crew lost`, { size: 12, right: true, color: hex(base.lastSpe.dead ? COL.bad : COL.dim) });
  }
}

function renderBaseModules(ui, s, X, Y, W, actions, ctx) {
  const base = ctx.base;
  const { byModule } = B.analyze(base);
  const MODN = TALL ? 9 : 5; // module rows
  ui.heading(X, Y, `MODULES  ·  ${base.modules.length}`);
  if (!base.modules.length) ui.label(X, Y + 20, 'Nothing placed yet. Place a pending module from the Control tab.', { size: 12, color: COL.dimText });
  base.modules.slice(0, MODN).forEach((m, i) => {
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
  if (base.modules.length > MODN) ui.label(X, Y + 18 + MODN * 25, `+${base.modules.length - MODN} more`, { size: 11, color: COL.dimText });

  const fy = Y + 156 + (MODN - 5) * 25;
  ui.heading(X, fy, 'FABRICATOR  ·  build modules from local materials');
  const hasFab = base.modules.some((m) => m.type === 'fab');
  if (!hasFab) {
    ui.label(X, fy + 20, 'Needs a Fabricator module (research Lunar ISRU Mining).', { size: 12, color: COL.dimText });
    return;
  }
  const cw = (W - 8) / 2;
  Object.entries(LOCAL_RECIPES).forEach(([type, r], i) => {
    const blocker = B.recipeBlocker(s, type, base);
    ui.button(X + (i % 2) * (cw + 8), fy + 18 + Math.floor(i / 2) * 32, cw, 28, `${r.name ?? MODULES[type].name}  Fe${r.iron} Si${r.silica} O${r.oxygen} $${r.cash}M`, () => actions.queueLocal(type), {
      size: 11, enabled: !blocker, hint: blocker ? `${r.name ?? MODULES[type].name}: ${blocker}` : `${r.name ?? MODULES[type].name}: ${r.days} days.`,
    });
  });
  base.fabQueue.slice(0, 5).forEach((q, i) => {
    const y = fy + 122 + i * 24;
    ui.row(X, y, W, 21);
    ui.label(X + 8, y + 3, LOCAL_RECIPES[q.type].name ?? MODULES[q.type].name, { size: 12, bold: true });
    ui.bar(X + 150, y + 6, 200, 8, (q.total - q.daysLeft) / q.total, COL.accent);
    ui.label(X + W - 8, y + 3, `${Math.ceil(q.daysLeft)}d left`, { size: 11, right: true, color: COL.dimText });
  });
}
