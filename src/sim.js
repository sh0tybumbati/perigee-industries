// Pure game simulation: no Phaser or Three here, so it can be tested under plain node.
import {
  ROCKETS, SAT_MASS, SAT_VOLUME, SAT_LIFE_DAYS, SAT_COST, REGIONS, CUSTOMERS, TECH,
  OVERHEAD_PER_DAY, CASH_FLOOR, BEHEMOTH_LEARNING, BEHEMOTH_MIN_RISK,
  DEPOT_CAP, TANKER_LOAD, BOILOFF_PER_DAY,
  DESTINATIONS, EARTH_ORBITS, LUNAR_DESTS, SAT_DESTS,
  SITES, SITE_IDS, LEASE_FEE, BAY_FEE, BAY_RENT_DEPOSIT, BAY_BUY_COST, MAX_BAYS, PAD_COSTS, TOWER_COST, PAD_TURN,
  PAD_FAIL_CLOSED, LINE_COSTS, CANCEL_REFUND, DRONESHIP_FEE, DRONESHIP_COST, MAX_DRONESHIPS, DRONESHIP_CYCLE,
  DRONE_TOW_DAYS, RTLS_PAYLOAD_PENALTY, EXPEND_BONUS, COMMODITIES, MARKET_MIN, MARKET_MAX, BULK_DISCOUNT,
  RUSH_PREMIUM, START_CAPS, START_STOCK, TANK_STEP, PLANT_RATE, PLANT_COST, PLANT_MAX, PLANT_COST_FRAC,
  MARS_WINDOW, MARS_ROUTES, MARS_DESTS, MARS_CONTRACT,
} from './data.js';
import { createBase, tickBase } from './base.js';

export { OVERHEAD_PER_DAY };
export const SAT_BATCH = 6;
export const REVENUE_SCALE = 0.3;
export const SAVE_VERSION = 5;
const MAX_TRIPS = 80;
const rnd = (a, b) => a + Math.random() * (b - a);

function pickWeighted(items, weights) {
  let r = Math.random() * weights.reduce((n, w) => n + w, 0);
  const i = weights.findIndex((w) => (r -= w) < 0);
  return items[i < 0 ? 0 : i];
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---- sites ----------------------------------------------------------------------

const newPad = (d, i) => ({ name: d.pads[i], tower: !!d.towers, busyUntil: 0 });

// status: 'locked' (not available yet), 'leased' or 'owned'.
function makeSite(id, status) {
  const d = SITES[id];
  const active = status !== 'locked';
  return {
    id,
    status,
    pads: active ? [newPad(d, 0)] : [],
    bays: active ? [{ tenure: status === 'owned' ? 'owned' : 'rented', freeAt: 0 }] : [],
    stock: id === 'cape' ? { ...START_STOCK } : { kerolox: 0, methalox: 0, steel: 0 },
    cap: { ...START_CAPS },
    plants: { kerolox: 0, methalox: 0 },
    lines: active && d.factory ? 1 : 0,
    queue: [],
  };
}

export function createState() {
  const s = {
    day: 1,
    cash: 60,
    income: 0,
    fleet: [], // individual hulls
    serials: {},
    sites: Object.fromEntries(SITE_IDS.map((id) => [id, makeSite(id, SITES[id].start ?? 'locked')])),
    site: 'cape', // selected launch site
    droneships: [{ busyUntil: 0 }],
    market: { kerolox: 1, methalox: 1, steel: 1 }, // spot price multipliers
    trips: [], // flight records, active and past
    flightCounts: {}, // successful flights per vehicle type
    contracts: [],
    manifest: [],
    sats: 0,
    rocket: 'peregrine9', // selected vehicle type
    dest: 'leo', // selected destination
    recovery: 'rtls', // rtls | drone | expend (booster-class vehicles only)
    marsRoute: 'direct', // direct (from Earth) | moon (a Moon-built Skyship leaves the base)
    region: 'na',
    constellation: Object.fromEntries(REGIONS.map((r) => [r.id, 0])),
    depot: { built: false, prop: 0 },
    base: null, // the lunar base, founded by the first module ship to land
    tech: new Set(),
    log: [],
    totalLaunches: 0,
    nextId: 1,
  };
  addVehicle(s, 'peregrine9', 'cape');
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
    if (o.v === 2) return migrateV4(migrateV2(o));
    if (o.v === 3) o.v = 4; // v4 only adds the lunar base
    if (o.v === 4) return migrateV4(o);
    if (o.v !== SAVE_VERSION) return null;
    const base = createState();
    const s = { ...base, ...o, tech: new Set(Array.isArray(o.tech) ? o.tech : []) };
    delete s.v;
    s.constellation = { ...base.constellation, ...o.constellation };
    s.depot = { ...base.depot, ...o.depot };
    s.flightCounts = { ...o.flightCounts };
    s.serials = { ...o.serials };
    s.market = { ...base.market, ...o.market };
    for (const k of ['fleet', 'trips', 'queue', 'contracts', 'manifest', 'droneships']) if (k in s && !Array.isArray(s[k])) s[k] = base[k];
    s.droneships = Array.isArray(o.droneships) ? o.droneships : base.droneships;
    s.base = s.base && Array.isArray(s.base.modules) ? { ...createBase(s.base.site), ...s.base, stock: { ...createBase('').stock, ...s.base.stock } } : null;
    s.sites = Object.fromEntries(SITE_IDS.map((id) => [id, o.sites?.[id] ? { ...makeSite(id, 'locked'), ...o.sites[id] } : base.sites[id]]));
    s.fleet = s.fleet.filter((v) => ROCKETS[v.type]).map((v) => ({ site: 'cape', ...v }));
    if (!ROCKETS[s.rocket] || !rocketUnlocked(s, s.rocket)) s.rocket = 'peregrine9';
    if (!DESTINATIONS[s.dest] || !destUnlocked(s, s.dest)) s.dest = 'leo';
    if (!s.sites[s.site] || s.sites[s.site].status === 'locked') s.site = 'cape';
    if (!['rtls', 'drone', 'expend'].includes(s.recovery)) s.recovery = 'rtls';
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
    if (rocketUnlocked(s, id) && worn < ROCKETS[id].coreLife) addVehicle(s, id, 'cape').flights = worn;
  }
  if (!s.fleet.length) addVehicle(s, 'peregrine9', 'cape');
  if (ROCKETS[o.rocket] && rocketUnlocked(s, o.rocket)) s.rocket = o.rocket;
  if (!REGIONS.some((r) => r.id === s.region)) s.region = 'na';
  // Hand the v4 migration the pieces it expects.
  return { ...s, tech: [...s.tech], pads: [{ busyUntil: 0 }], lines: 1, queue: [], v: 4 };
}

