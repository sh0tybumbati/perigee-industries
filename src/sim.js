// Pure game simulation: no Phaser or Three here, so it can be tested under plain node.
import {
  ROCKETS, SATS, REGIONS, MARKETS, SUB_GROWTH, CHURN, PLANS, CUSTOMERS, TECH,
  OVERHEAD_PER_DAY, CASH_FLOOR, BEHEMOTH_LEARNING, BEHEMOTH_MIN_RISK,
  DEPOT_CAP, TANKER_LOAD, BOILOFF_PER_DAY,
  DESTINATIONS, EARTH_ORBITS, LUNAR_DESTS, SAT_DESTS, SHIP_DAYS, SAT_SHIP_DAYS, SAT_BATCH_DAYS, SAT_QUEUE_MAX, CORE_LIFE, CORE_LIFE_TYPES, HULL_MOVE_DAYS, HULL_MOVE_COST, HULL_MOVE_MIN,
  SITES, SITE_IDS, LEASE_FEE, BAY_FEE, BAY_RENT_DEPOSIT, BAY_BUY_COST, MAX_BAYS, PAD_COSTS, TOWER_COST, PAD_TURN,
  PAD_FAIL_CLOSED, LINE_COSTS, CANCEL_REFUND, DRONESHIP_FEE, DRONESHIP_COST, MAX_DRONESHIPS, DRONESHIP_CYCLE,
  DRONE_TOW_DAYS, RTLS_PAYLOAD_PENALTY, EXPEND_BONUS, COMMODITIES, MARKET_MIN, MARKET_MAX, BULK_DISCOUNT,
  RUSH_PREMIUM, START_CAPS, START_STOCK, PROP_MIX, TANK_STEP, PLANT_RATE, PLANT_COST, PLANT_MAX, PLANT_COST_FRAC, GAS_PLANT_DISCOUNT, WELL_COST, MAX_WELLS,
  MARS_WINDOWS, MARS_ROUTES, MARS_DESTS, MARS_CONTRACT, START_DATE, PROTOS, ODDS_LEARNING, ODDS_MAX, RD_DEFAULT,
  MARS_SITES, MARS_LEARNING, MARS_RETURN, MARS_RETURN_WINDOWS, MARS_RETURN_CONTRACT, BASE_PARAMS,
} from './data.js';
import { createBase, tickBase } from './base.js';
import { adoptGoals, tickGoals } from './goals.js';

export { OVERHEAD_PER_DAY };
export const SAT_BATCH = 6;
export const SAVE_VERSION = 11;
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
  const bare = !!d.bare && status === 'owned'; // greenfield: nothing is built yet
  return {
    id,
    status,
    pads: active && !bare ? [newPad(d, 0)] : [],
    bays: active && !bare ? [{ tenure: status === 'owned' ? 'owned' : 'rented', freeAt: 0 }] : [],
    stock: id === 'cape' ? { ...START_STOCK } : { kerolox: 0, methalox: 0, lox: 0, steel: 0, aluminum: 0 },
    cap: bare ? { kerolox: 0, methalox: 0, lox: 0, steel: 0, aluminum: 0 } : { ...START_CAPS },
    plants: { kerolox: 0, methalox: 0, lox: 0 },
    wells: 0,
    lines: active && d.factory && !bare ? 1 : 0,
    queue: [],
  };
}

export function createState() {
  const s = {
    day: 1,
    cash: 60, // seed funding (GDD 2.11)
    income: 0,
    fleet: [], // individual hulls
    serials: {},
    sites: Object.fromEntries(SITE_IDS.map((id) => [id, makeSite(id, SITES[id].start ?? 'locked')])),
    site: 'cape', // selected launch site
    droneships: [{ busyUntil: 0 }],
    market: { kerolox: 1, methalox: 1, lox: 1, steel: 1, aluminum: 1 }, // spot price multipliers
    trips: [], // flight records, active and past
    flightCounts: {}, // successful flights per vehicle type
    contracts: [],
    manifest: [],
    locked: [], // locked loadouts: accepted, shipping, each launches by itself (GDD 2.22)
    sats: 0,
    rocket: 'peregrine9', // selected vehicle type
    dest: 'leo', // selected destination
    recovery: 'expend', // rtls | drone | expend (booster-class vehicles only; rtls and drone need research)
    tutorial: 0, // index of the current tutorial step (TUTORIAL.length when finished)
    milestones: {}, // id -> { day, title }
    cashHistory: [60], // one sample per day, for the sparkline
    trials: {}, // techs funded and waiting on a test flight: { articles ready, attempts }
    marsRoute: 'direct', // direct (from Earth) | moon (a Moon-built Skyship leaves the base)
    constellation: { 1: 0, 2: 0, 3: 0 }, // active Skylink satellites by generation, one global pool
    satGen: 1, // generation of the next satellite batch
    satStock: { 1: 0, 2: 0, 3: 0 }, // built satellites waiting at the plant (GDD 2.23)
    satQueue: [], // batches in the satellite plant: { id, gen, daysLeft, total, cost }
    markets: Object.fromEntries(MARKETS.map((m) => [m.id, { status: 'locked', readyDay: 0, subs: 0 }])),
    plan: 'standard',
    depot: { built: false, prop: 0 },
    base: null, // the lunar base, founded by the first module ship to land
    marsBase: null, // the Mars base, founded the same way (GDD 2.17)
    marsLandings: 0, // successful arrivals at Mars, which lower the risks
    origin: 'earth', // earth | mars: where a flight to Earth orbit leaves from
    tech: new Set(),
    log: [],
    totalLaunches: 0,
    goals: {}, // goal id -> day done (GDD 2.21)
    chaptersPaid: {},
    profitDays: 0, // days in a row with net income above zero
    colonyDays: 0, // days in a row the Mars colony conditions have held
    won: null, // the day the colony was won
    nextId: 1,
  };
  addVehicle(s, 'peregrine9', 'cape');
  for (let i = 0; i < 5; i++) s.contracts.push(newContract(s));
  note(s, 'Welcome to Perigee Industries. $60M of seed funding, one expendable Peregrine 9.');
  return s;
}

// The interface can listen to what happens (toasts, sounds, auto-pause). With no listener nothing is queued.
let sink = null;
export const setEventSink = (fn) => { sink = fn; };
const emit = (e) => sink?.(e);

// How good or bad a log line is, for the toast colour.
function kindOf(msg) {
  if (/LOST|FAILED|was lost|died|crew lost|destroyed/.test(msg)) return 'bad';
  if (/SUCCEEDED|Research complete|arrived at|rolled out|ready for its test|is on station|built at the (Moon|Mars) base/.test(msg)) return 'good';
  if (/Investors|retired|window|Not enough/i.test(msg)) return 'warn';
  return 'info';
}

// kind: info | good | warn | bad. pause: ask the interface to auto-pause so the player sees it.
export function note(s, msg, kind, pause = false) {
  s.log.push(`Day ${s.day}: ${msg}`);
  if (s.log.length > 40) s.log.shift();
  emit({ type: 'note', msg, kind: kind ?? kindOf(msg), pause, day: s.day });
}

// Company milestones are recorded once, with their date.
export function milestone(s, id, title, text = '') {
  s.milestones ??= {};
  if (s.milestones[id]) return;
  s.milestones[id] = { day: s.day, title };
  emit({ type: 'milestone', id, title, text, date: dateOf(s.day).text });
}

// Days until the company runs out of cash at the current net income (Infinity when it is profitable).
export function runwayDays(s) {
  const net = dailyRevenue(s) - OVERHEAD_PER_DAY;
  return net >= 0 ? Infinity : Math.max(0, Math.floor((s.cash - CASH_FLOOR) / -net));
}

// ---- save / load -------------------------------------------------------

export function serialize(s) {
  return JSON.stringify({ v: SAVE_VERSION, ...s, tech: [...s.tech] });
}

