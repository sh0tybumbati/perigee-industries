// Static game data, taken from GDD sections 2.1-2.2 and 3.

function modShip(name, short, code, module, requires, buildCost, buildDays) {
  return {
    name, short, code, role: 'module', module, shipMass: 80, payload: 0, volume: 0, turnaround: 3, refurb: 0, ops: 3.5, sats: 0,
    requires, coreLife: 1, buildCost, buildDays, baseRisk: 0.04, wearRisk: 0, catch: true,
  };
}

// role: 'payload' carries contracts and satellites; 'tanker' fills the LEO depot; 'depot' becomes the depot (single use).
export const ROCKETS = {
  peregrine9: {
    name: 'Peregrine 9', short: 'Peregrine 9', code: 'P9', role: 'payload', payload: 22, volume: 60, turnaround: 7, refurb: 0.4, ops: 0.8, sats: 24,
    requires: [], coreLife: 10, buildCost: 12, buildDays: 8, baseRisk: 0.01, wearRisk: 0.004,
  },
  peregrineHeavy: {
    name: 'Peregrine Heavy', short: 'Heavy', code: 'PH', role: 'payload', payload: 64, volume: 140, turnaround: 14, refurb: 1.2, ops: 2.5, sats: 24,
    requires: ['heavyCores'], coreLife: 10, buildCost: 25, buildDays: 16, baseRisk: 0.015, wearRisk: 0.004,
  },
  // Prototype: risky until a few test flights have been flown. Lands by tower catch, so no RTLS/droneship choice.
  behemoth: {
    name: 'Behemoth Prototype', short: 'Behemoth', code: 'BH', role: 'payload', payload: 100, volume: 260, turnaround: 21, refurb: 3, ops: 6, sats: 36,
    requires: ['hull', 'raptor', 'tiles'], coreLife: 4, buildCost: 30, buildDays: 30, baseRisk: 0.12, wearRisk: 0.02, catch: true,
  },
  skyship: {
    name: 'Skyship (Cargo)', short: 'Skyship', code: 'SKY', role: 'payload', payload: 150, volume: 400, turnaround: 3, refurb: 0.6, ops: 3.5, sats: 60,
    requires: ['skyship'], coreLife: 40, buildCost: 60, buildDays: 24, baseRisk: 0.03, wearRisk: 0.002, catch: true,
  },
  skyshipTanker: {
    name: 'Skyship Tanker', short: 'Tanker', code: 'TNK', role: 'tanker', payload: 0, volume: 0, turnaround: 3, refurb: 0.6, ops: 3.5, sats: 0,
    requires: ['tanker'], coreLife: 40, buildCost: 50, buildDays: 20, baseRisk: 0.03, wearRisk: 0.002, catch: true,
  },
  skyshipDepot: {
    name: 'Skyship Depot', short: 'Depot', code: 'DPT', role: 'depot', payload: 0, volume: 0, turnaround: 3, refurb: 0, ops: 3.5, sats: 0,
    requires: ['tanker'], coreLife: 1, buildCost: 75, buildDays: 30, baseRisk: 0.03, wearRisk: 0, catch: true,
  },
  // Module ships are single use: the hull lands at the base site and becomes a base module lying on its side.
  modHab: modShip('Habitat Skyship', 'Habitat', 'HAB', 'habitat', ['habitat'], 80, 30),
  modReactor: modShip('Reactor Skyship', 'Reactor', 'RCT', 'reactor', ['habitat'], 90, 34),
  modDrones: modShip('Drone Bay Skyship', 'Drone Bay', 'DRN', 'drones', ['habitat'], 70, 26),
  modSmelter: modShip('Smelter Skyship', 'Smelter', 'SML', 'smelter', ['isru'], 85, 32),
  modFab: modShip('Fabricator Skyship', 'Fabricator', 'FAB', 'fab', ['isru'], 100, 36),
};

export const PAD_NAMES = ['Pad 39A', 'Pad 39B', 'SLC-40'];
export const PAD_COSTS = [0, 25, 40]; // $M to buy the 1st (free), 2nd and 3rd pad
export const PAD_TURN = 2; // days before a pad can launch again
export const PAD_FAIL_CLOSED = 14; // days a pad is closed after a failure (28 for tower-catch vehicles)
export const LINE_COSTS = [0, 40, 80, 120]; // $M to add the 1st (free) .. 4th factory line
export const CANCEL_REFUND = 0.5;

export const BEHEMOTH_LEARNING = 0.03; // risk drop per successful Behemoth flight
export const BEHEMOTH_MIN_RISK = 0.04;

// LEO propellant depot (GDD 2.3)
export const DEPOT_COST = 15; // $M hardware
export const DEPOT_CAP = 500; // t of CH4/LOX
export const TANKER_LOAD = 100; // t delivered per tanker run
export const TANKER_PROP_COST = 2; // $M of propellant per run
export const BOILOFF_PER_DAY = 0.004;
export const TLI_PROP_PER_TON = 3; // t of propellant per t of lunar payload (surface sites)

