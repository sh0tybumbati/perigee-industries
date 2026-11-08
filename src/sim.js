// Pure game simulation: no Phaser here, so it can be tested under plain node.
import {
  ROCKETS, RTLS_PAYLOAD_PENALTY, RTLS_TURNAROUND_SAVED, DRONESHIP_FEE, CORE_LIFE,
  SAT_MASS, SAT_VOLUME, SAT_LIFE_DAYS, SAT_COST, REGIONS, CUSTOMERS, TECH,
  OVERHEAD_PER_DAY, CASH_FLOOR,
} from './data.js';

export { OVERHEAD_PER_DAY };
export const CORE_COST = 12; // $M for a new booster core
export const SAT_BATCH = 6;
export const REVENUE_SCALE = 0.3;
const DESTINATIONS = ['LEO', 'Polar LEO', 'SSO', 'GTO'];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function createState() {
  const s = {
    day: 1,
    cash: 40,
    income: 0,
    core: { launches: 0 },
    padReadyDay: 1,
    contracts: [],
    manifest: [],
    sats: 0,
    rocket: 'peregrine9',
    recovery: 'rtls',
    region: 'na',
    constellation: Object.fromEntries(REGIONS.map((r) => [r.id, 0])),
    tech: new Set(),
    log: [],
    totalLaunches: 0,
    nextId: 1,
  };
  for (let i = 0; i < 5; i++) s.contracts.push(newContract(s));
  note(s, 'Welcome to Perigee Industries. Pick contracts, then launch.');
  return s;
}

export const SAVE_VERSION = 1;

export function serialize(s) {
  return JSON.stringify({ v: SAVE_VERSION, ...s, tech: [...s.tech] });
}

// Returns a state object, or null when the save is missing, corrupt, or from an unknown version.
export function deserialize(json) {
  try {
    const o = JSON.parse(json);
    if (!o || o.v !== SAVE_VERSION) return null;
    const base = createState();
    const s = { ...base, ...o, tech: new Set(Array.isArray(o.tech) ? o.tech : []) };
    delete s.v;
    s.constellation = { ...base.constellation, ...o.constellation };
    if (!ROCKETS[s.rocket] || (ROCKETS[s.rocket].requires && !s.tech.has(ROCKETS[s.rocket].requires))) s.rocket = 'peregrine9';
    if (!REGIONS.some((r) => r.id === s.region)) s.region = 'na';
    if (!Number.isFinite(s.cash) || !Number.isFinite(s.day)) return null;
    return s;
  } catch {
    return null;
  }
}

export function note(s, msg) {
  s.log.push(`Day ${s.day}: ${msg}`);
  if (s.log.length > 40) s.log.shift();
}

function newContract(s) {
  const heavy = s.tech.has('heavyCores');
  const maxMass = heavy && Math.random() < 0.3 ? 48 : 17;
  const mass = +rnd(1.5, maxMass).toFixed(1);
  const volume = +Math.min(130, mass * rnd(1.5, 3.2)).toFixed(0);
  return {
    id: s.nextId++,
    customer: pick(CUSTOMERS),
    dest: pick(DESTINATIONS),
    mass,
    volume: Math.max(2, volume),
    payout: +(mass * rnd(0.28, 0.45) + rnd(0.8, 1.6)).toFixed(1),
    expires: s.day + Math.round(rnd(12, 28)),
  };
}

export const rocketDef = (s) => ROCKETS[s.rocket];
export const hasHeavy = (s) => s.tech.has('heavyCores');

export function capacity(s) {
  const r = rocketDef(s);
  return {
    mass: +(r.payload * (s.recovery === 'rtls' ? 1 - RTLS_PAYLOAD_PENALTY : 1)).toFixed(1),
    volume: r.volume,
  };
}

export function manifestTotals(s) {
  let mass = s.sats * SAT_MASS;
  let volume = s.sats * SAT_VOLUME;
  let payout = 0;
  for (const c of s.contracts) {
    if (s.manifest.includes(c.id)) { mass += c.mass; volume += c.volume; payout += c.payout; }
  }
  return { mass: +mass.toFixed(2), volume: +volume.toFixed(1), payout: +payout.toFixed(1) };
}

export function turnaround(s) {
  let d = rocketDef(s).turnaround;
  if (s.tech.has('fastCores')) d -= 2;
  if (s.recovery === 'rtls') d -= RTLS_TURNAROUND_SAVED;
  return Math.max(2, d);
}

export const failChance = (s) => 0.01 + 0.004 * s.core.launches;
export const padReady = (s) => s.day >= s.padReadyDay;
export const coreWorn = (s) => s.core.launches >= CORE_LIFE;
export const coverage = (s, r) => Math.min(1, s.constellation[r.id] / r.satsFull);
export const regionRevenue = (s, r) => r.daily * REVENUE_SCALE * coverage(s, r);
export const dailyRevenue = (s) => REGIONS.reduce((sum, r) => sum + r.daily * REVENUE_SCALE * coverage(s, r), 0);

export function launchCost(s) {
  return +(rocketDef(s).refurb + rocketDef(s).ops + (s.recovery === 'drone' ? DRONESHIP_FEE : 0) + s.sats * SAT_COST).toFixed(2);
}