// Old saves had a satellite count per region. Markets in the regions that had satellites come licensed.
const LEGACY_REGION_MARKETS = { na: ['us', 'camx'], eu: ['eu', 'uk'], apac: ['jpkr', 'anz', 'in', 'sea'], sa: ['latam'], af: ['af'], mar: ['mar'] };
function legacyMarkets(c) {
  const out = new Set();
  if (c && typeof c === 'object') for (const [r, n] of Object.entries(c)) if (n > 0) (LEGACY_REGION_MARKETS[r] ?? []).forEach((m) => out.add(m));
  return out;
}
function adoptLegacySkylink(s, c) {
  s.constellation = { 1: c && typeof c === 'object' ? Object.values(c).reduce((n, x) => n + (+x || 0), 0) : 0, 2: 0, 3: 0 };
  for (const m of legacyMarkets(c)) s.markets[m].status = 'active';
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
    if (o.v === 5) { // v6 adds landing research, aluminum and test flights; older companies already had reuse
      o.tech = [...new Set([...(Array.isArray(o.tech) ? o.tech : []), 'landing', 'droneship'])];
      o.v = 6;
    }
    if (o.v === 6) o.v = 7; // v7 adds the Mars base
    if (o.v === 7) { // v8 splits the blended tanks into RP-1, methane and one shared LOX tank
      for (const site of Object.values(o.sites ?? {})) {
        for (const k of ['stock', 'cap']) {
          const b = site?.[k];
          if (!b) continue;
          const k1 = b.kerolox ?? 0, m1 = b.methalox ?? 0;
          b.lox = k1 * (1 - PROP_MIX.kerolox) + m1 * (1 - PROP_MIX.methalox);
          b.kerolox = k1 * PROP_MIX.kerolox;
          b.methalox = m1 * PROP_MIX.methalox;
        }
      }
      o.v = 8;
    }
    if (o.v === 8) { // v9 pools the regional constellation and adds licensed markets
      const licensed = legacyMarkets(o.constellation);
      o.constellation = typeof o.constellation === 'number' ? o.constellation : Object.values(o.constellation ?? {}).reduce((n, x) => n + (+x || 0), 0);
      o.markets = Object.fromEntries(MARKETS.map((m) => [m.id, { status: licensed.has(m.id) ? 'active' : 'locked', readyDay: 0, subs: 0 }]));
      o.v = 9;
    }
    if (o.v === 9) { // v10 adds satellite generations and mobile markets: old satellites are Gen-1
      o.constellation = { 1: +o.constellation || 0, 2: 0, 3: 0 };
      o.v = 10;
    }
    const goalless = o.v === 10; // v11 adds goals: what is already true counts as done
    if (o.v === 10) o.v = 11;
    if (o.v !== SAVE_VERSION) return null;
    const base = createState();
    const s = { ...base, ...o, tech: new Set(Array.isArray(o.tech) ? o.tech : []) };
    delete s.v;
    delete s.lock; // an earlier build held a single locked loadout
    s.locked = Array.isArray(o.locked) ? o.locked : [];
    for (const l of s.locked) if (!l.satsHeld) l.sats = 0; // satellites used to be bought at launch, not built and held
    s.satStock = { 1: Math.max(0, +o.satStock?.[1] || 0), 2: Math.max(0, +o.satStock?.[2] || 0), 3: Math.max(0, +o.satStock?.[3] || 0) };
    if (!Array.isArray(s.satQueue)) s.satQueue = [];
    if (!o.satStock) s.sats = 0;
    for (const c of s.contracts ?? []) if (!c.lockId) delete c.acceptedDay; // older saves started shipping on load
    s.constellation = { 1: Math.max(0, +o.constellation?.[1] || 0), 2: Math.max(0, +o.constellation?.[2] || 0), 3: Math.max(0, +o.constellation?.[3] || 0) };
    if (!SATS[s.satGen] || !s.tech.has(SATS[s.satGen].tech)) s.satGen = 1;
    s.markets = Object.fromEntries(MARKETS.map((m) => [m.id, { ...base.markets[m.id], ...o.markets?.[m.id] }]));
    if (MARKETS.some((m) => m.cell && s.markets[m.id].status !== 'locked')) s.tech.add('dtc'); // saves from before Direct-to-Cell was its own research
    if (!PLANS[s.plan]) s.plan = 'standard';
    s.depot = { ...base.depot, ...o.depot };
    s.flightCounts = { ...o.flightCounts };
    s.serials = { ...o.serials };
    s.market = { ...base.market, ...o.market };
    for (const k of ['fleet', 'trips', 'queue', 'contracts', 'manifest', 'droneships']) if (k in s && !Array.isArray(s[k])) s[k] = base[k];
    s.droneships = Array.isArray(o.droneships) ? o.droneships : base.droneships;
    const restore = (b, body) => (b && Array.isArray(b.modules) ? { ...createBase(b.site, body), ...b, body, stock: { ...createBase('').stock, ...b.stock } } : null);
    s.base = restore(s.base, 'moon');
    s.marsBase = restore(o.marsBase, 'mars');
    if (!['earth', 'mars'].includes(s.origin)) s.origin = 'earth';
    s.sites = Object.fromEntries(SITE_IDS.map((id) => [id, o.sites?.[id]
      ? { ...makeSite(id, 'locked'), ...o.sites[id], plants: { ...base.sites[id].plants, ...o.sites[id].plants }, stock: { ...base.sites[id].stock, ...o.sites[id].stock }, cap: { ...base.sites[id].cap, ...o.sites[id].cap } }
      : base.sites[id]]));
    s.trials = o.trials && typeof o.trials === 'object' ? { ...o.trials } : {};
    s.tutorial = Number.isInteger(o.tutorial) ? o.tutorial : TUTORIAL.length; // saves from before the tutorial skip it
    s.milestones = o.milestones && typeof o.milestones === 'object' ? { ...o.milestones } : {};
    s.cashHistory = Array.isArray(o.cashHistory) && o.cashHistory.length ? o.cashHistory.slice(-90) : [s.cash];
    s.fleet = s.fleet.filter((v) => ROCKETS[v.type]).map((v) => ({ site: 'cape', ...v }));
    if (!ROCKETS[s.rocket] || !rocketUnlocked(s, s.rocket)) s.rocket = 'peregrine9';
    if (!DESTINATIONS[s.dest] || !destUnlocked(s, s.dest)) s.dest = 'leo';
    if (!s.sites[s.site] || s.sites[s.site].status === 'locked') s.site = 'cape';
    if (!['rtls', 'drone', 'expend'].includes(s.recovery)) s.recovery = 'rtls';
    if (!Number.isFinite(s.cash) || !Number.isFinite(s.day)) return null;
    if (goalless) adoptGoals(s);
    else {
      s.goals = o.goals && typeof o.goals === 'object' ? { ...o.goals } : {};
      s.chaptersPaid = o.chaptersPaid && typeof o.chaptersPaid === 'object' ? { ...o.chaptersPaid } : {};
    }
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
  for (const k of ['day', 'cash', 'income', 'totalLaunches', 'recovery']) if (o[k] !== undefined) s[k] = o[k];
  adoptLegacySkylink(s, o.constellation);
  s.flightCounts = { ...o.flights };
  if (o.depot) s.depot = { built: !!o.depot.built, prop: o.depot.prop ?? 0 };
  for (const id of ['peregrine9', 'peregrineHeavy', 'behemoth', 'skyship']) {
    const worn = o.cores?.[id] ?? 0;
    if (rocketUnlocked(s, id) && worn < ROCKETS[id].coreLife) addVehicle(s, id, 'cape').flights = worn;
  }
  if (!s.fleet.length) addVehicle(s, 'peregrine9', 'cape');
  if (ROCKETS[o.rocket] && rocketUnlocked(s, o.rocket)) s.rocket = o.rocket;
  // Hand the v4 migration the pieces it expects.
  return { ...s, tech: [...s.tech], pads: [{ busyUntil: 0 }], lines: 1, queue: [], v: 4 };
}