export const LAUNCH_SITE = { name: 'Cape Canaveral', lat: 28.5, lon: -80.6 };

// body: which map shows it. kind: orbit (ring) or site (surface pin). days: one-way travel time.
// ring: radius in planet radii, incl/node in degrees, phase = degrees along the ring, from the point nearest the
// map's center, where the clickable pin sits.
// prop: tonnes of depot propellant burned per tonne of payload.
export const DESTINATIONS = {
  leo: { name: 'LEO (28.5°)', body: 'earth', kind: 'orbit', days: 1, prop: 0, ring: { r: 1.16, incl: 28.5, node: 0, phase: 35 } },
  polar: { name: 'Polar LEO', body: 'earth', kind: 'orbit', days: 1, prop: 0, ring: { r: 1.2, incl: 90, node: 20, phase: -40 } },
  sso: { name: 'Sun-synchronous', body: 'earth', kind: 'orbit', days: 1, prop: 0, ring: { r: 1.26, incl: 98, node: -50, phase: 20 } },
  gto: { name: 'GTO', body: 'earth', kind: 'orbit', days: 1, prop: 0, ring: { r: 1.1, apo: 2.0, incl: 12, node: 0, phase: 0 } },
  llo: { name: 'Low Lunar Orbit', body: 'moon', kind: 'orbit', days: 4, prop: 2, ring: { r: 1.25, incl: 70, node: 10, phase: 50 } },
  shackleton: { name: 'Shackleton Crater', body: 'moon', kind: 'site', days: 5, prop: 3, lat: -88, lon: 0 },
  tranq: { name: 'Mare Tranquillitatis', body: 'moon', kind: 'site', days: 5, prop: 3, lat: 8.5, lon: 31.4 },
  procellarum: { name: 'Oceanus Procellarum', body: 'moon', kind: 'site', days: 5, prop: 3, lat: 18, lon: -57 },
  marsOrbit: { name: 'Mars Orbit', body: 'mars', kind: 'orbit', days: 180, prop: 6, locked: 'marsTransit', ring: { r: 1.3, incl: 45, node: 0, phase: 50 } },
  jezero: { name: 'Jezero Crater', body: 'mars', kind: 'site', days: 180, prop: 6, locked: 'marsTransit', lat: 18.4, lon: 77.5 },
  utopia: { name: 'Utopia Planitia', body: 'mars', kind: 'site', days: 180, prop: 6, locked: 'marsTransit', lat: 46, lon: 118 },
};
export const EARTH_ORBITS = ['leo', 'polar', 'sso', 'gto'];
export const LUNAR_DESTS = ['llo', 'shackleton', 'tranq', 'procellarum'];
export const SAT_DESTS = ['leo', 'polar']; // Skylink shells
export const BODIES = {
  earth: { name: 'Earth' },
  moon: { name: 'Moon' },
  mars: { name: 'Mars' },
};

export const RTLS_PAYLOAD_PENALTY = 0.2;
export const RTLS_TURNAROUND_SAVED = 2;
export const DRONESHIP_FEE = 0.3; // $M per launch
export const SAT_MASS = 0.27; // t, Gen-1
export const SAT_VOLUME = 0.9; // m^3, stacked
export const SAT_LIFE_DAYS = 5 * 365;
export const SAT_COST = 0.35; // $M each
export const OVERHEAD_PER_DAY = 0.12; // $M payroll and facilities
export const CASH_FLOOR = 5; // $M overhead never drains cash below this

export const REGIONS = [
  { id: 'na', name: 'North America', daily: 0.45, satsFull: 120 },
  { id: 'eu', name: 'Europe', daily: 0.31, satsFull: 100 },
  { id: 'apac', name: 'Asia-Pacific', daily: 0.22, satsFull: 140 },
  { id: 'sa', name: 'South America', daily: 0.12, satsFull: 80 },
  { id: 'af', name: 'Africa', daily: 0.09, satsFull: 90 },
  { id: 'mar', name: 'Maritime & Air', daily: 0.14, satsFull: 110 },
];

export const CUSTOMERS = ['Aurora Telecom', 'Helix Earth Obs', 'Kestrel Defense', 'Meridian Labs', 'Polaris Comms', 'Tern Weather', 'Vela Science', 'Orion Media'];