export function launchBlocker(s) {
  const t = manifestTotals(s);
  const cap = capacity(s);
  if (!padReady(s)) return `Pad turnaround: ${s.padReadyDay - s.day} day(s)`;
  if (coreWorn(s)) return `Core worn out, buy a new one ($${CORE_COST}M)`;
  if (!s.manifest.length && !s.sats) return 'Manifest is empty';
  if (t.mass > cap.mass) return 'Over payload mass limit';
  if (t.volume > cap.volume) return 'Over fairing volume limit';
  if (s.cash < launchCost(s)) return 'Not enough cash for launch costs';
  return null;
}

export function toggleContract(s, id) {
  const i = s.manifest.indexOf(id);
  if (i >= 0) s.manifest.splice(i, 1);
  else s.manifest.push(id);
}

export function adjustSats(s, delta) {
  if (!s.tech.has('gen1')) return;
  s.sats = Math.max(0, Math.min(rocketDef(s).sats, s.sats + delta));
}

export function setRocket(s, id) {
  if (ROCKETS[id].requires && !s.tech.has(ROCKETS[id].requires)) return;
  s.rocket = id;
  s.sats = Math.min(s.sats, rocketDef(s).sats);
}

// Purchases must leave enough cash to fly the cheapest launch, or the game could soft-lock.
export const canSpend = (s, amount) => s.cash - amount >= CASH_FLOOR;

export function buyCore(s) {
  if (!canSpend(s, CORE_COST)) return false;
  s.cash -= CORE_COST;
  s.core.launches = 0;
  note(s, `New booster core delivered (-$${CORE_COST}M).`);
  return true;
}

// Returns { ok, failed } or { ok:false, reason }.
export function launch(s) {
  const reason = launchBlocker(s);
  if (reason) return { ok: false, reason };
  const r = rocketDef(s);
  const t = manifestTotals(s);
  const cost = launchCost(s);
  s.cash -= cost;
  s.totalLaunches++;
  const failed = Math.random() < failChance(s);
  const sats = s.sats;
  const region = REGIONS.find((x) => x.id === s.region);

  s.contracts = s.contracts.filter((c) => !s.manifest.includes(c.id));
  s.manifest = [];
  s.sats = 0;

  if (failed) {
    s.core.launches = CORE_LIFE;
    s.padReadyDay = s.day + 14;
    note(s, `${r.name} LOST during ascent. Payload and core destroyed. Pad repairs: 14 days.`);
    return { ok: true, failed: true };
  }
  s.core.launches++;
  s.cash += t.payout;
  s.padReadyDay = s.day + turnaround(s);
  if (sats) s.constellation[region.id] += sats;
  const bits = [];
  if (t.payout) bits.push(`+$${t.payout}M contracts`);
  if (sats) bits.push(`${sats} Skylink sats to ${region.name}`);
  note(s, `${r.name} launch nominal. ${bits.join(', ')} (cost $${cost}M).`);
  return { ok: true, failed: false };
}

export function techState(s, id) {
  if (s.tech.has(id)) return 'owned';
  const t = TECH.find((x) => x.id === id);
  return t.requires.every((q) => s.tech.has(q)) ? 'available' : 'locked';
}

export function buyTech(s, id) {
  const t = TECH.find((x) => x.id === id);
  if (techState(s, id) !== 'available' || !canSpend(s, t.cost)) return false;
  s.cash -= t.cost;
  s.tech.add(id);
  note(s, `Research complete: ${t.name} (-$${t.cost}M).`);
  if (id === 'isru') note(s, 'Lunar logistics era reached. The Moon base is the next milestone (coming soon).');
  return true;
}

export function tick(s) {
  s.day++;
  for (const r of REGIONS) s.constellation[r.id] *= 1 - 1 / SAT_LIFE_DAYS;
  s.income = dailyRevenue(s);
  s.cash += s.income;
  // Payroll is covered by investors below the floor, so a bad run never locks the game.
  s.cash = Math.max(s.cash - OVERHEAD_PER_DAY, Math.min(s.cash, CASH_FLOOR));
  if (s.income < 0.05 && s.cash < CASH_FLOOR) {
    s.cash = CASH_FLOOR;
    note(s, `Investors cover launch costs (cash restored to $${CASH_FLOOR}M).`);
  }
  if (coreWorn(s) && !canSpend(s, CORE_COST) && s.income < 0.05) {
    s.cash = Math.max(s.cash, CORE_COST + CASH_FLOOR);
    note(s, `Investors wire emergency funding ($${CORE_COST}M) for a new core.`);
  }
  const expired = s.contracts.filter((c) => c.expires < s.day);
  if (expired.length) {
    s.contracts = s.contracts.filter((c) => c.expires >= s.day);
    s.manifest = s.manifest.filter((id) => s.contracts.some((c) => c.id === id));
  }
  if (s.day % 3 === 0 && s.contracts.length < 8) s.contracts.push(newContract(s));
  if (s.padReadyDay === s.day) note(s, 'Pad is ready for the next launch.');
}