// v4 had a flat list of pads and one factory. They become Cape Canaveral, owned if the company had grown.
function migrateV4(o) {
  const s = createState();
  for (const k of ['day', 'cash', 'income', 'fleet', 'serials', 'trips', 'flightCounts', 'contracts', 'manifest', 'sats', 'rocket', 'dest', 'constellation', 'satGen', 'markets', 'plan', 'depot', 'base', 'log', 'totalLaunches', 'nextId']) {
    if (o[k] !== undefined) s[k] = o[k];
  }
  if (['rtls', 'drone', 'expend'].includes(o.recovery)) s.recovery = o.recovery;
  s.tutorial = TUTORIAL.length;
  s.tech = new Set([...(Array.isArray(o.tech) ? o.tech : []), 'landing', 'droneship']);
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

// The real windows (GDD 2.11). A window is open from its first to its last day, inclusive.
export function marsWindow(day) {
  const w = MARS_WINDOWS.find(([, close]) => day <= close) ?? MARS_WINDOWS[MARS_WINDOWS.length - 1];
  if (day < w[0]) return { open: false, opensIn: w[0] - day, closesIn: 0, opens: w[0] };
  return { open: true, opensIn: 0, closesIn: w[1] - day + 1, opens: w[0] };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Day 1 is 1 January 2010.
export function dateOf(day) {
  const d = new Date(START_DATE + (day - 1) * 86400000);
  return { year: d.getUTCFullYear(), text: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
}

export const isMars = (id) => DESTINATIONS[id].body === 'mars';
// A Mars flight from the Moon uses a Moon-built hull and the base's methalox, with no Earth pad at all.
export const originIsMoon = (s) => rocketDef(s).role === 'payload' && isMars(s.dest) && s.marsRoute === 'moon';
export const marsMoonNeed = (s) => Math.ceil(MARS_ROUTES.moon.hullFuel + MARS_ROUTES.moon.fuelPerTon * manifestTotals(s).mass);
export const setMarsRoute = (s, route) => { if (MARS_ROUTES[route]) s.marsRoute = route; };

// A return flight leaves a Mars-based Skyship from the Mars base for Earth orbit (GDD 2.17).
export const originIsMars = (s) => rocketDef(s).role === 'payload' && s.origin === 'mars' && s.dest === 'leo';
export const flightOrigin = (s) => (originIsMoon(s) ? 'moon' : originIsMars(s) ? 'mars' : 'earth');
export const hullOrigin = (v) => (v.site === 'moon' ? 'moon' : v.site === 'mars' ? 'mars' : 'earth');
export const baseOn = (s, body) => (body === 'mars' ? s.marsBase : body === 'moon' ? s.base : null);
export const marsReturnNeed = (s) => Math.ceil(MARS_RETURN.hullFuel + MARS_RETURN.fuelPerTon * manifestTotals(s).mass);
// Direct and Moon-route Mars risks, after what the company has learned from earlier landings.
export function marsRisks(s) {
  const n = s.marsLandings ?? 0;
  const L = MARS_LEARNING;
  return {
    ascent: Math.max(L.minAscent, MARS_ROUTES.direct.ascentRisk - L.ascent * n),
    land: Math.max(L.minLand, MARS_ROUTES.direct.landRisk - L.land * n),
    moonLand: Math.max(L.minMoonLand, MARS_ROUTES.moon.landRisk - L.moonLand * n),
  };
}
export const setOrigin = (s, o) => { if (['earth', 'mars'].includes(o)) s.origin = o; };
export function marsReturnWindow(day) {
  const w = MARS_RETURN_WINDOWS.find(([, close]) => day <= close) ?? MARS_RETURN_WINDOWS[MARS_RETURN_WINDOWS.length - 1];
  if (day < w[0]) return { open: false, opensIn: w[0] - day, closesIn: 0, opens: w[0] };
  return { open: true, opensIn: 0, closesIn: w[1] - day + 1, opens: w[0] };
}

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
    region: pick(REGIONS).id,
    dest,
    mass,
    volume: Math.min(380, Math.round(mass * rnd(1.5, 2.4))),
    prop: Math.ceil(mass * DESTINATIONS[dest].prop),
    payout: +(mass * rnd(...MARS_CONTRACT.rate) + rnd(...MARS_CONTRACT.base)).toFixed(1),
    expires: s.day + MARS_CONTRACT.expires,
  };
}

// Customers on Earth want things brought home from Mars. Only a flight that leaves the Mars base can carry them.
function newMarsReturnContract(s) {
  const mass = +rnd(...MARS_RETURN_CONTRACT.mass).toFixed(1);
  return {
    id: s.nextId++,
    customer: pick(CUSTOMERS),
    region: pick(REGIONS).id,
    dest: 'leo',
    origin: 'mars',
    mass,
    volume: Math.min(380, Math.round(mass * rnd(1.5, 2.4))),
    payout: +(mass * rnd(...MARS_RETURN_CONTRACT.rate) + rnd(...MARS_RETURN_CONTRACT.base)).toFixed(1),
    expires: s.day + MARS_RETURN_CONTRACT.expires,
  };
}

function newContract(s) {
  if (s.marsBase?.modules.length && Math.random() < MARS_RETURN_CONTRACT.chance) return newMarsReturnContract(s);
  if (s.tech.has('marsTransit') && Math.random() < MARS_CONTRACT.chance) return newMarsContract(s);
  if (s.tech.has('tanker') && Math.random() < 0.3) return newLunarContract(s);
  const tier = pickTier(s);
  const mass = +rnd(tier.min, tier.max).toFixed(1);
  const volume = +Math.min(380, mass * rnd(1.5, 3.2)).toFixed(0);
  return {
    id: s.nextId++,
    customer: pick(CUSTOMERS),
    region: pick(REGIONS).id,
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
    region: pick(REGIONS).id,
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
  if (!c || c.lockId || rocketDef(s).role !== 'payload') return false;
  const i = s.manifest.indexOf(id);
  if (i >= 0) { s.manifest.splice(i, 1); autoSite(s); return true; }
  // Return contracts ride return flights: loading one into an empty manifest switches the flight's origin.
  if (!s.manifest.length) {
    const want = c.origin ?? 'earth';
    if (want === 'mars' && flightOrigin(s) !== 'mars' && s.fleet.some((v) => hullOrigin(v) === 'mars') && rocketUnlocked(s, 'skyship')) {
      setRocket(s, 'skyship');
      s.origin = 'mars';
      s.dest = 'leo';
    } else if (want === 'earth' && s.origin === 'mars') s.origin = 'earth';
  }
  if ((c.origin ?? 'earth') !== flightOrigin(s)) return false;
  if (c.dest !== s.dest) {
    if (s.manifest.length) return false; // one destination per launch
    if (!setDest(s, c.dest)) return false;
  }
  s.manifest.push(id);
  autoSite(s);
  return true;
}

// ---- customers, shipping and the automatic launch site (GDD 2.14) -------------------------

export const shipDays = (c, siteId) => (c.region ? SHIP_DAYS[c.region]?.[siteId] ?? 0 : 0);
// A draft contract has not been accepted, so this is only the projection: ready that many days after locking in.
export const contractReady = (s, c, siteId) => (c.acceptedDay ?? s.day) + shipDays(c, siteId);
// Days a draft loadout needs to ship once locked in, at the selected site.
export const satShipDays = (siteId) => SAT_SHIP_DAYS[siteId] ?? 0;
export const shipDaysNeeded = (s) => Math.max(s.sats ? satShipDays(s.site) : 0, ...s.contracts.filter((c) => s.manifest.includes(c.id)).map((c) => shipDays(c, s.site)), 0);
// While a locked loadout is swapped in, _lockDay is the day it was locked; otherwise satellites are only projected.
export const satsReady = (s) => (s._lockDay ?? s.day) + (s.sats ? satShipDays(s.site) : 0);

// Lock in the draft loadout (GDD 2.22): accepts every contract in it, starts the shipping and moves it off the
// draft, so another one can be built straight away.
export function lockLoadout(s) {
  if (rocketDef(s).role !== 'payload' || (!s.manifest.length && !s.sats)) return false;
  const L = { id: s.nextId++, day: s.day, rocket: s.rocket, dest: s.dest, site: s.site, origin: s.origin, manifest: [...s.manifest], sats: s.sats, satGen: s.satGen, satsHeld: true };
  s.satStock[s.satGen] -= s.sats; // the satellites are set aside for this loadout
  for (const c of s.contracts) if (s.manifest.includes(c.id)) { c.acceptedDay = s.day; c.lockId = L.id; }
  s.locked.push(L);
  dispatchHulls(s);
  s.manifest = [];
  s.sats = 0;
  return true;
}

export function cancelLoadout(s, id) {
  const i = s.locked.findIndex((l) => l.id === id);
  if (i < 0) return false;
  const [L] = s.locked.splice(i, 1);
  if (L.satsHeld) s.satStock[L.satGen] += L.sats;
  for (const c of s.contracts) if (c.lockId === id) { delete c.lockId; delete c.acceptedDay; }
  return true;
}

export const loadoutOf = (s, contractOrId) => s.locked.find((l) => l.id === (contractOrId?.lockId ?? contractOrId));

// Runs fn with a locked loadout swapped in as the current one, then puts the draft back.
function withLoadout(s, L, fn) {
  const keep = { manifest: s.manifest, sats: s.sats, satGen: s.satGen, rocket: s.rocket, dest: s.dest, site: s.site, origin: s.origin };
  Object.assign(s, { manifest: [...L.manifest], sats: L.sats, satGen: L.satGen, rocket: L.rocket, dest: L.dest, site: L.site, origin: L.origin, _lockDay: L.day });
  try { return fn(); } finally { Object.assign(s, keep); delete s._lockDay; }
}

// What a locked loadout is waiting for, or null when it can launch.
export const loadoutBlocker = (s, L) => withLoadout(s, L, () => launchBlocker(s));

// The first locked loadout that can launch now, or null.
export const nextAutoLaunch = (s) => s.locked.find((l) => !loadoutBlocker(s, l)) ?? null;

export function launchLoadout(s, id) {
  const L = s.locked.find((l) => l.id === id);
  if (!L) return { ok: false, reason: 'No such loadout' };
  const res = withLoadout(s, L, () => launch(s));
  if (res.ok) s.locked = s.locked.filter((l) => l !== L);
  return res;
}

// Open sites that can launch to dest, best first: earliest possible launch day, then cheapest, then the current site.
// fuel (optional) is the vehicle's propellant need, used to price any shortage in a site's tanks.
export function siteRanking(s, contracts, dest, { catchPad = false, fuel = null, rocket = null, sats = 0 } = {}) {
  const out = [];
  for (const id of SITE_IDS) {
    const site = s.sites[id];
    if (!site || site.status === 'locked' || !siteAllows(id, dest)) continue;
    const pads = site.pads.filter((p) => !catchPad || p.tower);
    if (!pads.length) continue;
    const ready = Math.max(s.day, Math.min(...pads.map((p) => p.busyUntil)), ...contracts.map((c) => contractReady(s, c, id)), rocket ? hullDay(s, rocket, id) : 0, sats ? s.day + satShipDays(id) : 0);
    const cost = (site.status === 'leased' ? LEASE_FEE : 0) + (fuel ? propBuy(s, site, fuel).cash : 0);
    out.push({ id, day: ready, cost });
  }
  return out.sort((a, b) => a.day - b.day || a.cost - b.cost || (b.id === s.site) - (a.id === s.site));
}

// Picks the best launch site for the whole manifest. Picking a site by hand sticks until the next contract is loaded.
function autoSite(s) {
  if ((!s.manifest.length && !s.sats) || flightOrigin(s) !== 'earth') return;
  const cs = s.manifest.map((id) => s.contracts.find((c) => c.id === id)).filter(Boolean);
  const best = siteRanking(s, cs, effDest(s), { catchPad: !!rocketDef(s).catch, fuel: fuelNeed(s), rocket: s.rocket, sats: s.sats })[0];
  if (best) s.site = best.id;
}

// The best site for one contract on its own, for the badge on the board.
export const bestSiteFor = (s, c) => siteRanking(s, [c], c.dest, { rocket: rocketDef(s).role === 'payload' ? s.rocket : null })[0] ?? null;

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
  if (v.transit) return 'shipping';
  if (s.day < v.returnDay) return 'flying';
  if (s.day < v.readyDay) return 'refit';
  return 'ready';
}

// ---- where the hulls are (GDD 2.24) ---------------------------------------------------------

export const hullSite = (v) => v.site ?? 'cape';
export const hullMoveDays = (a, b) => (a === b ? 0 : HULL_MOVE_DAYS[a]?.[b] ?? HULL_MOVE_DAYS[b]?.[a] ?? 8);
export const hullMoveCost = (type) => Math.max(HULL_MOVE_MIN, +(ROCKETS[type].buildCost * HULL_MOVE_COST).toFixed(2));
// Earth hulls at a site, counting the ones already on their way there.
export const hullsAt = (s, type, siteId) => fleetOf(s, type).filter((v) => hullOrigin(v) === 'earth' && (v.transit ? v.transit.to === siteId : hullSite(v) === siteId));

export function shipHullBlocker(s, v, to) {
  if (!v || hullOrigin(v) !== 'earth') return 'Only Earth hulls can be shipped';
  if (vehicleState(s, v) !== 'ready') return 'The hull has to be ready';
  if (!s.sites[to] || s.sites[to].status === 'locked') return 'Pick a launch site you can use';
  if (hullSite(v) === to) return 'Already there';
  if (!canSpend(s, hullMoveCost(v.type))) return 'Not enough cash';
  return null;
}

export function shipHull(s, id, to) {
  const v = s.fleet.find((x) => x.id === id);
  if (shipHullBlocker(s, v, to)) return false;
  const days = hullMoveDays(hullSite(v), to);
  const cost = hullMoveCost(v.type);
  s.cash -= cost;
  v.transit = { to, arrive: s.day + days };
  note(s, `${v.serial} is being shipped from ${SITES[hullSite(v)].short} to ${SITES[to].short} (${days} days, $${cost}M).`);
  return true;
}

// The next open site after the hull's own, for the one-click button in the Fleet tab.
export const nextShipSite = (s, v) => {
  const open = SITE_IDS.filter((id) => s.sites[id].status !== 'locked');
  const i = open.indexOf(hullSite(v));
  return open.length > 1 ? open[(i + 1) % open.length] : null;
};

// The day a hull of this type could fly from a site: now if one is there and ready, else when one could arrive.
export function hullDay(s, type, siteId) {
  const hulls = fleetOf(s, type).filter((v) => hullOrigin(v) === 'earth');
  if (!hulls.length) return s.day;
  const free = (v) => Math.max(s.day, v.readyDay ?? 0, v.returnDay ?? 0);
  const here = hulls.filter((v) => (v.transit ? v.transit.to === siteId : hullSite(v) === siteId));
  if (here.length) return Math.min(...here.map((v) => (v.transit ? v.transit.arrive : free(v))));
  return Math.min(...hulls.map((v) => (v.transit ? v.transit.arrive : free(v)) + hullMoveDays(v.transit ? v.transit.to : hullSite(v), siteId)));
}

// Locked loadouts that need a hull at a site get one shipped from elsewhere (least worn, nearest first).
function dispatchHulls(s) {
  const need = new Map();
  for (const L of s.locked) {
    if ((L.origin ?? 'earth') !== 'earth' || ROCKETS[L.rocket].role !== 'payload') continue;
    const key = `${L.rocket}|${L.site}`;
    need.set(key, (need.get(key) ?? 0) + 1);
  }
  for (const [key, n] of need) {
    const [type, site] = key.split('|');
    let have = hullsAt(s, type, site).length;
    while (have < n) {
      const src = fleetOf(s, type)
        .filter((v) => hullOrigin(v) === 'earth' && vehicleState(s, v) === 'ready' && hullSite(v) !== site && hullsAt(s, type, hullSite(v)).length > (need.get(`${type}|${hullSite(v)}`) ?? 0))
        .sort((a, b) => hullMoveDays(hullSite(a), site) - hullMoveDays(hullSite(b), site) || a.flights - b.flights)[0];
      if (!src || !shipHull(s, src.id, site)) break;
      have++;
    }
  }
}

export const readyVehicles = (s, type) => fleetOf(s, type).filter((v) => vehicleState(s, v) === 'ready');
// The least-worn ready hull flies first.
// Moon-based hulls fly only from the Moon, and Earth hulls only from Earth.
export const nextVehicle = (s, type) => readyVehicles(s, type).filter((v) => hullOrigin(v) === flightOrigin(s) && (flightOrigin(s) !== 'earth' || hullSite(v) === s.site)).sort((a, b) => a.flights - b.flights)[0] ?? null;

export function setRocket(s, id) {
  if (!ROCKETS[id] || !rocketUnlocked(s, id)) return;
  s.rocket = id;
  if (!satGenOk(s, s.satGen)) s.satGen = 1;
  s.sats = Math.min(s.sats, rocketDef(s).sats);
  if (rocketDef(s).role !== 'payload') { s.manifest = []; s.sats = 0; }
}

const coreTier = (s, type) => (CORE_LIFE_TYPES.includes(type) ? CORE_LIFE.find((c) => s.tech.has(c.tech)) : null);
export const coreLife = (s, type) => coreTier(s, type)?.life ?? ROCKETS[type].coreLife;
export const wearRisk = (s, type) => ROCKETS[type].wearRisk * (coreTier(s, type)?.wear ?? 1);

export function failChance(s, v = nextVehicle(s, s.rocket)) {
  const r = rocketDef(s);
  let base = r.baseRisk;
  if (s.rocket === 'behemoth') base = Math.max(BEHEMOTH_MIN_RISK, base - BEHEMOTH_LEARNING * (s.flightCounts.behemoth ?? 0));
  if (isMars(effDest(s)) && !originIsMoon(s)) base += marsRisks(s).ascent;
  if (originIsMars(s)) base += MARS_RETURN.ascentRisk;
  return base + wearRisk(s, s.rocket) * (v?.flights ?? 0);
}

// How the booster comes back: catch vehicles use the tower, others pick RTLS, droneship or expend.
export const recoveryAllowed = (s, mode) => mode === 'expend' || (mode === 'rtls' && s.tech.has('landing')) || (mode === 'drone' && s.tech.has('droneship'));
export const recoveryOf = (s) => (rocketDef(s).catch ? 'catch' : recoveryAllowed(s, s.recovery) ? s.recovery : 'expend');

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
  const req = SITES[id].requires;
  if (req && site.status === 'locked' && s.sites[req].status !== 'owned') return `Buy ${SITES[req].short} first`;
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
  milestone(s, `site:${id}`, `${SITES[id].name} is ours`, mode === 'lease' ? 'Leased.' : 'Bought outright.');
  return true;
}

