// Pure game simulation: no Phaser or Three here, so it can be tested under plain node.
import {
  ROCKETS, RTLS_PAYLOAD_PENALTY, RTLS_TURNAROUND_SAVED, DRONESHIP_FEE,
  SAT_MASS, SAT_VOLUME, SAT_LIFE_DAYS, SAT_COST, REGIONS, CUSTOMERS, TECH,
  OVERHEAD_PER_DAY, CASH_FLOOR, BEHEMOTH_LEARNING, BEHEMOTH_MIN_RISK,
  DEPOT_CAP, TANKER_LOAD, TANKER_PROP_COST, BOILOFF_PER_DAY,
  PAD_COSTS, PAD_TURN, PAD_FAIL_CLOSED, LINE_COSTS, CANCEL_REFUND,
  DESTINATIONS, EARTH_ORBITS, LUNAR_DESTS, SAT_DESTS,
} from './data.js';
import { createBase, tickBase } from './base.js';

export { OVERHEAD_PER_DAY };
export const SAT_BATCH = 6;
export const REVENUE_SCALE = 0.3;
export const SAVE_VERSION = 4;
const MAX_TRIPS = 80;
const rnd = (a, b) => a + Math.random() * (b - a);

function pickWeighted(items, weights) {
  let r = Math.random() * weights.reduce((n, w) => n + w, 0);
  const i = weights.findIndex((w) => (r -= w) < 0);
  return items[i < 0 ? 0 : i];
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function createState() {
  const s = {
    day: 1,
    cash: 40,
    income: 0,
    fleet: [], // individual hulls
    serials: {},
    pads: [{ busyUntil: 1 }],
    lines: 1,
    queue: [], // factory build queue
    trips: [], // flight records, active and past
    flightCounts: {}, // successful flights per vehicle type
    contracts: [],
    manifest: [],
    sats: 0,
    rocket: 'peregrine9', // selected vehicle type
    dest: 'leo', // selected destination
    recovery: 'rtls',
    region: 'na',
    constellation: Object.fromEntries(REGIONS.map((r) => [r.id, 0])),
    depot: { built: false, prop: 0 },
    base: null, // the lunar base, founded by the first module ship to land
    tech: new Set(),
    log: [],
    totalLaunches: 0,
    nextId: 1,
  };
  addVehicle(s, 'peregrine9');
  for (let i = 0; i < 5; i++) s.contracts.push(newContract(s));
  note(s, 'Welcome to Perigee Industries. Pick a destination on the map, then plan a launch.');
  return s;
}

export function note(s, msg) {
  s.log.push(`Day ${s.day}: ${msg}`);
  if (s.log.length > 40) s.log.shift();
}

// ---- save / load -------------------------------------------------------

export function serialize(s) {
  return JSON.stringify({ v: SAVE_VERSION, ...s, tech: [...s.tech] });
}

// Older saves are converted step by step. Returns null for missing, corrupt or unknown saves.
export function deserialize(json) {
  try {
    const o = JSON.parse(json);
    if (!o) return null;
    if (o.v === 1) {
      o.cores = { peregrine9: o.core?.launches ?? 0 };
      o.v = 2;
    }
    if (o.v === 2) return migrateV2(o);
    if (o.v === 3) o.v = 4; // v4 only adds the lunar base
    if (o.v !== SAVE_VERSION) return null;
    const base = createState();
    const s = { ...base, ...o, tech: new Set(Array.isArray(o.tech) ? o.tech : []) };
    delete s.v;
    s.constellation = { ...base.constellation, ...o.constellation };
    s.depot = { ...base.depot, ...o.depot };
    s.flightCounts = { ...o.flightCounts };
    s.serials = { ...o.serials };
    for (const k of ['fleet', 'pads', 'queue', 'trips', 'contracts', 'manifest']) if (!Array.isArray(s[k])) s[k] = base[k];
    s.base = s.base && Array.isArray(s.base.modules) ? { ...createBase(s.base.site), ...s.base, stock: { ...createBase('').stock, ...s.base.stock } } : null;
    s.fleet = s.fleet.filter((v) => ROCKETS[v.type]);
    s.queue = s.queue.filter((q) => ROCKETS[q.type]);
    if (!s.pads.length) s.pads = base.pads;
    if (!ROCKETS[s.rocket] || !rocketUnlocked(s, s.rocket)) s.rocket = 'peregrine9';
    if (!DESTINATIONS[s.dest] || !destUnlocked(s, s.dest)) s.dest = 'leo';
    if (!REGIONS.some((r) => r.id === s.region)) s.region = 'na';
    if (!Number.isFinite(s.cash) || !Number.isFinite(s.day)) return null;
    return s;
  } catch {
    return null;
  }
}

// v2 had one shared core per vehicle type and a single launch pad with no fleet.
function migrateV2(o) {
  const s = createState();
  s.fleet = [];
  s.serials = {};
  s.tech = new Set(Array.isArray(o.tech) ? o.tech : []);
  for (const k of ['day', 'cash', 'income', 'totalLaunches', 'region', 'recovery']) if (o[k] !== undefined) s[k] = o[k];
  s.constellation = { ...s.constellation, ...o.constellation };
  s.flightCounts = { ...o.flights };
  if (o.depot) s.depot = { built: !!o.depot.built, prop: o.depot.prop ?? 0 };
  for (const id of ['peregrine9', 'peregrineHeavy', 'behemoth', 'skyship']) {
    const worn = o.cores?.[id] ?? 0;
    if (rocketUnlocked(s, id) && worn < ROCKETS[id].coreLife) addVehicle(s, id).flights = worn;
  }
  if (!s.fleet.length) addVehicle(s, 'peregrine9');
  if (ROCKETS[o.rocket] && rocketUnlocked(s, o.rocket)) s.rocket = o.rocket;
  if (!REGIONS.some((r) => r.id === s.region)) s.region = 'na';
  note(s, 'Save upgraded: your boosters are now individual hulls in the fleet.');
  return s;
}

// ---- destinations ------------------------------------------------------------

export const destDef = (id) => DESTINATIONS[id];
export const destUnlocked = (s, id) => !DESTINATIONS[id].locked || s.tech.has(DESTINATIONS[id].locked);
export const isLunar = (id) => DESTINATIONS[id].body === 'moon';
export const roundTripDays = (id) => (DESTINATIONS[id].body === 'earth' ? 0 : DESTINATIONS[id].days * 2);

// Tankers and depot ships always work in LEO, whatever is selected on the map.
export const effDest = (s) => (['payload', 'module'].includes(rocketDef(s).role) ? s.dest : 'leo');

export function setDest(s, id) {
  if (!DESTINATIONS[id] || !destUnlocked(s, id)) return false;
  s.dest = id;
  s.manifest = s.manifest.filter((cid) => s.contracts.find((c) => c.id === cid)?.dest === id);
  if (!SAT_DESTS.includes(id)) s.sats = 0;
  return true;
}

// ---- contracts -------------------------------------------------------------------

function pickTier(s) {
  const tiers = [{ w: 0.5, min: 1.5, max: 17, rate: [0.28, 0.45] }];
  if (s.tech.has('heavyCores')) tiers.push({ w: 0.2, min: 22, max: 60, rate: [0.55, 0.8] });
  if (rocketUnlocked(s, 'behemoth')) tiers.push({ w: 0.15, min: 60, max: 100, rate: [0.7, 1.0] });
  if (s.tech.has('skyship')) tiers.push({ w: 0.12, min: 100, max: 140, rate: [0.55, 0.8] });
  return pickWeighted(tiers, tiers.map((t) => t.w));
}

// Bigger payloads pay more per tonne (heavy-lift premium), and appear as each vehicle tier unlocks.
function newContract(s) {
  if (s.tech.has('tanker') && Math.random() < 0.3) return newLunarContract(s);
  const tier = pickTier(s);
  const mass = +rnd(tier.min, tier.max).toFixed(1);
  const volume = +Math.min(380, mass * rnd(1.5, 3.2)).toFixed(0);
  return {
    id: s.nextId++,
    customer: pick(CUSTOMERS),
    dest: pickWeighted(EARTH_ORBITS, [0.5, 0.2, 0.2, 0.1]),
    mass,
    volume: Math.max(2, volume),
    payout: +(mass * rnd(...tier.rate) + rnd(0.8, 1.6)).toFixed(1),
    expires: s.day + Math.round(rnd(12, 28)),
  };
}

// Lunar cargo needs a Skyship plus depot propellant for the trans-lunar burn.
function newLunarContract(s) {
  const dest = pickWeighted(LUNAR_DESTS, [0.35, 0.25, 0.2, 0.2]);
  const d = DESTINATIONS[dest];
  const mass = +rnd(15, 100).toFixed(1);
  return {
    id: s.nextId++,
    customer: pick(CUSTOMERS),
    dest,
    mass,
    volume: Math.round(mass * rnd(1.5, 2.5)),
    prop: Math.ceil(mass * d.prop),
    payout: +((mass * rnd(0.8, 1.1) + rnd(3, 6)) * (d.kind === 'site' ? 1.15 : 1)).toFixed(1),
    expires: s.day + Math.round(rnd(30, 50)),
  };
}

export function toggleContract(s, id) {
  const c = s.contracts.find((x) => x.id === id);
  if (!c || rocketDef(s).role !== 'payload') return false;
  const i = s.manifest.indexOf(id);
  if (i >= 0) { s.manifest.splice(i, 1); return true; }
  if (c.dest !== s.dest) {
    if (s.manifest.length) return false; // one destination per launch
    if (!setDest(s, c.dest)) return false;
  }
  s.manifest.push(id);
  return true;
}

// ---- fleet ---------------------------------------------------------------------

export const rocketDef = (s) => ROCKETS[s.rocket];
export const rocketUnlocked = (s, id) => ROCKETS[id].requires.every((t) => s.tech.has(t));

function addVehicle(s, type) {
  const n = (s.serials[type] = (s.serials[type] ?? 0) + 1);
  const v = { id: s.nextId++, type, serial: `${ROCKETS[type].code}-${String(n).padStart(2, '0')}`, flights: 0, returnDay: 0, readyDay: s.day };
  s.fleet.push(v);
  return v;
}

export const fleetOf = (s, type) => s.fleet.filter((v) => v.type === type);

export function vehicleState(s, v) {
  if (s.day < v.returnDay) return 'flying';
  if (s.day < v.readyDay) return 'refit';
  return 'ready';
}

export const readyVehicles = (s, type) => fleetOf(s, type).filter((v) => vehicleState(s, v) === 'ready');
// The least-worn ready hull flies first.
export const nextVehicle = (s, type) => readyVehicles(s, type).sort((a, b) => a.flights - b.flights)[0] ?? null;

export function setRocket(s, id) {
  if (!ROCKETS[id] || !rocketUnlocked(s, id)) return;
  s.rocket = id;
  s.sats = Math.min(s.sats, rocketDef(s).sats);
  if (rocketDef(s).role !== 'payload') { s.manifest = []; s.sats = 0; }
}

export function failChance(s, v = nextVehicle(s, s.rocket)) {
  const r = rocketDef(s);
  let base = r.baseRisk;
  if (s.rocket === 'behemoth') base = Math.max(BEHEMOTH_MIN_RISK, base - BEHEMOTH_LEARNING * (s.flightCounts.behemoth ?? 0));
  return base + r.wearRisk * (v?.flights ?? 0);
}

export function capacity(s) {
  const r = rocketDef(s);
  const rtls = !r.catch && s.recovery === 'rtls';
  return { mass: +(r.payload * (rtls ? 1 - RTLS_PAYLOAD_PENALTY : 1)).toFixed(1), volume: r.volume };
}

export function turnaround(s) {
  const r = rocketDef(s);
  let d = r.turnaround;
  if (!r.catch && s.tech.has('fastCores')) d -= 2;
  if (!r.catch && s.recovery === 'rtls') d -= RTLS_TURNAROUND_SAVED;
  return Math.max(2, d);
}

// ---- pads ---------------------------------------------------------------------

export const freePad = (s) => s.pads.findIndex((p) => s.day >= p.busyUntil);

export function buyPad(s) {
  const cost = PAD_COSTS[s.pads.length];
  if (cost === undefined || !canSpend(s, cost)) return false;
  s.cash -= cost;
  s.pads.push({ busyUntil: s.day });
  note(s, `New launch pad commissioned (-$${cost}M).`);
  return true;
}

// ---- factory ----------------------------------------------------------------

export function buildBlocker(s, type) {
  const r = ROCKETS[type];
  if (!rocketUnlocked(s, type)) return 'Locked';
  if (r.role === 'depot' && (s.depot.built || fleetOf(s, type).length || s.queue.some((q) => q.type === type))) return 'Only one depot is needed';
  if (!canSpend(s, r.buildCost)) return 'Not enough cash';
  return null;
}

export function queueBuild(s, type) {
  if (buildBlocker(s, type)) return false;
  const r = ROCKETS[type];
  s.cash -= r.buildCost;
  s.queue.push({ id: s.nextId++, type, daysLeft: r.buildDays, total: r.buildDays });
  note(s, `Queued ${r.name} (-$${r.buildCost}M, ${r.buildDays} days).`);
  return true;
}

export function cancelBuild(s, id) {
  const q = s.queue.find((x) => x.id === id);
  if (!q || q.daysLeft < q.total) return false; // work has started
  const refund = +(ROCKETS[q.type].buildCost * CANCEL_REFUND).toFixed(1);
  s.queue = s.queue.filter((x) => x.id !== id);
  s.cash += refund;
  note(s, `Cancelled ${ROCKETS[q.type].name}, refunded $${refund}M.`);
  return true;
}

export function buyLine(s) {
  const cost = LINE_COSTS[s.lines];
  if (cost === undefined || !canSpend(s, cost)) return false;
  s.cash -= cost;
  s.lines++;
  note(s, `Production line ${s.lines} online (-$${cost}M).`);
  return true;
}

// ---- manifest ----------------------------------------------------------------

export function manifestTotals(s) {
  let mass = s.sats * SAT_MASS;
  let volume = s.sats * SAT_VOLUME;
  let payout = 0;
  for (const c of s.contracts) {
    if (s.manifest.includes(c.id)) { mass += c.mass; volume += c.volume; payout += c.payout; }
  }
  return { mass: +mass.toFixed(2), volume: +volume.toFixed(1), payout: +payout.toFixed(1) };
}

// Depot propellant a module ship burns on its way to the selected site.
export const modulePropNeed = (s) => Math.ceil((rocketDef(s).shipMass ?? 0) * DESTINATIONS[s.dest].prop);

export const tliNeed = (s) => s.contracts.reduce((n, c) => n + (s.manifest.includes(c.id) && c.prop ? c.prop : 0), 0);

export function adjustSats(s, delta) {
  if (!s.tech.has('gen1') || rocketDef(s).role !== 'payload' || !SAT_DESTS.includes(s.dest)) return;
  s.sats = Math.max(0, Math.min(rocketDef(s).sats, s.sats + delta));
}

// ---- economy ---------------------------------------------------------------

export const coverage = (s, r) => Math.min(1, s.constellation[r.id] / r.satsFull);
export const regionRevenue = (s, r) => r.daily * REVENUE_SCALE * coverage(s, r);
export const dailyRevenue = (s) => REGIONS.reduce((sum, r) => sum + regionRevenue(s, r), 0);

// Purchases must leave enough cash to fly the cheapest launch, or the game could soft-lock.
export const canSpend = (s, amount) => s.cash - amount >= CASH_FLOOR;

export function launchCost(s) {
  const r = rocketDef(s);
  let c = r.refurb + r.ops;
  if (!r.catch && s.recovery === 'drone') c += DRONESHIP_FEE;
  if (r.role === 'payload') c += s.sats * SAT_COST;
  if (r.role === 'tanker') c += TANKER_PROP_COST;
  return +c.toFixed(2);
}

export function launchBlocker(s) {
  const r = rocketDef(s);
  const v = nextVehicle(s, s.rocket);
  if (!v) {
    const owned = fleetOf(s, s.rocket);
    if (!owned.length) return `No ${r.short} in the fleet: build one in the Factory`;
    return `${r.short} not ready: ${Math.min(...owned.map((x) => x.readyDay)) - s.day} day(s)`;
  }
  const pad = freePad(s);
  if (pad < 0) return `All pads busy: ${Math.min(...s.pads.map((p) => p.busyUntil)) - s.day} day(s)`;

  if (r.role === 'tanker') {
    if (!s.depot.built) return 'Needs a LEO depot first';
    if (s.depot.prop >= DEPOT_CAP) return 'Depot is full';
  } else if (r.role === 'depot') {
    if (s.depot.built) return 'Depot already deployed';
  } else if (r.role === 'module') {
    const d = DESTINATIONS[s.dest];
    if (d.body !== 'moon' || d.kind !== 'site') return 'Module ships land at a Moon site';
    if (s.base && s.base.site !== s.dest) return `Your base is at ${DESTINATIONS[s.base.site].name}`;
    if (!s.depot.built) return 'Lunar flights need a LEO depot';
    if (modulePropNeed(s) > s.depot.prop) return `Depot propellant ${Math.floor(s.depot.prop)}/${modulePropNeed(s)} t`;
  } else {
    const d = DESTINATIONS[s.dest];
    const t = manifestTotals(s);
    const cap = capacity(s);
    if (!destUnlocked(s, s.dest)) return 'Destination locked';
    if (!s.manifest.length && !s.sats) return 'Manifest is empty';
    if (t.mass > cap.mass) return 'Over payload mass limit';
    if (t.volume > cap.volume) return 'Over fairing volume limit';
    if (s.sats && !SAT_DESTS.includes(s.dest)) return 'Skylink satellites fly to LEO or Polar LEO';
    if (d.body !== 'earth') {
      if (s.rocket !== 'skyship') return `${d.name} needs a Skyship`;
      const need = tliNeed(s);
      if (!s.depot.built) return 'Lunar flights need a LEO depot';
      if (need > s.depot.prop) return `Depot propellant ${Math.floor(s.depot.prop)}/${need} t`;
    }
  }
  if (s.cash < launchCost(s)) return 'Not enough cash for launch costs';
  return null;
}

// Returns { ok, failed, trip } or { ok:false, reason }.
export function launch(s) {
  const reason = launchBlocker(s);
  if (reason) return { ok: false, reason };
  const r = rocketDef(s);
  const v = nextVehicle(s, s.rocket);
  const pad = s.pads[freePad(s)];
  const destId = effDest(s);
  const d = DESTINATIONS[destId];
  const cost = launchCost(s);
  s.cash -= cost;
  s.totalLaunches++;
  const failed = Math.random() < failChance(s, v);

  const trip = {
    id: s.nextId++, serial: v.serial, type: s.rocket, role: r.role, dest: destId,
    launchDay: s.day, arriveDay: s.day + d.days, status: 'enroute', payout: 0, sats: 0, region: s.region,
  };
  if (r.role === 'module') {
    trip.module = r.module;
    if (!failed) s.depot.prop -= modulePropNeed(s);
  }
  if (r.role === 'payload') {
    const t = manifestTotals(s);
    trip.payout = t.payout;
    trip.sats = s.sats;
    const need = tliNeed(s);
    s.contracts = s.contracts.filter((c) => !s.manifest.includes(c.id));
    s.manifest = [];
    s.sats = 0;
    if (!failed && need) s.depot.prop -= need;
  }

  if (failed) {
    trip.status = 'lost';
    s.fleet = s.fleet.filter((x) => x !== v);
    pad.busyUntil = s.day + (r.catch ? PAD_FAIL_CLOSED * 2 : PAD_FAIL_CLOSED);
    note(s, `${v.serial} LOST on ascent to ${d.name}. Hull and payload destroyed, ${pad.busyUntil - s.day} day pad repair.`);
  } else {
    pad.busyUntil = s.day + PAD_TURN;
    s.flightCounts[s.rocket] = (s.flightCounts[s.rocket] ?? 0) + 1;
    v.flights++;
    if (r.role === 'depot' || r.role === 'module') {
      s.fleet = s.fleet.filter((x) => x !== v); // single use
    } else {
      v.returnDay = s.day + (d.body === 'earth' ? d.days : d.days * 2);
      v.readyDay = s.day + roundTripDays(destId) + turnaround(s);
    }
    note(s, `${v.serial} launched to ${d.name}, arrives day ${trip.arriveDay} (cost $${cost}M).`);
    if (s.rocket === 'behemoth') {
      const n = s.flightCounts.behemoth;
      note(s, `Behemoth test flight ${n} complete.${n === 3 ? ' Skyship qualification flights done.' : ''}`);
    }
  }
  s.trips.push(trip);
  if (s.trips.length > MAX_TRIPS) {
    const i = s.trips.findIndex((x) => x.status !== 'enroute');
    if (i >= 0) s.trips.splice(i, 1);
  }
  return { ok: true, failed, trip };
}

export const activeTrips = (s) => s.trips.filter((t) => t.status === 'enroute');

function arrive(s, trip) {
  trip.status = 'done';
  const d = DESTINATIONS[trip.dest];
  if (trip.role === 'payload') {
    s.cash += trip.payout;
    const region = REGIONS.find((x) => x.id === trip.region);
    if (trip.sats) s.constellation[region.id] += trip.sats;
    const bits = [];
    if (trip.payout) bits.push(`+$${trip.payout}M`);
    if (trip.sats) bits.push(`${trip.sats} Skylink sats to ${region.name}`);
    note(s, `${trip.serial} arrived at ${d.name}.${bits.length ? ` ${bits.join(', ')}.` : ''}`);
  } else if (trip.role === 'module') {
    if (!s.base) {
      s.base = createBase(trip.dest);
      note(s, `${d.name} chosen as the base site.`);
    }
    s.base.pending.push({ id: s.base.nextId++, type: trip.module });
    note(s, `${trip.serial} landed at ${d.name}: open the Base view to place the module.`);
  } else if (trip.role === 'tanker') {
    s.depot.prop = Math.min(DEPOT_CAP, s.depot.prop + TANKER_LOAD);
    note(s, `${trip.serial} delivered ${TANKER_LOAD} t. Depot: ${Math.round(s.depot.prop)}/${DEPOT_CAP} t.`);
  } else {
    s.depot = { built: true, prop: 0 };
    note(s, `${trip.serial} is on station: LEO depot online. Fly tanker runs to fill it.`);
  }
}

// ---- research ---------------------------------------------------------------

export function techBlockers(s, id) {
  const t = TECH.find((x) => x.id === id);
  const out = t.requires.filter((q) => !s.tech.has(q)).map((q) => TECH.find((x) => x.id === q).name);
  if (t.flights) {
    const n = s.flightCounts[t.flights.rocket] ?? 0;
    if (n < t.flights.n) out.push(`Behemoth test flights ${n}/${t.flights.n}`);
  }
  return out;
}

export function techState(s, id) {
  if (s.tech.has(id)) return 'owned';
  return techBlockers(s, id).length ? 'locked' : 'available';
}

export function buyTech(s, id) {
  const t = TECH.find((x) => x.id === id);
  if (techState(s, id) !== 'available' || !canSpend(s, t.cost)) return false;
  s.cash -= t.cost;
  s.tech.add(id);
  note(s, `Research complete: ${t.name} (-$${t.cost}M).`);
  if (['hull', 'raptor', 'tiles'].includes(id) && rocketUnlocked(s, 'behemoth')) {
    note(s, 'Behemoth Prototype unlocked. Fly 3 successful test flights to qualify the Skyship.');
  }
  if (id === 'skyship') note(s, 'Operational Skyship unlocked: 150 t, 3-day turnaround.');
  if (id === 'tanker') note(s, 'Orbital Tanker unlocked. Build a Depot and Tanker Skyships, and the Moon opens up.');
  if (id === 'isru') note(s, 'Lunar logistics era reached. The Moon base is the next milestone (coming soon).');
  return true;
}

// ---- time ---------------------------------------------------------------------

export function tick(s) {
  s.day++;
  for (const r of REGIONS) s.constellation[r.id] *= 1 - 1 / SAT_LIFE_DAYS;
  if (s.depot.built) s.depot.prop *= 1 - BOILOFF_PER_DAY;

  for (const t of s.trips) if (t.status === 'enroute' && t.arriveDay <= s.day) arrive(s, t);
  tickBase(s, (m) => note(s, m));

  // Hulls past their rated flights retire once their last refit is done.
  for (const v of [...s.fleet]) {
    if (v.flights >= ROCKETS[v.type].coreLife && s.day >= v.readyDay) {
      s.fleet = s.fleet.filter((x) => x !== v);
      note(s, `${v.serial} retired after ${v.flights} flights.`);
    }
  }

  // Factory: each line works on one queued item.
  for (const q of s.queue.slice(0, s.lines)) q.daysLeft--;
  for (const q of s.queue.filter((x) => x.daysLeft <= 0)) {
    const v = addVehicle(s, q.type);
    note(s, `${v.serial} rolled out of the factory.`);
  }
  s.queue = s.queue.filter((q) => q.daysLeft > 0);

  s.income = dailyRevenue(s);
  s.cash += s.income;
  // Payroll is covered by investors below the floor, so a bad run never locks the game.
  s.cash = Math.max(s.cash - OVERHEAD_PER_DAY, Math.min(s.cash, CASH_FLOOR));

  // Investors step in when the company can no longer fly anything.
  const p9 = ROCKETS.peregrine9;
  const hasCargoHull = [...s.fleet, ...s.queue].some((x) => ROCKETS[x.type].role === 'payload');
  if (!hasCargoHull && s.cash < p9.buildCost + CASH_FLOOR) {
    s.cash = p9.buildCost + CASH_FLOOR;
    note(s, 'Investors wire emergency funding: queue a new Peregrine 9.');
  }
  if (hasCargoHull && s.income < 0.05 && s.cash < p9.refurb + p9.ops && !activeTrips(s).length) {
    s.cash = CASH_FLOOR;
    note(s, 'Investors cover launch costs.');
  }

  const expired = s.contracts.filter((c) => c.expires < s.day);
  if (expired.length) {
    s.contracts = s.contracts.filter((c) => c.expires >= s.day);
    s.manifest = s.manifest.filter((id) => s.contracts.some((c) => c.id === id));
  }
  if (s.day % 3 === 0 && s.contracts.length < 8) s.contracts.push(newContract(s));
}
