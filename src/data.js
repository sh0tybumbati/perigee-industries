// Static game data, taken from GDD sections 2.1-2.2 and 3.

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
};

// Moon-base ship variants, shown locked in the factory until that phase is built.
export const FUTURE_VARIANTS = [
  { name: 'Habitat Skyship', tech: 'habitat' },
  { name: 'Reactor Skyship', tech: 'habitat' },
  { name: 'ISRU Skyship', tech: 'isru' },
];

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