export const padCostOf = (id, n) => SITES[id].padCost ?? PAD_COSTS[n];
export const bayCostOf = (id, status) => (status === 'owned' ? SITES[id].bayCost ?? BAY_BUY_COST : BAY_RENT_DEPOSIT);
export const maxBaysOf = (id, status) => (status === 'owned' && SITES[id].maxBays) || MAX_BAYS[status];
export const lineCostOf = (id, n) => LINE_COSTS[n + (SITES[id].bare ? 1 : 0)];
export const wellBlocker = (s, id) => {
  const site = s.sites[id];
  if (!SITES[id].gas) return 'No gas deposits here';
  if (site.status !== 'owned') return 'Own the site first';
  if (site.wells >= MAX_WELLS) return 'All wells drilled';
  return canSpend(s, WELL_COST) ? null : 'Not enough cash';
};
export function buildWell(s, id) {
  if (wellBlocker(s, id)) return false;
  s.cash -= WELL_COST;
  s.sites[id].wells++;
  note(s, `Gas well ${s.sites[id].wells} drilled at ${SITES[id].short} (-$${WELL_COST}M).`);
  return true;
}

export function padBlocker(s, id) {
  const site = s.sites[id];
  if (site.status !== 'owned') return 'Own the site first';
  if (site.pads.length >= SITES[id].pads.length) return 'All pads built';
  return canSpend(s, padCostOf(id, site.pads.length)) ? null : 'Not enough cash';
}

export function buyPad(s, id) {
  if (padBlocker(s, id)) return false;
  const site = s.sites[id];
  const cost = padCostOf(id, site.pads.length);
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
  if (site.bays.length >= maxBaysOf(id, site.status)) return site.status === 'leased' ? 'Buy the site for more hangars' : 'All hangars built';
  const cost = bayCostOf(id, site.status);
  return canSpend(s, cost) ? null : 'Not enough cash';
}

export function addBay(s, id) {
  if (bayBlocker(s, id)) return false;
  const site = s.sites[id];
  const owned = site.status === 'owned';
  const cost = bayCostOf(id, site.status);
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
  if (!s.tech.has('droneship') || s.droneships.length >= MAX_DRONESHIPS || !canSpend(s, DRONESHIP_COST)) return false;
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
  const cost = PLANT_COST;
  s.cash -= cost;
  s.sites[id].plants[fuel]++;
  note(s, `${COMMODITIES[fuel].name} plant level ${s.sites[id].plants[fuel]} at ${SITES[id].short} (-$${cost}M).`);
  return true;
}

function tickMarket(s) {
  for (const type of Object.keys(COMMODITIES)) {
    const m = s.market[type];
    s.market[type] = Math.min(MARKET_MAX, Math.max(MARKET_MIN, m + (1 - m) * 0.06 + (Math.random() - 0.5) * (COMMODITIES[type].vol ?? 0.1)));
  }
}