export const TECH = [
  { id: 'fastCores', name: 'Fast Turnaround Cores', cost: 12, era: 'Peregrine', desc: 'Peregrine turnaround -2 days', requires: [] },
  { id: 'gen1', name: 'Skylink Gen-1', cost: 5, era: 'Peregrine', desc: 'Unlock broadband satellite batches', requires: [] },
  { id: 'heavyCores', name: 'Peregrine Heavy', cost: 60, era: 'Peregrine', desc: 'Unlock 64 t Peregrine Heavy', requires: ['fastCores'] },
  { id: 'hull', name: 'Stainless Hull', cost: 120, era: 'Super-Heavy', desc: 'Needed for the Behemoth Prototype', requires: ['heavyCores', 'gen1'] },
  { id: 'raptor', name: 'Harrier V3', cost: 150, era: 'Super-Heavy', desc: 'Needed for the Behemoth Prototype', requires: ['heavyCores', 'gen1'] },
  { id: 'tiles', name: 'Heat Shield Tiles', cost: 140, era: 'Super-Heavy', desc: 'Needed for the Behemoth Prototype', requires: ['heavyCores', 'gen1'] },
  {
    id: 'skyship', name: 'Operational Skyship', cost: 400, era: 'Super-Heavy',
    desc: 'Rapid-turnaround 150 t Skyship. Qualify it with 3 successful Behemoth flights.',
    requires: ['hull', 'raptor', 'tiles'], flights: { rocket: 'behemoth', n: 3 },
  },
  { id: 'tanker', name: 'Orbital Tanker', cost: 600, era: 'Lunar', desc: 'Skyship depot and tanker missions, and lunar contracts', requires: ['skyship'] },
  { id: 'habitat', name: 'Moon Habitat Core', cost: 900, era: 'Lunar', desc: 'Lunar base (coming soon)', requires: ['skyship'] },
  { id: 'isru', name: 'Lunar ISRU Mining', cost: 1200, era: 'Lunar', desc: 'Lunar base (coming soon)', requires: ['skyship'] },
  { id: 'marsTransit', name: 'Mars Transfer Vehicle', cost: 2000, era: 'Mars', desc: 'Mars orbit and landing sites (coming soon)', requires: ['isru', 'habitat'] },
];

// ---- Lunar base (GDD 2.8) ----------------------------------------------------
// len: tiles along the tube. power: MW (positive makes power). need: crew to run it. cover: tonnes of regolith to bury it.
export const MODULES = {
  habitat: { name: 'Habitat', len: 5, power: -0.15, need: 0, crew: 6, cover: 30, color: 0xdfe6f2, blurb: 'Houses 6 crew.' },
  reactor: { name: 'Reactor', len: 4, power: 1.0, need: 0, cover: 30, color: 0xf0a35a, blurb: 'Fission power: 1.0 MW.' },
  drones: { name: 'Drone Bay', len: 3, power: -0.2, need: 1, drones: 4, cover: 20, color: 0x8fd18f, blurb: 'Houses 4 construction drones.' },
  smelter: { name: 'Smelter', len: 5, power: -0.5, need: 2, cover: 30, color: 0x9fb0c8, blurb: 'Makes oxygen, iron and silica from regolith.' },
  fab: { name: 'Fabricator', len: 5, power: -0.3, need: 2, cover: 30, color: 0xe8d36a, blurb: 'Builds modules from local materials.' },
};
export const BASE_W = 48; // grid size in tiles (one tile is about 10 m)
export const BASE_H = 30;
export const DUCT_COST = 1.5; // $M each, shipped from Earth
export const DUCT_MAX = 10; // tiles
export const DRONE_RATE = 0.6; // tonnes of regolith moved per drone per day
export const SMELTER_REGOLITH = 2; // t of regolith per day at full output
export const SMELTER_OUT = { oxygen: 3, iron: 1.2, silica: 2 }; // t per day at full output
export const STOCK_PRICES = { oxygen: 0.1, iron: 0.24, silica: 0.08 }; // $M per tonne
export const STOCK_KEEP = { oxygen: 40, iron: 120, silica: 80 }; // surplus selling leaves this much
export const SPE_CHANCE = 1 / 50; // solar particle event chance per day
export const CREW_DEATH_COST = 5; // $M
export const CREW_REPLACE_COST = 1; // $M
export const DRONE_POLICIES = {
  bury: { name: 'Bury', dig: 0.5, place: 0.5, hint: 'Modules first: half dig, half place.' },
  balanced: { name: 'Balanced', dig: 0.75, place: 0.25, hint: 'Mostly dig, so smelters stay fed, with some burying.' },
  mine: { name: 'Mine', dig: 1, place: 0, hint: 'All digging: build up regolith for smelters.' },
};
// What the Fabricator needs to build a module on the Moon, with the imported components paid in cash ($M).
export const LOCAL_RECIPES = {
  habitat: { iron: 80, silica: 50, oxygen: 20, cash: 18, days: 20 },
  reactor: { iron: 60, silica: 20, oxygen: 10, cash: 45, days: 25 },
  drones: { iron: 40, silica: 15, oxygen: 5, cash: 20, days: 12 },
  smelter: { iron: 70, silica: 40, oxygen: 10, cash: 25, days: 20 },
};