// v4 had a flat list of pads and one factory. They become Cape Canaveral, owned if the company had grown.
function migrateV4(o) {
  const s = createState();
  for (const k of ['day', 'cash', 'income', 'fleet', 'serials', 'trips', 'flightCounts', 'contracts', 'manifest', 'sats', 'rocket', 'dest', 'region', 'constellation', 'depot', 'base', 'log', 'totalLaunches', 'nextId']) {
    if (o[k] !== undefined) s[k] = o[k];
  }
  if (['rtls', 'drone'].includes(o.recovery)) s.recovery = o.recovery;
  s.tech = new Set(Array.isArray(o.tech) ? o.tech : []);
  s.fleet = (s.fleet ?? []).filter((v) => ROCKETS[v.type]).map((v) => ({ site: 'cape', ...v }));
  const pads = Array.isArray(o.pads) && o.pads.length ? o.pads : [{ busyUntil: 0 }];
  const grown = pads.length > 1 || (o.lines ?? 1) > 1;
  const cape = s.sites.cape;
  const hasCatch = s.fleet.some((v) => ROCKETS[v.type].catch);
  cape.status = grown ? 'owned' : 'leased';
  cape.pads = pads.slice(0, 3).map((p, i) => ({ name: SITES.cape.pads[i], tower: hasCatch, busyUntil: p.busyUntil ?? 0 }));
  const bayN = Math.min(grown ? 3 : 2, Math.max(1, Math.ceil(s.fleet.length / 2)));
  cape.bays = Array.from({ length: bayN }, () => ({ tenure: grown ? 'owned' : 'rented', freeAt: 0 }));
  cape.lines = o.lines ?? 1;
  cape.queue = Array.isArray(o.queue) ? o.queue : [];
  if (!ROCKETS[s.rocket] || !rocketUnlocked(s, s.rocket)) s.rocket = 'peregrine9';
  if (!DESTINATIONS[s.dest] || !destUnlocked(s, s.dest)) s.dest = 'leo';
  note(s, 'Save upgraded: launch sites, hangars, droneships and the fuel market are new.');
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

// ---- Mars: launch windows and routes ------------------------------------------------------

export function marsWindow(day) {
  const { first, period, length } = MARS_WINDOW;
  if (day < first) return { open: false, opensIn: first - day, closesIn: 0 };
  const phase = (day - first) % period;
  if (phase < length) return { open: true, opensIn: 0, closesIn: length - phase };
  return { open: false, opensIn: period - phase, closesIn: 0 };
}

export const isMars = (id) => DESTINATIONS[id].body === 'mars';
// A Mars flight from the Moon uses a Moon-built hull and the base's methalox, with no Earth pad at all.
export const originIsMoon = (s) => rocketDef(s).role === 'payload' && isMars(s.dest) && s.marsRoute === 'moon';
export const marsMoonNeed = (s) => Math.ceil(MARS_ROUTES.moon.hullFuel + MARS_ROUTES.moon.fuelPerTon * manifestTotals(s).mass);
export const setMarsRoute = (s, route) => { if (MARS_ROUTES[route]) s.marsRoute = route; };

// ---- contracts -------------------------------------------------------------------

function pickTier(s) {
  const tiers = [{ w: 0.5, min: 1.5, max: 17, rate: [0.31, 0.5] }];
  if (s.tech.has('heavyCores')) tiers.push({ w: 0.2, min: 22, max: 60, rate: [0.6, 0.88] });
  if (rocketUnlocked(s, 'behemoth')) tiers.push({ w: 0.15, min: 60, max: 100, rate: [0.77, 1.1] });
  if (s.tech.has('skyship')) tiers.push({ w: 0.12, min: 100, max: 140, rate: [0.6, 0.88] });
  return pickWeighted(tiers, tiers.map((t) => t.w));
}

// Bigger payloads pay more per tonne (heavy-lift premium), and appear as each vehicle tier unlocks.
function newMarsContract(s) {
  const dest = pickWeighted(MARS_DESTS, [0.3, 0.4, 0.3]);
  const mass = +rnd(...MARS_CONTRACT.mass).toFixed(1);
  return {
    id: s.nextId++,
    customer: pick(CUSTOMERS),
    dest,
    mass,
    volume: Math.min(380, Math.round(mass * rnd(1.5, 2.4))),
    prop: Math.ceil(mass * DESTINATIONS[dest].prop),
    payout: +(mass * rnd(...MARS_CONTRACT.rate) + rnd(...MARS_CONTRACT.base)).toFixed(1),
    expires: s.day + MARS_CONTRACT.expires,
  };
}

function newContract(s) {
  if (s.tech.has('marsTransit') && Math.random() < MARS_CONTRACT.chance) return newMarsContract(s);
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

function addVehicle(s, type, siteId = 'cape') {
  const n = (s.serials[type] = (s.serials[type] ?? 0) + 1);
  const v = { id: s.nextId++, type, serial: `${ROCKETS[type].code}-${String(n).padStart(2, '0')}`, flights: 0, returnDay: 0, readyDay: s.day, site: siteId };
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
// Moon-based hulls fly only from the Moon, and Earth hulls only from Earth.
export const nextVehicle = (s, type) => readyVehicles(s, type).filter((v) => (v.site === 'moon') === originIsMoon(s)).sort((a, b) => a.flights - b.flights)[0] ?? null;

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
  if (isMars(effDest(s)) && !originIsMoon(s)) base += MARS_ROUTES.direct.ascentRisk;
  return base + r.wearRisk * (v?.flights ?? 0);
}

// How the booster comes back: catch vehicles use the tower, others pick RTLS, droneship or expend.
export const recoveryOf = (s) => (rocketDef(s).catch ? 'catch' : s.recovery);

export function capacity(s) {
  const r = rocketDef(s);
  const rec = recoveryOf(s);
  const f = rec === 'rtls' ? 1 - RTLS_PAYLOAD_PENALTY : rec === 'expend' ? 1 + EXPEND_BONUS : 1;
  return { mass: +(r.payload * f).toFixed(1), volume: r.volume };
}

// Days a hull spends in a hangar after it has landed and been recovered.
export function refitDays(s) {
  const r = rocketDef(s);
  if (r.catch) return r.turnaround;
  return Math.max(2, r.turnaround - 2 - (s.tech.has('fastCores') ? 2 : 0));
}

// ---- sites: leasing, pads, hangars, towers ---------------------------------------------------

export const siteDef = (id) => SITES[id];
export const siteActive = (s, id) => s.sites[id].status !== 'locked';

export function setSite(s, id) {
  if (!s.sites[id] || !siteActive(s, id)) return false;
  s.site = id;
  return true;
}

export function siteAllows(id, destId) {
  const d = SITES[id];
  if (d.allowDests) return d.allowDests.includes(destId);
  return !(d.noDests ?? []).includes(destId);
}

export function siteBlocker(s, id, mode) {
  const site = s.sites[id];
  const price = SITES[id].price[mode];
  if (price === undefined) return 'Not available';
  if (mode === 'lease' && site.status !== 'locked') return 'Already open';
  if (mode === 'buy' && site.status === 'owned') return 'Already owned';
  if (!canSpend(s, price)) return 'Not enough cash';
  return null;
}

export function acquireSite(s, id, mode) {
  if (siteBlocker(s, id, mode)) return false;
  const price = SITES[id].price[mode];
  s.cash -= price;
  if (mode === 'lease') {
    s.sites[id] = makeSite(id, 'leased');
    note(s, `Leased ${SITES[id].name} (-$${price}M).`);
  } else {
    if (s.sites[id].status === 'locked') s.sites[id] = makeSite(id, 'owned');
    else {
      s.sites[id].status = 'owned';
      s.sites[id].bays.forEach((b) => { b.tenure = 'owned'; });
    }
    note(s, `Bought ${SITES[id].name} (-$${price}M).`);
  }
  return true;
}

export function padBlocker(s, id) {
  const site = s.sites[id];
  if (site.status !== 'owned') return 'Own the site first';
  if (site.pads.length >= SITES[id].pads.length) return 'All pads built';
  return canSpend(s, PAD_COSTS[site.pads.length]) ? null : 'Not enough cash';
}

export function buyPad(s, id) {
  if (padBlocker(s, id)) return false;
  const site = s.sites[id];
  const cost = PAD_COSTS[site.pads.length];
  s.cash -= cost;
  site.pads.push(newPad(SITES[id], site.pads.length));
  note(s, `${SITES[id].pads[site.pads.length - 1]} built at ${SITES[id].short} (-$${cost}M).`);
  return true;
}

export function towerBlocker(s, id, i) {
  const site = s.sites[id];
  if (site.status !== 'owned') return 'Own the site first';
  if (site.pads[i].tower) return 'Has a tower';
  return canSpend(s, TOWER_COST) ? null : 'Not enough cash';
}

export function buildTower(s, id, i) {
  if (towerBlocker(s, id, i)) return false;
  s.cash -= TOWER_COST;
  s.sites[id].pads[i].tower = true;
  note(s, `Catch tower built on ${s.sites[id].pads[i].name} (-$${TOWER_COST}M).`);
  return true;
}

export function bayBlocker(s, id) {
  const site = s.sites[id];
  if (site.status === 'locked') return 'Not available';
  if (site.bays.length >= MAX_BAYS[site.status]) return site.status === 'leased' ? 'Buy the site for more hangars' : 'All hangars built';
  const cost = site.status === 'owned' ? BAY_BUY_COST : BAY_RENT_DEPOSIT;
  return canSpend(s, cost) ? null : 'Not enough cash';
}

export function addBay(s, id) {
  if (bayBlocker(s, id)) return false;
  const site = s.sites[id];
  const owned = site.status === 'owned';
  const cost = owned ? BAY_BUY_COST : BAY_RENT_DEPOSIT;
  s.cash -= cost;
  site.bays.push({ tenure: owned ? 'owned' : 'rented', freeAt: s.day });
  note(s, `${owned ? 'Bought' : 'Rented'} a hangar at ${SITES[id].short} (-$${cost}M).`);
  return true;
}

export const bestBay = (site) => site.bays.reduce((a, b) => (b.freeAt < a.freeAt ? b : a), site.bays[0]);

// A free pad at the site (with a catch tower when the vehicle needs one).
export function pickPad(site, needTower, day) {
  return site.pads.findIndex((p) => day >= p.busyUntil && (!needTower || p.tower));
}

// ---- droneships ---------------------------------------------------------------------------------

export const freeDroneship = (s) => s.droneships.findIndex((d) => s.day >= d.busyUntil);

export function buyDroneship(s) {
  if (s.droneships.length >= MAX_DRONESHIPS || !canSpend(s, DRONESHIP_COST)) return false;
  s.cash -= DRONESHIP_COST;
  s.droneships.push({ busyUntil: 0 });
  note(s, `Droneship ${s.droneships.length} commissioned (-$${DRONESHIP_COST}M).`);
  return true;
}

// ---- market, tanks and plants ------------------------------------------------------------------------

export const spot = (s, type) => COMMODITIES[type].price * s.market[type];

export function buyBlocker(s, id, type) {
  const site = s.sites[id];
  if (site.status === 'locked') return 'Not available';
  if (site.stock[type] >= site.cap[type] - 0.01) return 'Tank is full';
  return null;
}

// Fills up to `amount` tonnes of free tank space at the bulk price. Returns the tonnes bought.
export function buyCommodity(s, id, type, amount) {
  if (buyBlocker(s, id, type)) return 0;
  const site = s.sites[id];
  let t = Math.min(amount, site.cap[type] - site.stock[type]);
  const unit = spot(s, type) * BULK_DISCOUNT;
  while (t > 0.01 && !canSpend(s, t * unit)) t = Math.floor(t / 2);
  if (t < 0.01) return 0;
  site.stock[type] += t;
  s.cash -= t * unit;
  return +t.toFixed(1);
}

export function tankBlocker(s, id, type) {
  if (s.sites[id].status !== 'owned') return 'Own the site first';
  return canSpend(s, TANK_STEP[type].cost) ? null : 'Not enough cash';
}

export function expandTank(s, id, type) {
  if (tankBlocker(s, id, type)) return false;
  s.cash -= TANK_STEP[type].cost;
  s.sites[id].cap[type] += TANK_STEP[type].t;
  note(s, `${COMMODITIES[type].name} storage at ${SITES[id].short} grew by ${TANK_STEP[type].t} t (-$${TANK_STEP[type].cost}M).`);
  return true;
}

export function plantBlocker(s, id, fuel) {
  const site = s.sites[id];
  if (!s.tech.has('plants')) return 'Research Propellant Plants';
  if (site.status !== 'owned') return 'Own the site first';
  if (site.plants[fuel] >= PLANT_MAX) return 'Fully built';
  return canSpend(s, PLANT_COST) ? null : 'Not enough cash';
}

export function buildPlant(s, id, fuel) {
  if (plantBlocker(s, id, fuel)) return false;
  s.cash -= PLANT_COST;
  s.sites[id].plants[fuel]++;
  note(s, `${COMMODITIES[fuel].name} plant level ${s.sites[id].plants[fuel]} at ${SITES[id].short} (-$${PLANT_COST}M).`);
  return true;
}

function tickMarket(s) {
  for (const type of Object.keys(COMMODITIES)) {
    const m = s.market[type];
    s.market[type] = Math.min(MARKET_MAX, Math.max(MARKET_MIN, m + (1 - m) * 0.06 + (Math.random() - 0.5) * 0.1));
  }
}

function tickPlants(s) {
  for (const site of Object.values(s.sites)) {
    if (site.status !== 'owned') continue;
    for (const fuel of ['kerolox', 'methalox']) {
      const level = site.plants[fuel];
      if (!level) continue;
      const make = Math.min(level * PLANT_RATE, site.cap[fuel] - site.stock[fuel]);
      const cost = make * COMMODITIES[fuel].price * PLANT_COST_FRAC;
      if (make > 0 && s.cash >= cost) { site.stock[fuel] += make; s.cash -= cost; }
    }
  }
}

// ---- factory (one per site) ----------------------------------------------------------------------------------

export const factorySites = (s) => SITE_IDS.filter((id) => SITES[id].factory && s.sites[id].status !== 'locked');

export function buildCostAt(type, siteId) {
  const r = ROCKETS[type];
  const k = r.catch && SITES[siteId].catchDiscount ? SITES[siteId].catchDiscount : 1;
  return { cost: +(r.buildCost * k).toFixed(1), days: Math.max(1, Math.round(r.buildDays * k)) };
}

const steelShortage = (s, siteId, type) => Math.max(0, ROCKETS[type].steel - s.sites[siteId].stock.steel);

export function buildBlocker(s, type, siteId = 'cape') {
  const r = ROCKETS[type];
  const site = s.sites[siteId];
  if (!rocketUnlocked(s, type)) return 'Locked';
  if (!site || !site.lines) return 'No factory here';
  if (r.role === 'depot' && (s.depot.built || fleetOf(s, type).length || Object.values(s.sites).some((x) => x.queue.some((q) => q.type === type)))) return 'Only one depot is needed';
  const total = buildCostAt(type, siteId).cost + steelShortage(s, siteId, type) * spot(s, 'steel') * RUSH_PREMIUM;
  if (!canSpend(s, total)) return 'Not enough cash';
  return null;
}

export function queueBuild(s, type, siteId = 'cape') {
  if (buildBlocker(s, type, siteId)) return false;
  const r = ROCKETS[type];
  const site = s.sites[siteId];
  const { cost, days } = buildCostAt(type, siteId);
  const short = steelShortage(s, siteId, type);
  const rush = short * spot(s, 'steel') * RUSH_PREMIUM;
  site.stock.steel -= r.steel - short;
  s.cash -= cost + rush;
  site.queue.push({ id: s.nextId++, type, daysLeft: days, total: days, cost });
  note(s, `Queued ${r.name} at ${SITES[siteId].short} (-$${(cost + rush).toFixed(1)}M, ${days} days).`);
  return true;
}

export function cancelBuild(s, siteId, id) {
  const site = s.sites[siteId];
  const q = site.queue.find((x) => x.id === id);
  if (!q || q.daysLeft < q.total) return false; // work has started
  const refund = +(q.cost * CANCEL_REFUND).toFixed(1);
  site.queue = site.queue.filter((x) => x.id !== id);
  s.cash += refund;
  note(s, `Cancelled ${ROCKETS[q.type].name}, refunded $${refund}M.`);
  return true;
}

export function lineBlocker(s, siteId) {
  const site = s.sites[siteId];
  if (!SITES[siteId].factory || site.status !== 'owned') return 'Own the site first';
  const cost = LINE_COSTS[site.lines];
  if (cost === undefined) return 'All lines built';
  return canSpend(s, cost) ? null : 'Not enough cash';
}

export function buyLine(s, siteId = 'cape') {
  if (lineBlocker(s, siteId)) return false;
  const site = s.sites[siteId];
  const cost = LINE_COSTS[site.lines];
  s.cash -= cost;
  site.lines++;
  note(s, `Production line ${site.lines} online at ${SITES[siteId].short} (-$${cost}M).`);
  return true;
}

// Reputation: every successful flight makes customers more likely to call, so a bigger fleet has work to do.
export const reputation = (s) => Object.values(s.flightCounts).reduce((n, c) => n + c, 0);
export function boardSize(s) {
  const rep = reputation(s);
  if (rep >= 120) return { every: 1, cap: 12 };
  if (rep >= 40) return { every: 2, cap: 10 };
  return { every: 3, cap: 8 };
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

export const fuelNeed = (s) => {
  const r = rocketDef(s);
  return { type: r.fuel.type, t: r.fuel.t + (r.role === 'tanker' ? TANKER_LOAD : 0) };
};

// Itemized cash cost of the planned launch. Propellant already in the site's tanks costs nothing more here.
export function launchCosts(s) {
  const r = rocketDef(s);
  if (originIsMoon(s)) {
    const need = marsMoonNeed(s);
    return { items: [{ label: 'Operations', amt: r.ops }], total: r.ops, fuel: { type: 'methalox', t: need, fromTanks: need, short: 0 } };
  }
  const site = s.sites[s.site];
  const rec = recoveryOf(s);
  const items = [];
  const add = (label, amt) => { if (amt > 0.0005) items.push({ label, amt: +amt.toFixed(2) }); };
  const need = fuelNeed(s);
  const have = site?.stock[need.type] ?? 0;
  const short = Math.max(0, need.t - have);
  add(`Propellant bought (${Math.ceil(short)} t at spot)`, short * spot(s, need.type) * RUSH_PREMIUM);
  if (!r.catch) add('Expended upper stage', r.stage);
  if (rec !== 'expend') add('Refurbishment parts', r.refurb);
  add('Operations', r.ops);
  if (site?.status === 'leased') add('Pad lease', LEASE_FEE);
  if (site?.bays.length && rec !== 'expend' && r.role !== 'depot' && r.role !== 'module' && bestBay(site).tenure === 'rented') add('Hangar rental', BAY_FEE);
  if (rec === 'drone') add('Droneship', DRONESHIP_FEE);
  if (r.role === 'payload') add('Skylink satellites', s.sats * SAT_COST);
  const total = +items.reduce((n, i) => n + i.amt, 0).toFixed(2);
  return { items, total, fuel: { ...need, fromTanks: Math.min(need.t, have), short } };
}

export const launchCost = (s) => launchCosts(s).total;

export function launchBlocker(s) {
  const r = rocketDef(s);
  const v = nextVehicle(s, s.rocket);
  const moon = originIsMoon(s);
  if (!v) {
    if (moon) return 'No Moon-built Skyship at the base (build one with the Fabricator)';
    const owned = fleetOf(s, s.rocket).filter((x) => (x.site === 'moon') === moon);
    if (!owned.length) return `No ${r.short} in the fleet: build one in the Factory`;
    return `${r.short} not ready: ${Math.min(...owned.map((x) => x.readyDay)) - s.day} day(s)`;
  }
  if (!moon) {
    const site = s.sites[s.site];
    if (!site || site.status === 'locked') return 'Pick a launch site you have access to';
    const eff = effDest(s);
    if (!siteAllows(s.site, eff)) return `${SITES[s.site].short} cannot launch to ${DESTINATIONS[eff].name}`;
    if (pickPad(site, r.catch, s.day) < 0) {
      if (r.catch && site.pads.length && !site.pads.some((p) => p.tower)) return 'Needs a catch tower on a pad (Sites tab)';
      const soon = Math.min(...site.pads.filter((p) => !r.catch || p.tower).map((p) => p.busyUntil));
      return `All pads busy: ${soon - s.day} day(s)`;
    }
    if (!r.catch && s.recovery === 'drone' && freeDroneship(s) < 0) return `No droneship free: ${Math.min(...s.droneships.map((d) => d.busyUntil)) - s.day} day(s)`;

  }

  if (r.role === 'tanker') {
    if (!s.depot.built) return 'Needs a LEO depot first';
    if (s.depot.prop >= DEPOT_CAP) return 'Depot is full';
  } else if (r.role === 'depot') {
    if (s.depot.built) return 'Depot already deployed';
  } else if (r.role === 'module') {
    const d = DESTINATIONS[s.dest];
    if (d.body !== 'moon' || d.kind !== 'site') return 'Module ships land at a Moon site';
    if (s.base && s.base.site !== s.dest) return `Your base is at ${DESTINATIONS[s.base.site].name}`;
    if (r.module === 'icer' && s.dest !== 'shackleton') return 'Ice only exists at Shackleton Crater';
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
    if (d.body === 'mars') {
      if (s.rocket !== 'skyship') return 'Mars needs a Skyship';
      const w = marsWindow(s.day);
      if (!w.open) return `Mars window opens in ${w.opensIn} days`;
      if (moon) {
        const need = marsMoonNeed(s);
        if (!s.base) return 'A Moon base is needed';
        if (s.base.stock.methalox < need) return `Base methalox ${Math.floor(s.base.stock.methalox)}/${need} t`;
      } else {
        if (!s.depot.built) return 'Mars flights need a LEO depot';
        if (tliNeed(s) > s.depot.prop) return `Depot propellant ${Math.floor(s.depot.prop)}/${tliNeed(s)} t`;
      }
    } else if (d.body !== 'earth') {
      if (s.rocket !== 'skyship') return `${d.name} needs a Skyship`;
      const need = tliNeed(s);
      if (!s.depot.built) return 'Lunar flights need a LEO depot';
      if (need > s.depot.prop) return `Depot propellant ${Math.floor(s.depot.prop)}/${need} t`;
    }
  }
  if (s.cash < launchCosts(s).total) return 'Not enough cash for launch costs';
  return null;
}

// Returns { ok, failed, trip } or { ok:false, reason }.
export function launch(s) {
  const reason = launchBlocker(s);
  if (reason) return { ok: false, reason };
  const r = rocketDef(s);
  const v = nextVehicle(s, s.rocket);
  const moon = originIsMoon(s);
  const site = moon ? null : s.sites[s.site];
  const pad = moon ? null : site.pads[pickPad(site, r.catch, s.day)];
  const destId = effDest(s);
  const d = DESTINATIONS[destId];
  const mars = isMars(destId);
  const rec = moon ? 'catch' : recoveryOf(s);
  const costs = launchCosts(s);
  const cost = costs.total;
  // Propellant leaves the tanks whatever happens on ascent.
  if (moon) s.base.stock.methalox -= costs.fuel.t;
  else site.stock[costs.fuel.type] -= costs.fuel.fromTanks;
  s.cash -= cost;
  s.totalLaunches++;
  const failed = Math.random() < failChance(s, v);
  const route = mars ? MARS_ROUTES[moon ? 'moon' : 'direct'] : null;

  const trip = {
    id: s.nextId++, serial: v.serial, type: s.rocket, role: r.role, dest: destId, site: moon ? null : s.site,
    origin: moon ? 'moon' : 'earth', fromSite: moon ? s.base.site : undefined,
    launchDay: s.day, arriveDay: s.day + (route ? route.days : d.days), status: 'enroute', payout: 0, sats: 0, region: s.region,
    landRisk: route ? route.landRisk : 0,
  };
  if (r.role === 'module') {
    trip.module = r.module;
    if (!failed) s.depot.prop -= modulePropNeed(s);
  }
  if (r.role === 'payload') {
    const t = manifestTotals(s);
    trip.payout = t.payout;
    trip.sats = s.sats;
    const need = moon ? 0 : tliNeed(s);
    s.contracts = s.contracts.filter((c) => !s.manifest.includes(c.id));
    s.manifest = [];
    s.sats = 0;
    if (!failed && need) s.depot.prop -= need;
  }

  const from = moon ? 'the Moon base' : SITES[s.site].short;
  if (failed) {
    trip.status = 'lost';
    s.fleet = s.fleet.filter((x) => x !== v);
    if (pad) pad.busyUntil = s.day + (r.catch ? PAD_FAIL_CLOSED * 2 : PAD_FAIL_CLOSED);
    note(s, `${v.serial} LOST on ascent from ${from} to ${d.name}. Hull and payload destroyed${pad ? `, ${pad.busyUntil - s.day} day pad repair` : ''}.`);
  } else {
    if (pad) pad.busyUntil = s.day + PAD_TURN;
    s.flightCounts[s.rocket] = (s.flightCounts[s.rocket] ?? 0) + 1;
    v.flights++;
    if (rec === 'drone') s.droneships[freeDroneship(s)].busyUntil = s.day + DRONESHIP_CYCLE;
    if (r.role === 'depot' || r.role === 'module' || rec === 'expend' || mars) {
      s.fleet = s.fleet.filter((x) => x !== v); // single use, expended, or on a one-way trip to Mars
    } else {
      const bay = bestBay(site);
      const start = Math.max(s.day + roundTripDays(destId) + (rec === 'drone' ? DRONE_TOW_DAYS : 0), bay.freeAt);
      v.readyDay = start + refitDays(s);
      bay.freeAt = v.readyDay;
      v.returnDay = s.day + (d.body === 'earth' ? d.days : d.days * 2);
      v.site = s.site;
    }
    const how = rec === 'expend' ? ', booster expended' : rec === 'drone' ? ', droneship landing' : '';
    note(s, `${v.serial} launched from ${from} to ${d.name}, arrives day ${trip.arriveDay}${how} (cost $${cost}M).`);
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
  const d = DESTINATIONS[trip.dest];
  if (trip.landRisk && Math.random() < trip.landRisk) {
    trip.status = 'lost';
    note(s, `${trip.serial} was lost entering the Martian atmosphere. Payload and hull destroyed.`);
    return;
  }
  trip.status = 'done';
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
    note(s, 'Behemoth Prototype unlocked. It needs a pad with a catch tower: build one, or buy Boca Chica.');
  }
  if (id === 'skyship') note(s, 'Operational Skyship unlocked: 150 t, 3-day turnaround.');
  if (id === 'plants') note(s, 'Propellant Plants unlocked: owned sites can make their own fuel.');
  if (id === 'tanker') note(s, 'Orbital Tanker unlocked. Build a Depot and Tanker Skyships, and the Moon opens up.');
  if (id === 'isru') note(s, 'Lunar ISRU unlocked: smelters and a Fabricator can run on the Moon.');
  if (id === 'ice') note(s, 'Lunar Ice Mining unlocked: Ice Miner and Refinery module ships (at Shackleton).');
  if (id === 'marsTransit') note(s, `Mars Transfer unlocked. ${marsWindow(s.day).open ? 'A launch window is open now.' : `The next window opens in ${marsWindow(s.day).opensIn} days.`}`);
  return true;
}

// ---- time ---------------------------------------------------------------------

export function tick(s) {
  s.day++;
  for (const r of REGIONS) s.constellation[r.id] *= 1 - 1 / SAT_LIFE_DAYS;
  if (s.depot.built) s.depot.prop *= 1 - BOILOFF_PER_DAY;
  tickMarket(s);

  for (const t of s.trips) if (t.status === 'enroute' && t.arriveDay <= s.day) arrive(s, t);
  tickBase(s, (m) => note(s, m));
  while (s.base?.ships?.length) {
    const made = s.base.ships.shift();
    const v = addVehicle(s, made.type, 'moon');
    note(s, `${v.serial} was built at the Moon base and is ready to fly from there.`);
  }

  // Hulls past their rated flights retire once their last refit is done.
  for (const v of [...s.fleet]) {
    if (v.flights >= ROCKETS[v.type].coreLife && s.day >= v.readyDay) {
      s.fleet = s.fleet.filter((x) => x !== v);
      note(s, `${v.serial} retired after ${v.flights} flights.`);
    }
  }

  // Each site's factory: every line works on one queued item.
  for (const site of Object.values(s.sites)) {
    for (const q of site.queue.slice(0, site.lines)) q.daysLeft--;
    for (const q of site.queue.filter((x) => x.daysLeft <= 0)) {
      const v = addVehicle(s, q.type, site.id);
      note(s, `${v.serial} rolled out of the ${SITES[site.id].short} factory.`);
    }
    site.queue = site.queue.filter((q) => q.daysLeft > 0);
  }
  tickPlants(s);

  s.income = dailyRevenue(s);
  s.cash += s.income;
  // Payroll is covered by investors below the floor, so a bad run never locks the game.
  s.cash = Math.max(s.cash - OVERHEAD_PER_DAY, Math.min(s.cash, CASH_FLOOR));

  // Investors step in when the company can no longer fly anything.
  const p9 = ROCKETS.peregrine9;
  const queued = Object.values(s.sites).flatMap((x) => x.queue);
  const hasCargoHull = [...s.fleet, ...queued].some((x) => ROCKETS[x.type].role === 'payload');
  if (!hasCargoHull && s.cash < p9.buildCost + CASH_FLOOR + 2) {
    s.cash = p9.buildCost + CASH_FLOOR + 2;
    note(s, 'Investors wire emergency funding: queue a new Peregrine 9.');
  }
  if (hasCargoHull && s.income < 0.05 && s.cash < 2.5 && !activeTrips(s).length) {
    s.cash = CASH_FLOOR;
    note(s, 'Investors cover launch costs.');
  }

  const expired = s.contracts.filter((c) => c.expires < s.day);
  if (expired.length) {
    s.contracts = s.contracts.filter((c) => c.expires >= s.day);
    s.manifest = s.manifest.filter((id) => s.contracts.some((c) => c.id === id));
  }
  const board = boardSize(s);
  if (s.day % board.every === 0 && s.contracts.length < board.cap) s.contracts.push(newContract(s));
}