function tickPlants(s) {
  for (const site of Object.values(s.sites)) {
    if (site.status !== 'owned') continue;
    for (const fuel of ['kerolox', 'methalox', 'lox']) {
      const level = site.plants[fuel];
      if (!level) continue;
      const make = Math.min(level * PLANT_RATE[fuel], site.cap[fuel] - site.stock[fuel]);
      const cheap = fuel === 'methalox' ? Math.min(level, site.wells ?? 0) : 0; // levels fed by gas wells
      const cost = make * COMMODITIES[fuel].price * PLANT_COST_FRAC * (1 - (cheap / level) * (1 - GAS_PLANT_DISCOUNT));
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

const metalOf = (type) => ROCKETS[type].metal ?? 'steel';
const steelShortage = (s, siteId, type) => Math.max(0, ROCKETS[type].steel - s.sites[siteId].stock[metalOf(type)]);

export function buildBlocker(s, type, siteId = 'cape') {
  const r = ROCKETS[type];
  const site = s.sites[siteId];
  if (!rocketUnlocked(s, type)) return 'Locked';
  if (!site || !site.lines) return 'No factory here';
  if (r.role === 'depot' && (s.depot.built || fleetOf(s, type).length || Object.values(s.sites).some((x) => x.queue.some((q) => q.type === type)))) return 'Only one depot is needed';
  const total = buildCostAt(type, siteId).cost + steelShortage(s, siteId, type) * spot(s, metalOf(type)) * RUSH_PREMIUM;
  if (!canSpend(s, total)) return 'Not enough cash';
  return null;
}

export function queueBuild(s, type, siteId = 'cape') {
  if (buildBlocker(s, type, siteId)) return false;
  const r = ROCKETS[type];
  const site = s.sites[siteId];
  const { cost, days } = buildCostAt(type, siteId);
  const short = steelShortage(s, siteId, type);
  const rush = short * spot(s, metalOf(type)) * RUSH_PREMIUM;
  site.stock[metalOf(type)] -= r.steel - short;
  s.cash -= cost + rush;
  site.queue.push({ id: s.nextId++, type, daysLeft: days, total: days, cost });
  note(s, `Queued ${r.name} at ${SITES[siteId].short} (-$${(cost + rush).toFixed(1)}M, ${days} days).`);
  return true;
}

// ---- the satellite plant (GDD 2.23) ---------------------------------------------------------

export const satBatchCost = (gen) => +(SAT_BATCH * SATS[gen].cost).toFixed(2);
export function satBuildBlocker(s, gen) {
  if (!SATS[gen] || !s.tech.has(SATS[gen].tech)) return 'Research it first';
  if (s.satQueue.length >= SAT_QUEUE_MAX) return 'Plant queue is full';
  if (!canSpend(s, satBatchCost(gen))) return 'Not enough cash';
  return null;
}

export function queueSats(s, gen) {
  if (satBuildBlocker(s, gen)) return false;
  const cost = satBatchCost(gen);
  s.cash -= cost;
  s.satQueue.push({ id: s.nextId++, gen, daysLeft: SAT_BATCH_DAYS[gen], total: SAT_BATCH_DAYS[gen], cost });
  return true;
}

export function cancelSats(s, id) {
  const q = s.satQueue.find((x) => x.id === id);
  if (!q || q.daysLeft < q.total) return false; // work has started
  s.satQueue = s.satQueue.filter((x) => x !== q);
  s.cash += +(q.cost * CANCEL_REFUND).toFixed(2);
  return true;
}

function tickSatPlant(s) {
  const q = s.satQueue[0];
  if (!q) return;
  q.daysLeft--;
  if (q.daysLeft > 0) return;
  s.satQueue.shift();
  s.satStock[q.gen] += SAT_BATCH;
  note(s, `${SAT_BATCH} ${SATS[q.gen].name} satellites came off the plant line.`);
}

export function cancelBuild(s, siteId, id) {
  const site = s.sites[siteId];
  const q = site.queue.find((x) => x.id === id);
  if (!q || q.daysLeft < q.total) return false; // work has started
  const refund = +(q.cost * CANCEL_REFUND).toFixed(1);
  site.queue = site.queue.filter((x) => x.id !== id);
  s.cash += refund;
  note(s, `Cancelled ${q.kind === 'test' ? PROTOS[q.tech].name : ROCKETS[q.type].name}, refunded $${refund}M.`);
  return true;
}

export function lineBlocker(s, siteId) {
  const site = s.sites[siteId];
  if (!SITES[siteId].factory || site.status !== 'owned') return 'Own the site first';
  const cost = lineCostOf(siteId, site.lines);
  if (cost === undefined) return 'All lines built';
  return canSpend(s, cost) ? null : 'Not enough cash';
}

export function buyLine(s, siteId = 'cape') {
  if (lineBlocker(s, siteId)) return false;
  const site = s.sites[siteId];
  const cost = lineCostOf(siteId, site.lines);
  s.cash -= cost;
  site.lines++;
  note(s, `Production line ${site.lines} online at ${SITES[siteId].short} (-$${cost}M).`);
  return true;
}

// Reputation: every successful flight makes customers more likely to call, so a bigger fleet has work to do.
export const reputation = (s) => Object.values(s.flightCounts).reduce((n, c) => n + c, 0);
export function boardSize(s) {
  const rep = reputation(s);
  if (rep >= 120) return { every: 2, cap: 12 };
  if (rep >= 40) return { every: 3, cap: 10 };
  return { every: 6, cap: 8 };
}

// ---- manifest ----------------------------------------------------------------

export function manifestTotals(s) {
  let mass = s.sats * SATS[s.satGen].mass;
  let volume = s.sats * SATS[s.satGen].volume;
  let payout = 0;
  for (const c of s.contracts) {
    if (s.manifest.includes(c.id)) { mass += c.mass; volume += c.volume; payout += c.payout; }
  }
  return { mass: +mass.toFixed(2), volume: +volume.toFixed(1), payout: +payout.toFixed(1) };
}

// Depot propellant a module ship burns on its way to the selected site.
export const modulePropNeed = (s) => Math.ceil((rocketDef(s).shipMass ?? 0) * DESTINATIONS[s.dest].prop);

export const tliNeed = (s) => s.contracts.reduce((n, c) => n + (s.manifest.includes(c.id) && c.prop ? c.prop : 0), 0);

// Whether a satellite generation is researched and the selected vehicle can carry it.
export const satGenOk = (s, g) => !!SATS[g] && s.tech.has(SATS[g].tech) && (!SATS[g].only || SATS[g].only.includes(s.rocket));
export function cycleSatGen(s) {
  for (let i = 1; i <= 3; i++) {
    const g = ((s.satGen - 1 + i) % 3) + 1;
    if (satGenOk(s, g)) { s.satGen = g; s.sats = Math.min(s.sats, s.satStock[g]); return; }
  }
}

export function adjustSats(s, delta) {
  if (!satGenOk(s, s.satGen)) s.satGen = 1;
  if (!s.tech.has('gen1') || rocketDef(s).role !== 'payload' || !SAT_DESTS.includes(s.dest)) return;
  s.sats = Math.max(0, Math.min(rocketDef(s).sats, s.satStock[s.satGen], s.sats + delta));
  autoSite(s);
}

// ---- economy ---------------------------------------------------------------

// ---- Skylink: one constellation, licensed markets (GDD 2.19) --------------------------------------

export const satCount = (s, minGen = 1) => [1, 2, 3].reduce((n, g) => n + (g >= minGen ? s.constellation[g] : 0), 0);
export const skylinkCapacity = (s) => [1, 2, 3].reduce((n, g) => n + s.constellation[g] * SATS[g].capacity, 0); // thousands of broadband subscribers
// Broadband subscribers (thousands), and the network load including light mobile subscribers.
export const totalSubs = (s) => MARKETS.reduce((n, m) => n + (m.cell ? 0 : s.markets[m.id].subs), 0);
export const totalLoad = (s) => MARKETS.reduce((n, m) => n + s.markets[m.id].subs * (m.load ?? 1), 0);
export const demandCeiling = (s, m) => m.subs * PLANS[s.plan].demand;
// Share of the network's quality that subscribers get: 1 until subscribers outgrow capacity.
export function skylinkQuality(s) {
  const load = totalLoad(s);
  const cap = skylinkCapacity(s);
  return load <= cap ? 1 : cap / load;
}
export const marketRevenue = (s, m) => {
  const st = s.markets[m.id];
  return st.status === 'active' ? (st.subs * m.arpu * PLANS[s.plan].price) / 30 / 1000 * skylinkQuality(s) : 0; // $M per day
};
export const dailyRevenue = (s) => MARKETS.reduce((n, m) => n + marketRevenue(s, m), 0);

export function marketBlocker(s, id) {
  const m = MARKETS.find((x) => x.id === id);
  const st = s.markets[id];
  if (st.status === 'active') return 'Licensed';
  if (st.status === 'pending') return 'Approval pending';
  if (!s.tech.has(m.cell ? 'dtc' : 'gen1')) return m.cell ? 'Research Direct-to-Cell' : 'Research Skylink Gen-1';
  if (satCount(s, m.cell ? 2 : 1) < m.minSats) return `Needs ${m.minSats} ${m.cell ? 'Gen-2 or newer ' : ''}satellites in orbit`;
  return canSpend(s, m.license) ? null : 'Not enough cash';
}

export function applyLicense(s, id) {
  if (marketBlocker(s, id)) return false;
  const m = MARKETS.find((x) => x.id === id);
  s.cash -= m.license;
  s.markets[id] = { status: 'pending', readyDay: s.day + m.lead, subs: 0 };
  note(s, `Applied for a ${m.name} license (-$${m.license}M). Approval in ${m.lead} days.`);
  return true;
}

export function setPlan(s, id) {
  if (PLANS[id]) s.plan = id;
}

function tickSkylink(s) {
  for (const g of [1, 2, 3]) s.constellation[g] *= 1 - 1 / SATS[g].life;
  for (const m of MARKETS) {
    const st = s.markets[m.id];
    if (st.status === 'pending' && s.day >= st.readyDay) {
      st.status = 'active';
      note(s, `${m.name} license approved. Subscribers are signing up.`);
      milestone(s, `market:${m.id}`, `${m.name} license`, 'Skylink can sell there.');
    }
  }
  const q = skylinkQuality(s);
  let room = skylinkCapacity(s) - totalLoad(s); // new subscribers only sign up while there is capacity
  for (const m of MARKETS) {
    const st = s.markets[m.id];
    if (st.status !== 'active') continue;
    const target = demandCeiling(s, m);
    if (q < 1) st.subs *= 1 - CHURN * (1 - q); // congested: users leave
    else if (st.subs < target) {
      const load = m.load ?? 1;
      const add = Math.max(0, Math.min((target - st.subs) * SUB_GROWTH, room / load));
      st.subs += add;
      room -= add * load;
    }
    if (st.subs > target) st.subs += (target - st.subs) * 0.05;
  }
  const subs = totalSubs(s);
  for (const n of [50, 100]) if (subs >= n) milestone(s, `subs${n}`, `${n}k Skylink subscribers`, 'The constellation pays the bills.');
}

// Purchases must leave enough cash to fly the cheapest launch, or the game could soft-lock.
export const canSpend = (s, amount) => s.cash - amount >= CASH_FLOOR;

// A propellant need split into its tanks, with what is short at the site and what buying that costs.
export const propParts = (type, t) => [{ type, t: t * PROP_MIX[type] }, { type: 'lox', t: t * (1 - PROP_MIX[type]) }];
function propBuy(s, site, need) {
  const parts = propParts(need.type, need.t).map((p) => ({ ...p, short: Math.max(0, p.t - (site?.stock[p.type] ?? 0)) }));
  const short = parts.reduce((n, p) => n + p.short, 0);
  return { parts, short, cash: parts.reduce((n, p) => n + p.short * spot(s, p.type) * RUSH_PREMIUM, 0) };
}

export const fuelNeed = (s) => {
  const r = rocketDef(s);
  return { type: r.fuel.type, t: r.fuel.t + (r.role === 'tanker' ? TANKER_LOAD : 0) };
};

// Itemized cash cost of the planned launch. Propellant already in the site's tanks costs nothing more here.
export function launchCosts(s) {
  const r = rocketDef(s);
  if (originIsMoon(s) || originIsMars(s)) {
    const need = originIsMars(s) ? marsReturnNeed(s) : marsMoonNeed(s);
    return { items: [{ label: 'Operations', amt: r.ops }], total: r.ops, fuel: { type: 'methalox', t: need, fromTanks: need, short: 0 } };
  }
  const site = s.sites[s.site];
  const rec = recoveryOf(s);
  const items = [];
  const add = (label, amt) => { if (amt > 0.0005) items.push({ label, amt: +amt.toFixed(2) }); };
  const need = fuelNeed(s);
  const buy = propBuy(s, site, need);
  const short = buy.short;
  add(`Propellant bought (${Math.ceil(short)} t at spot)`, buy.cash);
  if (!r.catch) add('Expended upper stage', r.stage);
  if (rec !== 'expend') add('Refurbishment parts', r.refurb);
  add('Operations', r.ops);
  if (site?.status === 'leased') add('Pad lease', LEASE_FEE);
  if (site?.bays.length && rec !== 'expend' && r.role !== 'depot' && r.role !== 'module' && bestBay(site).tenure === 'rented') add('Hangar rental', BAY_FEE);
  if (rec === 'drone') add('Droneship', DRONESHIP_FEE);
  const total = +items.reduce((n, i) => n + i.amt, 0).toFixed(2);
  return { items, total, fuel: { ...need, parts: buy.parts, fromTanks: need.t - short, short } };
}

export const launchCost = (s) => launchCosts(s).total;

export function launchBlocker(s) {
  const r = rocketDef(s);
  const v = nextVehicle(s, s.rocket);
  const origin = flightOrigin(s);
  const moon = origin !== 'earth'; // a remote base, not an Earth pad
  if (!v) {
    if (origin === 'moon') return 'No Moon-built Skyship at the base (build one with the Fabricator)';
    if (origin === 'mars') return 'No Skyship at the Mars base (land one there, or build one with the Fabricator)';
    const owned = fleetOf(s, s.rocket).filter((x) => hullOrigin(x) === origin);
    if (!owned.length) return `No ${r.short} in the fleet: build one in the Factory`;
    if (origin === 'earth') {
      const here = hullsAt(s, s.rocket, s.site);
      const place = SITES[s.site].short;
      if (!here.length) {
        const from = owned.map((x) => ({ x, d: hullMoveDays(hullSite(x), s.site) })).sort((a, b) => a.d - b.d)[0];
        return `No ${r.short} at ${place}: ship one from ${SITES[hullSite(from.x)].short} (${from.d} days) in the Fleet tab`;
      }
      const moving = here.filter((x) => x.transit);
      if (moving.length === here.length) return `${r.short} arrives at ${place} in ${Math.min(...moving.map((x) => x.transit.arrive)) - s.day} day(s)`;
      return `${r.short} not ready at ${place}: ${Math.min(...here.filter((x) => !x.transit).map((x) => Math.max(x.readyDay, x.returnDay))) - s.day} day(s)`;
    }
    return `${r.short} not ready: ${Math.min(...owned.map((x) => x.readyDay)) - s.day} day(s)`;
  }
  if (!moon) {
    const site = s.sites[s.site];
    if (!site || site.status === 'locked') return 'Pick a launch site you have access to';
    const eff = effDest(s);
    if (!siteAllows(s.site, eff)) return `${SITES[s.site].short} cannot launch to ${DESTINATIONS[eff].name}`;
    if (!site.pads.length) return 'Build a pad first (Sites tab)';
    if (!site.bays.length && recoveryOf(s) !== 'expend' && r.role !== 'depot' && r.role !== 'module') return 'Build a megahangar for the refit first (Sites tab)';
    if (pickPad(site, r.catch, s.day) < 0) {
      if (r.catch && site.pads.length && !site.pads.some((p) => p.tower)) return 'Needs a catch tower on a pad (Sites tab)';
      const soon = Math.min(...site.pads.filter((p) => !r.catch || p.tower).map((p) => p.busyUntil));
      return `All pads busy: ${soon - s.day} day(s)`;
    }
    const late = s.manifest.map((id) => s.contracts.find((c) => c.id === id)).filter((c) => c && contractReady(s, c, s.site) > s.day)
      .sort((a, b) => contractReady(s, b, s.site) - contractReady(s, a, s.site))[0];
    const locked = s._lockDay != null;
    if (late) return locked ? `Payload for ${late.customer} arrives in ${contractReady(s, late, s.site) - s.day} day(s)` : `Lock in the loadout: ${late.customer} needs ${shipDays(late, s.site)} day(s) to ship`;
    if (satsReady(s) > s.day) return locked ? `Satellites arrive in ${satsReady(s) - s.day} day(s)` : `Lock in the loadout: satellites need ${satShipDays(s.site)} day(s) to ship`;
    if (!r.catch && recoveryOf(s) === 'drone' && freeDroneship(s) < 0) return `No droneship free: ${Math.min(...s.droneships.map((d) => d.busyUntil)) - s.day} day(s)`;

  }

  if (r.role === 'tanker') {
    if (!s.depot.built) return 'Needs a LEO depot first';
    if (s.depot.prop >= DEPOT_CAP) return 'Depot is full';
  } else if (r.role === 'depot') {
    if (s.depot.built) return 'Depot already deployed';
  } else if (r.role === 'module') {
    const d = DESTINATIONS[s.dest];
    if (!['moon', 'mars'].includes(d.body) || d.kind !== 'site') return 'Module ships land at a Moon or Mars site';
    const there = baseOn(s, d.body);
    if (there && there.site !== s.dest) return `Your ${d.body === 'mars' ? 'Mars' : 'Moon'} base is at ${DESTINATIONS[there.site].name}`;
    if (r.module === 'icer' && !BASE_PARAMS[d.body].iceSites.includes(s.dest)) return `Ice only exists at ${d.body === 'mars' ? 'Utopia Planitia' : 'Shackleton Crater'}`;
    if (d.body === 'mars' && !marsWindow(s.day).open) return `Mars window opens in ${marsWindow(s.day).opensIn} days`;
    if (!s.depot.built) return `${d.body === 'mars' ? 'Mars' : 'Lunar'} flights need a LEO depot`;
    if (modulePropNeed(s) > s.depot.prop) return `Depot propellant ${Math.floor(s.depot.prop)}/${modulePropNeed(s)} t`;
  } else {
    const d = DESTINATIONS[s.dest];
    const t = manifestTotals(s);
    const cap = capacity(s);
    if (!destUnlocked(s, s.dest)) return 'Destination locked';
    if (!s.manifest.length && !s.sats) return 'Manifest is empty';
    if (t.mass > cap.mass) return 'Over payload mass limit';
    if (t.volume > cap.volume) return 'Over fairing volume limit';
    if (s.sats && s._lockDay == null && s.sats > s.satStock[s.satGen]) return `Only ${s.satStock[s.satGen]} ${SATS[s.satGen].name} satellites built: queue more in the Factory tab`;
    if (s.sats && !SAT_DESTS.includes(s.dest)) return 'Skylink satellites fly to LEO or Polar LEO';
    if (s.sats && !satGenOk(s, s.satGen)) return `${SATS[s.satGen].name} satellites need a ${SATS[s.satGen].only ? 'Skyship' : 'researched generation'}`;
    if (s.sats && origin !== 'earth') return 'Skylink satellites launch from Earth';
    if (origin === 'mars') {
      if (!marsReturnWindow(s.day).open) return `Return window opens in ${marsReturnWindow(s.day).opensIn} days`;
      const need = marsReturnNeed(s);
      if (!s.marsBase) return 'A Mars base is needed';
      if (s.marsBase.stock.methalox < need) return `Mars base methalox ${Math.floor(s.marsBase.stock.methalox)}/${need} t`;
    } else if (d.body === 'mars') {
      if (s.rocket !== 'skyship') return 'Mars needs a Skyship';
      const w = marsWindow(s.day);
      if (!w.open) return `Mars window opens in ${w.opensIn} days`;
      if (origin === 'moon') {
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
  const held = s._lockDay != null; // a locked loadout's satellites were taken from the stock when it was locked
  delete s._lockDay;
  const r = rocketDef(s);
  const v = nextVehicle(s, s.rocket);
  const origin = flightOrigin(s);
  const moon = origin !== 'earth'; // leaves from a remote base, with no Earth pad
  const site = moon ? null : s.sites[s.site];
  const pad = moon ? null : site.pads[pickPad(site, r.catch, s.day)];
  const destId = effDest(s);
  const d = DESTINATIONS[destId];
  const mars = isMars(destId);
  const rec = moon ? 'catch' : recoveryOf(s);
  const costs = launchCosts(s);
  const cost = costs.total;
  // Propellant leaves the tanks whatever happens on ascent.
  if (moon) baseOn(s, origin).stock.methalox -= costs.fuel.t;
  else for (const p of costs.fuel.parts) site.stock[p.type] -= p.t - p.short;
  s.cash -= cost;
  s.totalLaunches++;
  const failed = Math.random() < failChance(s, v);
  const route = origin === 'mars' ? MARS_RETURN : mars ? MARS_ROUTES[origin === 'moon' ? 'moon' : 'direct'] : null;

  const trip = {
    id: s.nextId++, serial: v.serial, type: s.rocket, role: r.role, dest: destId, site: moon ? null : s.site,
    origin, fromSite: moon ? baseOn(s, origin).site : undefined,
    launchDay: s.day, arriveDay: s.day + (route ? route.days : d.days), status: 'enroute', payout: 0, sats: 0,
    landRisk: !route ? 0 : origin === 'mars' ? route.landRisk : origin === 'moon' ? marsRisks(s).moonLand : marsRisks(s).land,
  };
  if (r.role === 'module') {
    trip.module = r.module;
    if (!failed) {
      const used = modulePropNeed(s);
      s.depot.prop -= used;
      if (used) emit({ type: 'dock', mode: 'refuel', t: used, left: s.depot.prop });
    }
  }
  if (r.role === 'payload') {
    const t = manifestTotals(s);
    trip.payout = t.payout;
    trip.sats = s.sats;
    trip.satGen = s.satGen;
    if (!held) s.satStock[s.satGen] -= s.sats;
    const need = moon ? 0 : tliNeed(s);
    s.contracts = s.contracts.filter((c) => !s.manifest.includes(c.id));
    s.manifest = [];
    s.sats = 0;
    if (!failed && need) {
      s.depot.prop -= need;
      emit({ type: 'dock', mode: 'refuel', t: need, left: s.depot.prop });
    }
  }

  const from = origin === 'moon' ? 'the Moon base' : origin === 'mars' ? 'the Mars base' : SITES[s.site].short;
  if (failed) {
    trip.status = 'lost';
    s.fleet = s.fleet.filter((x) => x !== v);
    if (pad) pad.busyUntil = s.day + (r.catch ? PAD_FAIL_CLOSED * 2 : PAD_FAIL_CLOSED);
    milestone(s, 'firstFailure', 'First anomaly', `${v.serial} was lost. Every rocket company has one.`);
    note(s, `${v.serial} LOST on ascent from ${from} to ${d.name}. Hull and payload destroyed${pad ? `, ${pad.busyUntil - s.day} day pad repair` : ''}.`);
  } else {
    if (pad) pad.busyUntil = s.day + PAD_TURN;
    s.flightCounts[s.rocket] = (s.flightCounts[s.rocket] ?? 0) + 1;
    for (const n of [10, 50, 100, 250]) if (reputation(s) >= n) milestone(s, `flights${n}`, `${n} successful flights`, 'Customers are calling.');
    const reflown = v.flights >= 1 && rec !== 'expend';
    v.flights++;
    if (reflown) milestone(s, 'reflown', 'First reflown booster', `${v.serial} flew again.`);
    if (rec === 'drone') s.droneships[freeDroneship(s)].busyUntil = s.day + DRONESHIP_CYCLE;
    if (r.role === 'depot' || r.role === 'module' || rec === 'expend' || mars || origin === 'mars') {
      s.fleet = s.fleet.filter((x) => x !== v); // single use, expended, or away on a trip to Mars or back
      if (r.role === 'payload' && (mars || origin === 'mars')) trip.hull = { serial: v.serial, flights: v.flights };
    } else {
      const bay = bestBay(site);
      const start = Math.max(s.day + roundTripDays(destId) + (rec === 'drone' ? DRONE_TOW_DAYS : 0), bay?.freeAt ?? 0);
      v.readyDay = start + refitDays(s);
      if (bay) bay.freeAt = v.readyDay;
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
    note(s, `${trip.serial} was lost ${trip.origin === 'mars' ? 'returning to Earth' : 'entering the Martian atmosphere'}. Payload and hull destroyed.`, 'bad', true);
    return;
  }
  trip.status = 'done';
  if (d.body === 'mars' && trip.origin !== 'mars') s.marsLandings = (s.marsLandings ?? 0) + 1;
  if (trip.role === 'payload') {
    s.cash += trip.payout;
    if (trip.sats) s.constellation[trip.satGen ?? 1] += trip.sats;
    const bits = [];
    if (trip.payout) bits.push(`+$${trip.payout}M`);
    if (trip.sats) bits.push(`${trip.sats} ${SATS[trip.satGen ?? 1].name} sats in orbit`);
    note(s, `${trip.serial} arrived at ${d.name}.${bits.length ? ` ${bits.join(', ')}.` : ''}`);
    milestone(s, 'firstFlight', 'First successful flight', `${trip.serial} delivered its payload to ${d.name}.`);
    if (d.body === 'moon') milestone(s, 'firstMoon', 'First cargo on the Moon', `${trip.serial} landed at ${d.name}.`);
    if (d.body === 'mars') milestone(s, 'firstMars', 'First delivery to Mars', `${trip.serial} reached ${d.name}.`);
    // A Skyship that lands at a Mars base stays there (GDD 2.17); a return flight brings its hull home to Cape Canaveral.
    if (trip.hull && d.body === 'mars' && s.marsBase?.site === trip.dest) {
      s.fleet.push({ id: s.nextId++, type: trip.type, serial: trip.hull.serial, flights: trip.hull.flights, returnDay: s.day, readyDay: s.day + MARS_RETURN.refit, site: 'mars' });
      note(s, `${trip.hull.serial} stays at the Mars base, ready to fly home in ${MARS_RETURN.refit} days.`, 'good');
    } else if (trip.hull && trip.origin === 'mars') {
      s.fleet.push({ id: s.nextId++, type: trip.type, serial: trip.hull.serial, flights: trip.hull.flights, returnDay: s.day, readyDay: s.day + refitDays(s), site: 'cape' });
      note(s, `${trip.hull.serial} is back from Mars and lands at Cape Canaveral.`, 'good');
      milestone(s, 'marsReturn', 'First flight home from Mars', `${trip.hull.serial} returned to Earth.`);
    }
  } else if (trip.role === 'module') {
    const onMars = d.body === 'mars';
    let base = baseOn(s, d.body);
    if (!base) {
      base = createBase(trip.dest, d.body);
      if (onMars) s.marsBase = base; else s.base = base;
      note(s, `${d.name} chosen as the ${onMars ? 'Mars' : 'Moon'} base site.`);
      milestone(s, onMars ? 'marsBase' : 'base', onMars ? 'Mars base founded' : 'Moon base founded', `The first module landed at ${d.name}.`);
    }
    base.pending.push({ id: base.nextId++, type: trip.module });
    note(s, `${trip.serial} landed at ${d.name}: open the Base view to place the module.`);
  } else if (trip.role === 'tanker') {
    s.depot.prop = Math.min(DEPOT_CAP, s.depot.prop + TANKER_LOAD);
    note(s, `${trip.serial} delivered ${TANKER_LOAD} t. Depot: ${Math.round(s.depot.prop)}/${DEPOT_CAP} t.`);
    emit({ type: 'dock', mode: 'deliver', t: TANKER_LOAD, left: s.depot.prop });
  } else {
    s.depot = { built: true, prop: 0 };
    note(s, `${trip.serial} is on station: LEO depot online. Fly tanker runs to fill it.`);
    milestone(s, 'depot', 'LEO depot online', 'Orbital refueling is possible.');
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


// Research that needs a prototype test flight stays in "testing" until a test succeeds (GDD 2.12).
export function techState(s, id) {
  if (s.tech.has(id)) return 'owned';
  if (s.trials[id]) return 'testing';
  return techBlockers(s, id).length ? 'locked' : 'available';
}

export function buyTech(s, id) {
  const t = TECH.find((x) => x.id === id);
  if (techState(s, id) !== 'available' || !canSpend(s, t.cost)) return false;
  s.cash -= t.cost;
  if (PROTOS[id]) {
    s.trials[id] = { articles: 0, attempts: 0 };
    note(s, `${t.name} funded (-$${t.cost}M). Build a ${PROTOS[id].name} in the Factory, then fly it from the R&D tab.`);
    return true;
  }
  finishTech(s, id);
  return true;
}

function finishTech(s, id) {
  const t = TECH.find((x) => x.id === id);
  s.tech.add(id);
  delete s.trials[id];
  note(s, `Research complete: ${t.name}.`);
  milestone(s, `tech:${id}`, t.name, 'Research complete');
  if (id === 'landing') s.recovery = 'rtls';
  if (['hull', 'raptor', 'tiles'].includes(id) && rocketUnlocked(s, 'behemoth')) {
    note(s, 'Behemoth Prototype unlocked. It needs a pad with a catch tower: build one, or buy Boca Chica.');
  }
  if (id === 'skyship') note(s, 'Operational Skyship unlocked: 150 t, 3-day turnaround.');
  if (id === 'plants') note(s, 'Propellant Plants unlocked: owned sites can make their own fuel.');
  if (id === 'tanker') note(s, 'Orbital Tanker unlocked. Build a Depot and Tanker Skyships, and the Moon opens up.');
  if (id === 'isru') note(s, 'Lunar ISRU unlocked: smelters and a Fabricator can run on the Moon.');
  if (id === 'ice') note(s, 'Lunar Ice Mining unlocked: Ice Miner and Refinery module ships (at Shackleton).');
  if (id === 'marsTransit') note(s, `Mars Transfer unlocked. ${marsWindow(s.day).open ? 'A launch window is open now.' : `The next window opens in ${marsWindow(s.day).opensIn} days (${dateOf(marsWindow(s.day).opens).text}).`}`);
}

// ---- prototype test flights ------------------------------------------------------------------------

export const rdAt = (siteId) => ({ ...RD_DEFAULT, ...(SITES[siteId]?.rd ?? {}) });
export const testOdds = (s, id) => Math.min(ODDS_MAX, PROTOS[id].odds + ODDS_LEARNING * (s.trials[id]?.learn ?? s.trials[id]?.attempts ?? 0));
// Cost ($M) and build days of a test article at a factory site.
export const testBuildAt = (id, siteId) => {
  const rd = rdAt(siteId);
  return { cost: +(PROTOS[id].cost * rd.costFactor).toFixed(2), days: Math.max(1, Math.round(PROTOS[id].days * rd.buildFactor)) };
};

export function testBuildBlocker(s, id, siteId = 'cape') {
  const p = PROTOS[id];
  const site = s.sites[siteId];
  if (!s.trials[id]) return 'Fund the research first';
  if (!site || !site.lines) return 'No factory here';
  const short = Math.max(0, p.t - site.stock[p.metal]);
  return canSpend(s, testBuildAt(id, siteId).cost + short * spot(s, p.metal) * RUSH_PREMIUM) ? null : 'Not enough cash';
}

export function queueTest(s, id, siteId = 'cape') {
  if (testBuildBlocker(s, id, siteId)) return false;
  const p = PROTOS[id];
  const site = s.sites[siteId];
  const short = Math.max(0, p.t - site.stock[p.metal]);
  const rush = short * spot(s, p.metal) * RUSH_PREMIUM;
  site.stock[p.metal] -= p.t - short;
  const at = testBuildAt(id, siteId);
  s.cash -= at.cost + rush;
  site.queue.push({ id: s.nextId++, kind: 'test', tech: id, type: null, daysLeft: at.days, total: at.days, cost: at.cost });
  note(s, `Queued a ${p.name} at ${SITES[siteId].short} (-$${(at.cost + rush).toFixed(1)}M, ${at.days} days).`);
  return true;
}

export function testFlightBlocker(s, id) {
  if (!s.trials[id]) return 'Fund the research first';
  if (s.trials[id].articles < 1) return 'Build a test article first';
  const site = s.sites[s.site];
  if (!site || site.status === 'locked' || pickPad(site, false, s.day) < 0) return 'No free pad at the launch site';
  return canSpend(s, PROTOS[id].ops) ? null : 'Not enough cash';
}

// Flies the test article from a free pad. Returns { ok, success }.
export function flyTest(s, id) {
  if (testFlightBlocker(s, id)) return { ok: false };
  const p = PROTOS[id];
  const trial = s.trials[id];
  const name = TECH.find((x) => x.id === id).name;
  const pad = s.sites[s.site].pads[pickPad(s.sites[s.site], false, s.day)];
  const odds = testOdds(s, id);
  const rd = rdAt(s.site);
  s.cash -= p.ops;
  trial.articles--;
  if (Math.random() < odds) {
    pad.busyUntil = s.day + rd.padTurn;
    emit({ type: 'test', success: true });
    note(s, `${name} test flight SUCCEEDED (${Math.round(odds * 100)}% odds).`);
    finishTech(s, id);
    return { ok: true, success: true };
  }
  trial.attempts++;
  trial.learn = (trial.learn ?? trial.attempts - 1) + rd.learning;
  pad.busyUntil = s.day + rd.failClosed;
  emit({ type: 'test', success: false });
  note(s, `${name} test flight FAILED (${Math.round(odds * 100)}% odds). Pad closed ${rd.failClosed} days. Next attempt: ${Math.round(testOdds(s, id) * 100)}%.`);
  return { ok: true, success: false };
}

// ---- tutorial (GDD 2.16) -------------------------------------------------------------------

const queued = (s, f) => Object.values(s.sites).some((x) => x.queue.some(f));
export const TUTORIAL = [
  { id: 'load', tab: 'mission', title: 'Load a contract', text: 'Tap a contract in the Mission tab to put it on your rocket, then press LOCK IN LOADOUT. The payload ships and the rocket launches by itself.', done: (s) => s.manifest.length > 0 || s.totalLaunches > 0 },
  { id: 'launch', tab: 'mission', title: 'Launch', text: 'Wait for the payload to ship in, or press LAUNCH when it shows. The payout arrives when the flight does.', done: (s) => s.totalLaunches > 0 },
  { id: 'hull', tab: 'factory', title: 'Build a new booster', text: 'The booster was thrown away. Queue a Peregrine 9 in the Factory tab to fly again.', done: (s) => s.fleet.length > 0 || queued(s, (q) => q.type === 'peregrine9') },
  { id: 'gen1', tab: 'tech', title: 'Research Skylink Gen-1', text: 'In R&D, buy Skylink Gen-1 ($5M). It unlocks satellite batches that earn money every day.', done: (s) => s.tech.has('gen1') },
  { id: 'landing', tab: 'tech', title: 'Fund Booster Landing', text: 'Reusable boosters are the big win. Fund Booster Landing in R&D. It needs a test flight.', done: (s) => s.tech.has('landing') || !!s.trials.landing },
  { id: 'article', tab: 'tech', title: 'Build a test article', text: 'Press Build on the Booster Landing row. The article takes a few days in the factory.', done: (s) => s.tech.has('landing') || (s.trials.landing?.articles ?? 0) > 0 || (s.trials.landing?.attempts ?? 0) > 0 || queued(s, (q) => q.kind === 'test') },
  { id: 'fly', tab: 'tech', title: 'Fly the test', text: 'Press Fly test when the article is ready. It is a dice roll: failure costs the article and a pad repair, but the odds improve each try.', done: (s) => s.tech.has('landing') || (s.trials.landing?.attempts ?? 0) > 0 },
];

// The current tutorial step, skipping the ones the player has already done. Null when finished.
export function tutorialStep(s) {
  while (s.tutorial < TUTORIAL.length && TUTORIAL[s.tutorial].done(s)) s.tutorial++;
  return TUTORIAL[s.tutorial] ?? null;
}
export const skipTutorial = (s) => { s.tutorial = TUTORIAL.length; };

// ---- time ---------------------------------------------------------------------

export function tick(s) {
  s.day++;
  tickSkylink(s);
  if (s.depot.built) s.depot.prop *= 1 - BOILOFF_PER_DAY;
  tickMarket(s);

  for (const t of s.trips) if (t.status === 'enroute' && t.arriveDay <= s.day) arrive(s, t);
  tickBase(s, (m, k) => note(s, m, k));
  tickBase(s, (m, k) => note(s, m, k), s.marsBase);
  for (const [body, base] of [['moon', s.base], ['mars', s.marsBase]]) {
    while (base?.ships?.length) {
      const made = base.ships.shift();
      const v = addVehicle(s, made.type, body);
      note(s, `${v.serial} was built at the ${body === 'mars' ? 'Mars' : 'Moon'} base and is ready to fly from there.`);
    }
  }
  if (s.marsBase?.stock.methalox >= 1) milestone(s, 'marsFuel', 'First methalox made on Mars', 'Fuel from Martian ice and air.');

  for (const v of s.fleet) {
    if (v.transit && v.transit.arrive <= s.day) {
      v.site = v.transit.to;
      delete v.transit;
      note(s, `${v.serial} arrived at ${SITES[v.site].short}.`);
    }
  }
  dispatchHulls(s);

  // Hulls past their rated flights retire once their last refit is done.
  for (const v of [...s.fleet]) {
    if (v.flights >= coreLife(s, v.type) && s.day >= v.readyDay) {
      s.fleet = s.fleet.filter((x) => x !== v);
      note(s, `${v.serial} retired after ${v.flights} flights.`);
    }
  }

  // Each site's factory: every line works on one queued item.
  for (const site of Object.values(s.sites)) {
    for (const q of site.queue.slice(0, site.lines)) q.daysLeft--;
    for (const q of site.queue.filter((x) => x.daysLeft <= 0)) {
      if (q.kind === 'test') {
        if (s.trials[q.tech]) s.trials[q.tech].articles++;
        note(s, `${PROTOS[q.tech].name} is ready for its test flight (R&D tab).`, 'good', true);
        continue;
      }
      const v = addVehicle(s, q.type, site.id);
      note(s, `${v.serial} rolled out of the ${SITES[site.id].short} factory.`);
    }
    site.queue = site.queue.filter((q) => q.daysLeft > 0);
  }
  tickPlants(s);
  tickSatPlant(s);

  s.income = dailyRevenue(s);
  s.cash += s.income;
  s.cashHistory = [...(s.cashHistory ?? []), s.cash].slice(-90);
  for (const n of [100, 500, 1000]) if (s.cash >= n) milestone(s, `cash${n}`, `$${n}M in the bank`, 'The company is growing up.');
  // Payroll is covered by investors below the floor, so a bad run never locks the game.
  s.cash = Math.max(s.cash - OVERHEAD_PER_DAY, Math.min(s.cash, CASH_FLOOR));
  tickGoals(s, {
    milestone: (id, title, text) => milestone(s, id, title, text),
    note: (msg, kind) => note(s, msg, kind),
    victory: () => { note(s, 'A self-sustaining Mars colony: Perigee Industries has done it.', 'good'); emit({ type: 'victory', day: s.day }); },
  });

  // Investors step in when the company can no longer fly anything.
  const p9 = ROCKETS.peregrine9;
  const queued = Object.values(s.sites).flatMap((x) => x.queue).filter((q) => q.kind !== 'test');
  const hasCargoHull = [...s.fleet, ...queued].some((x) => ROCKETS[x.type].role === 'payload');
  if (!hasCargoHull && s.cash < p9.buildCost + CASH_FLOOR + 2) {
    s.cash = p9.buildCost + CASH_FLOOR + 2;
    note(s, 'Investors wire emergency funding: queue a new Peregrine 9.', 'warn', true);
  }
  if (hasCargoHull && s.income < 0.05 && s.cash < 2.5 && !activeTrips(s).length) {
    s.cash = CASH_FLOOR;
    note(s, 'Investors cover launch costs.');
  }

  if (s.tech.has('marsTransit')) {
    const w = marsWindow(s.day);
    const before = marsWindow(s.day - 1);
    if (w.open && !before.open) note(s, `The Mars window is OPEN for ${w.closesIn} days.`, 'warn', true);
    else if (!w.open && w.opensIn === 30) note(s, `The next Mars window opens in 30 days (${dateOf(w.opens).text}).`, 'warn', true);
  }

  const expired = s.contracts.filter((c) => c.expires < s.day && !c.lockId);
  if (expired.length) {
    s.contracts = s.contracts.filter((c) => !expired.includes(c));
    s.manifest = s.manifest.filter((id) => s.contracts.some((c) => c.id === id));
  }
  const board = boardSize(s);
  if (s.day % board.every === 0 && s.contracts.length < board.cap) s.contracts.push(newContract(s));
}
