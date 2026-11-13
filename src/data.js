// Static game data, taken from GDD sections 2.1-2.2 and 3.

function modShip(name, short, code, module, requires, buildCost, buildDays) {
  return {
    name, short, code, role: 'module', module, shipMass: 80, payload: 0, volume: 0, turnaround: 3, refurb: 0, ops: 1.3, sats: 0,
    fuel: { type: 'methalox', t: 450 }, stage: 0, steel: 500,
    requires, coreLife: 1, buildCost, buildDays, baseRisk: 0.04, wearRisk: 0, catch: true,
  };
}

// role: 'payload' carries contracts and satellites; 'tanker' fills the LEO depot; 'depot' becomes the depot (single use).
// fuel: propellant burned per launch. stage: cost of the expendable upper stage (0 when the upper stage is reusable).
// refurb: refurbishment parts per flight. ops: crew, range and insurance. steel: tonnes of metal to build a hull
// (stainless steel, or aluminum-lithium when metal is 'aluminum').
export const ROCKETS = {
  peregrine9: {
    name: 'Peregrine 9', short: 'Peregrine 9', code: 'P9', role: 'payload', payload: 22, volume: 60, turnaround: 7, refurb: 0.2, ops: 0.1, sats: 24,
    fuel: { type: 'kerolox', t: 50 }, stage: 0.4, steel: 30, metal: 'aluminum',
    requires: [], coreLife: 10, buildCost: 3, buildDays: 8, baseRisk: 0.01, wearRisk: 0.004,
  },
  peregrineHeavy: {
    name: 'Peregrine Heavy', short: 'Heavy', code: 'PH', role: 'payload', payload: 64, volume: 140, turnaround: 14, refurb: 0.6, ops: 0.3, sats: 24,
    fuel: { type: 'kerolox', t: 150 }, stage: 0.8, steel: 150, metal: 'aluminum',
    requires: ['heavyCores'], coreLife: 10, buildCost: 25, buildDays: 16, baseRisk: 0.015, wearRisk: 0.004,
  },
  // Prototype: risky until a few test flights have been flown. Both stages are caught by the tower.
  behemoth: {
    name: 'Behemoth Prototype', short: 'Behemoth', code: 'BH', role: 'payload', payload: 100, volume: 260, turnaround: 21, refurb: 3, ops: 4.5, sats: 36,
    fuel: { type: 'methalox', t: 300 }, stage: 0, steel: 400,
    requires: ['hull', 'raptor', 'tiles'], coreLife: 4, buildCost: 30, buildDays: 30, baseRisk: 0.12, wearRisk: 0.02, catch: true,
  },
  skyship: {
    name: 'Skyship (Cargo)', short: 'Skyship', code: 'SKY', role: 'payload', payload: 150, volume: 400, turnaround: 3, refurb: 0.6, ops: 1.5, sats: 60,
    fuel: { type: 'methalox', t: 450 }, stage: 0, steel: 500,
    requires: ['skyship'], coreLife: 40, buildCost: 60, buildDays: 24, baseRisk: 0.03, wearRisk: 0.002, catch: true,
  },
  skyshipTanker: {
    name: 'Skyship Tanker', short: 'Tanker', code: 'TNK', role: 'tanker', payload: 0, volume: 0, turnaround: 3, refurb: 0.6, ops: 2.5, sats: 0,
    fuel: { type: 'methalox', t: 450 }, stage: 0, steel: 500,
    requires: ['tanker'], coreLife: 40, buildCost: 50, buildDays: 20, baseRisk: 0.03, wearRisk: 0.002, catch: true,
  },
  skyshipDepot: {
    name: 'Skyship Depot', short: 'Depot', code: 'DPT', role: 'depot', payload: 0, volume: 0, turnaround: 3, refurb: 0, ops: 1.3, sats: 0,
    fuel: { type: 'methalox', t: 450 }, stage: 0, steel: 500,
    requires: ['tanker'], coreLife: 1, buildCost: 75, buildDays: 30, baseRisk: 0.03, wearRisk: 0, catch: true,
  },
  // Module ships are single use: the hull lands at the base site and becomes a base module lying on its side.
  modHab: modShip('Habitat Skyship', 'Habitat', 'HAB', 'habitat', ['habitat'], 80, 30),
  modReactor: modShip('Reactor Skyship', 'Reactor', 'RCT', 'reactor', ['habitat'], 90, 34),
  modDrones: modShip('Drone Bay Skyship', 'Drone Bay', 'DRN', 'drones', ['habitat'], 70, 26),
  modSmelter: modShip('Smelter Skyship', 'Smelter', 'SML', 'smelter', ['isru'], 85, 32),
  modFab: modShip('Fabricator Skyship', 'Fabricator', 'FAB', 'fab', ['isru'], 100, 36),
  modIce: modShip('Ice Miner Skyship', 'Ice Miner', 'ICE', 'icer', ['ice'], 85, 32),
  modRefinery: modShip('Refinery Skyship', 'Refinery', 'REF', 'refinery', ['ice'], 95, 34),
};

// ---- Launch sites, recovery and supply (GDD 2.10) ----------------------------------------
// price: $M to lease or buy the site. noDests/allowDests: orbits the site can reach.
export const SITES = {
  cape: {
    name: 'Cape Canaveral', short: 'Cape', letter: 'C', lat: 28.5, lon: -80.6, pads: ['Pad 39A', 'Pad 39B', 'SLC-40'], factory: true,
    price: { buy: 60 }, start: 'leased', noDests: ['polar', 'sso'], blurb: 'Home site. No polar launches (overflight rules).',
  },
  vandenberg: {
    name: 'Vandenberg', short: 'Vandenberg', letter: 'V', lat: 34.7, lon: -120.6, pads: ['SLC-4E', 'SLC-6'], factory: false,
    price: { lease: 15, buy: 85 }, allowDests: ['leo', 'polar', 'sso'], blurb: 'The only polar and sun-synchronous launches.',
  },
  boca: {
    name: 'Boca Chica (Starbase)', short: 'Boca Chica', letter: 'B', lat: 26.0, lon: -97.2, pads: Array.from({ length: 8 }, (_, i) => `Orbital Pad ${String.fromCharCode(65 + i)}`), factory: true,
    bare: true, padCost: 40, bayCost: 60, maxBays: 8,
    rd: { buildFactor: 0.5, costFactor: 0.75, padTurn: 1, failClosed: 5, learning: 1.5 },
    price: { buy: 220 }, noDests: ['polar', 'sso'], catchDiscount: 0.85, blurb: 'Bare land: build every pad, tower, hangar, tank and plant. Catch vehicles build 15% cheaper and faster.',
  },
  vermilion: {
    name: 'Vermilion Parish', short: 'Vermilion', letter: 'L', lat: 29.6, lon: -92.3, pads: Array.from({ length: 24 }, (_, i) => `Gulf Pad ${i + 1}`), factory: false,
    bare: true, padCost: 25, bayCost: 50, maxBays: 12, gas: true, requires: 'boca',
    price: { buy: 100 }, noDests: ['polar', 'sso'], blurb: 'Bare Louisiana land with room for dozens of pads and a natural gas supply (cheap methalox). No factory.',
  },
};
export const SITE_IDS = Object.keys(SITES);
// Days for a customer's payload to reach a launch site (GDD 2.14).
export const SHIP_DAYS = {
  na: { cape: 2, vandenberg: 2, boca: 2, vermilion: 2 },
  eu: { cape: 6, vandenberg: 7, boca: 6, vermilion: 6 },
  apac: { cape: 9, vandenberg: 6, boca: 9, vermilion: 10 },
  sa: { cape: 5, vandenberg: 6, boca: 4, vermilion: 4 },
  af: { cape: 8, vandenberg: 9, boca: 8, vermilion: 7 },
  mar: { cape: 3, vandenberg: 3, boca: 3, vermilion: 2 },
};
// Days for a Skylink batch to reach each launch site from the plant at Cape Canaveral (GDD 2.22).
export const SAT_SHIP_DAYS = { cape: 0, boca: 2, vermilion: 2, vandenberg: 3 };
// Core Life research (GDD 2.24): the best owned tier sets the rating and scales the per-flight wear risk of Peregrine cores.
export const CORE_LIFE = [{ tech: 'life3', life: 50, wear: 0.3 }, { tech: 'life2', life: 35, wear: 0.4 }, { tech: 'life1', life: 20, wear: 0.6 }];
export const CORE_LIFE_TYPES = ['peregrine9', 'peregrineHeavy'];
// Days to ship a hull between launch sites, and the cost as a share of its build cost (GDD 2.24).
export const HULL_MOVE_DAYS = {
  cape: { vermilion: 4, boca: 5, vandenberg: 7 },
  vermilion: { boca: 2, vandenberg: 6 },
  boca: { vandenberg: 6 },
};
export const HULL_MOVE_COST = 0.02;
export const HULL_MOVE_MIN = 0.2;
export const LEASE_FEE = 0.15; // $M per launch from a leased site
export const BAY_FEE = 0.08; // $M per refit in a rented hangar
export const BAY_RENT_DEPOSIT = 3; // $M to rent another hangar at a leased site
export const BAY_BUY_COST = 15; // $M per owned hangar
export const MAX_BAYS = { leased: 2, owned: 3 };
export const PAD_COSTS = [0, 25, 40]; // $M for a site's 1st (included), 2nd and 3rd pad
export const TOWER_COST = 40; // $M per pad
export const PAD_TURN = 2; // days before a pad can launch again
export const PAD_FAIL_CLOSED = 14; // days a pad is closed after a failure (28 for tower-catch vehicles)
export const LINE_COSTS = [0, 40, 80, 120]; // $M to add the 1st (free) .. 4th factory line
export const CANCEL_REFUND = 0.5;

export const DRONESHIP_FEE = 0.3; // $M per landing
export const DRONESHIP_COST = 20; // $M to buy another
export const MAX_DRONESHIPS = 3;
export const DRONESHIP_CYCLE = 4; // days before a droneship can take another landing
export const DRONE_TOW_DAYS = 2; // extra days before a droneship-landed booster can start its refit
export const RTLS_PAYLOAD_PENALTY = 0.2;
export const EXPEND_BONUS = 0.15;
export const RECOVERY_MODES = {
  rtls: { name: 'RTLS', hint: 'Return to the pad: -20% payload, the booster is back at once.' },
  drone: { name: 'Droneship', hint: `Full payload, but it needs a free droneship and the refit starts ${DRONE_TOW_DAYS} days late.` },
  expend: { name: 'Expend', hint: `+${EXPEND_BONUS * 100}% payload, but the booster is lost. No refit.` },
};

// Commodities: base price in $M per tonne. Spot prices drift (see MARKET_*).
export const COMMODITIES = {
  kerolox: { name: 'RP-1 (kerosene)', price: 0.0246 },
  methalox: { name: 'Methane (CH4)', price: 0.0129 },
  lox: { name: 'Liquid oxygen', price: 0.0015 },
  steel: { name: 'Stainless steel', price: 0.012 },
  aluminum: { name: 'Aluminum-lithium', price: 0.035, vol: 0.2 },
};
export const MARKET_MIN = 0.6;
export const MARKET_MAX = 1.8;
export const BULK_DISCOUNT = 0.9; // buying into tanks beats spot by 10%
export const RUSH_PREMIUM = 1.1; // shortages at launch or build time cost 10% over spot
// A vehicle's propellant (its fuel type) is split into the fuel itself and oxygen from the shared LOX tank.
export const PROP_MIX = { kerolox: 0.28, methalox: 0.22 }; // fuel share by mass
export const START_CAPS = { kerolox: 60, methalox: 110, lox: 500, steel: 400, aluminum: 150 };
export const START_STOCK = { kerolox: 28, methalox: 44, lox: 230, steel: 150, aluminum: 100 };
export const TANK_STEP = { kerolox: { t: 56, cost: 2 }, methalox: { t: 110, cost: 3 }, lox: { t: 200, cost: 3 }, steel: { t: 400, cost: 4 }, aluminum: { t: 100, cost: 3 } };
export const PLANT_RATE = { kerolox: 11, methalox: 9, lox: 30 }; // t per day per level
export const PLANT_COST = 25; // $M per level
export const GAS_PLANT_DISCOUNT = 0.5; // production cost multiplier for a methalox plant level backed by a gas well
export const WELL_COST = 20; // $M per gas well
export const MAX_WELLS = 3;
export const PLANT_MAX = 3;
export const PLANT_COST_FRAC = 0.3; // production cost as a share of the base price

export const BEHEMOTH_LEARNING = 0.03; // risk drop per successful Behemoth flight
export const BEHEMOTH_MIN_RISK = 0.04;

// LEO propellant depot (GDD 2.3)
export const DEPOT_COST = 15; // $M hardware
export const DEPOT_CAP = 500; // t of CH4/LOX
export const TANKER_LOAD = 100; // t delivered per tanker run
export const BOILOFF_PER_DAY = 0.004;
export const TLI_PROP_PER_TON = 3; // t of propellant per t of lunar payload (surface sites)

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
  marsOrbit: { name: 'Mars Orbit', body: 'mars', kind: 'orbit', days: 180, prop: 5, locked: 'marsTransit', ring: { r: 1.3, incl: 45, node: 0, phase: 50 } },
  jezero: { name: 'Jezero Crater', body: 'mars', kind: 'site', days: 180, prop: 5, locked: 'marsTransit', lat: 18.4, lon: 77.5 },
  utopia: { name: 'Utopia Planitia', body: 'mars', kind: 'site', days: 180, prop: 5, locked: 'marsTransit', lat: 46, lon: 118 },
};
export const EARTH_ORBITS = ['leo', 'polar', 'sso', 'gto'];
export const LUNAR_DESTS = ['llo', 'shackleton', 'tranq', 'procellarum'];
export const SAT_DESTS = ['leo', 'polar']; // Skylink shells
export const BODIES = {
  earth: { name: 'Earth' },
  moon: { name: 'Moon' },
  mars: { name: 'Mars' },
};

// Satellite generations (GDD 2.20). capacity: thousands of broadband subscribers each. only: vehicles that can carry them.
export const SATS = {
  1: { name: 'Gen-1', mass: 0.27, volume: 0.9, cost: 0.35, capacity: 0.3, life: 5 * 365, tech: 'gen1' },
  2: { name: 'Gen-2 Mini', mass: 0.8, volume: 1.8, cost: 0.7, capacity: 1.2, life: 5 * 365, tech: 'gen2' },
  3: { name: 'Gen-3', mass: 2.0, volume: 3.5, cost: 2, capacity: 5, life: 7 * 365, tech: 'gen3', only: ['skyship'] },
};
// The satellite plant builds one batch of six at a time (GDD 2.23): days per batch by generation.
export const SAT_BATCH_DAYS = { 1: 1, 2: 2, 3: 3 };
export const SAT_QUEUE_MAX = 30;
export const OVERHEAD_PER_DAY = 0.12; // $M payroll and facilities
export const CASH_FLOOR = 5; // $M overhead never drains cash below this

// Customer regions for contracts and shipping. Skylink sells in MARKETS, not regions.
export const REGIONS = [
  { id: 'na', name: 'North America' },
  { id: 'eu', name: 'Europe' },
  { id: 'apac', name: 'Asia-Pacific' },
  { id: 'sa', name: 'South America' },
  { id: 'af', name: 'Africa' },
  { id: 'mar', name: 'Maritime & Air' },
];

// Skylink markets (GDD 2.19). minSats: constellation density to apply. license: $M. lead: days of approval.
// subs: thousands of subscribers at saturation. arpu: $ per subscriber per month.
export const MARKETS = [
  { id: 'us', name: 'United States', minSats: 12, license: 3, lead: 10, subs: 36, arpu: 110 },
  { id: 'camx', name: 'Canada & Mexico', minSats: 24, license: 4, lead: 20, subs: 8, arpu: 95 },
  { id: 'mar', name: 'Maritime & Aviation', minSats: 60, license: 10, lead: 90, subs: 6, arpu: 300 },
  { id: 'eu', name: 'European Union', minSats: 70, license: 25, lead: 120, subs: 26, arpu: 100 },
  { id: 'uk', name: 'United Kingdom', minSats: 70, license: 8, lead: 60, subs: 7, arpu: 110 },
  { id: 'anz', name: 'Australia & NZ', minSats: 80, license: 6, lead: 60, subs: 6, arpu: 105 },
  { id: 'latam', name: 'Latin America', minSats: 80, license: 12, lead: 90, subs: 14, arpu: 60 },
  { id: 'af', name: 'Africa', minSats: 90, license: 14, lead: 150, subs: 24, arpu: 30 },
  { id: 'jpkr', name: 'Japan & Korea', minSats: 100, license: 15, lead: 120, subs: 14, arpu: 95 },
  { id: 'in', name: 'India', minSats: 110, license: 20, lead: 240, subs: 12, arpu: 25 },
  { id: 'sea', name: 'Southeast Asia', minSats: 120, license: 10, lead: 150, subs: 10, arpu: 40 },
  // Mobile carriers: light subscribers (load), counted against Gen-2 and newer satellites only.
  { id: 'cell-us', cell: true, name: 'US mobile carriers', minSats: 30, license: 15, lead: 60, subs: 300, arpu: 8, load: 0.04 },
  { id: 'cell-eu', cell: true, name: 'EU mobile carriers', minSats: 40, license: 30, lead: 150, subs: 260, arpu: 9, load: 0.04 },
  { id: 'cell-uk', cell: true, name: 'UK mobile carriers', minSats: 40, license: 10, lead: 90, subs: 60, arpu: 9, load: 0.04 },
  { id: 'cell-anz', cell: true, name: 'Australia & NZ carriers', minSats: 40, license: 8, lead: 60, subs: 50, arpu: 9, load: 0.04 },
  { id: 'cell-jpkr', cell: true, name: 'Japan & Korea carriers', minSats: 60, license: 20, lead: 150, subs: 150, arpu: 8, load: 0.04 },
  { id: 'cell-latam', cell: true, name: 'Latin America carriers', minSats: 50, license: 15, lead: 120, subs: 180, arpu: 4, load: 0.04 },
  { id: 'cell-af', cell: true, name: 'Africa carriers', minSats: 60, license: 12, lead: 150, subs: 120, arpu: 3, load: 0.04 },
  { id: 'cell-in', cell: true, name: 'India carriers', minSats: 80, license: 20, lead: 300, subs: 240, arpu: 2, load: 0.04 },
];
export const SUB_GROWTH = 0.05; // share of the gap to the demand ceiling closed per day
export const CHURN = 0.03; // daily subscriber loss per point of congestion
export const PLANS = {
  budget: { name: 'Budget', price: 0.7, demand: 1.5, hint: 'Cheap: fills the network quickly, so only run it with spare capacity.' },
  standard: { name: 'Standard', price: 1, demand: 1, hint: 'The balanced plan.' },
  premium: { name: 'Premium', price: 1.4, demand: 0.6, hint: 'Fewer subscribers, each paying more. Good for a thin constellation.' },
};

export const CUSTOMERS = ['Aurora Telecom', 'Helix Earth Obs', 'Kestrel Defense', 'Meridian Labs', 'Polaris Comms', 'Tern Weather', 'Vela Science', 'Orion Media'];

export const TECH = [
  { id: 'landing', name: 'Booster Landing', cost: 30, era: 'Peregrine', desc: 'Boosters land and fly again (RTLS). Needs a test flight.', requires: [] },
  { id: 'droneship', name: 'Droneship Recovery', cost: 40, era: 'Peregrine', desc: 'Ocean landings at full payload. Needs a test flight.', requires: ['landing'] },
  { id: 'fastCores', name: 'Rapid Reflight', cost: 25, era: 'Peregrine', desc: 'Peregrine turnaround -2 days', requires: ['landing'] },
  { id: 'life1', name: 'Core Life I', cost: 45, era: 'Peregrine', desc: 'Peregrine cores rated for 20 flights, with 40% less wear risk per flight', requires: ['fastCores'] },
  { id: 'life2', name: 'Core Life II', cost: 140, era: 'Peregrine', desc: 'Peregrine cores rated for 35 flights, with 60% less wear risk per flight', requires: ['life1', 'heavyCores'] },
  { id: 'life3', name: 'Core Life III', cost: 350, era: 'Super-Heavy', desc: 'Peregrine cores rated for 50 flights, with 70% less wear risk per flight', requires: ['life2', 'skyship'] },
  { id: 'plants', name: 'Propellant Plants', cost: 70, era: 'Peregrine', desc: 'Owned sites can build kerolox and methalox plants', requires: ['fastCores'] },
  { id: 'gen1', name: 'Skylink Gen-1', cost: 5, era: 'Peregrine', desc: 'Unlock broadband satellite batches', requires: [] },
  { id: 'gen2', name: 'Skylink Gen-2', cost: 60, era: 'Peregrine', desc: 'Gen-2 Mini satellites (1.2k subscribers each)', requires: ['fastCores', 'gen1'] },
  { id: 'dtc', name: 'Direct-to-Cell', cost: 80, era: 'Peregrine', desc: 'Mobile carrier markets: license Skylink phone service. Needs Gen-2.', requires: ['gen2'] },
  { id: 'heavyCores', name: 'Peregrine Heavy', cost: 60, era: 'Peregrine', desc: 'Unlock 64 t Peregrine Heavy. Needs a test flight.', requires: ['fastCores'] },
  { id: 'gen3', name: 'Skylink Gen-3', cost: 300, era: 'Super-Heavy', desc: 'Full-size 5k-subscriber satellites. Skyship only.', requires: ['skyship', 'gen2'] },
  { id: 'hull', name: 'Stainless Hull', cost: 120, era: 'Super-Heavy', desc: 'Needed for the Behemoth Prototype. Needs a test flight.', requires: ['heavyCores', 'gen1'] },
  { id: 'raptor', name: 'Harrier V3', cost: 150, era: 'Super-Heavy', desc: 'Needed for the Behemoth Prototype. Needs a test flight.', requires: ['heavyCores', 'gen1'] },
  { id: 'tiles', name: 'Heat Shield Tiles', cost: 140, era: 'Super-Heavy', desc: 'Needed for the Behemoth Prototype. Needs a test flight.', requires: ['heavyCores', 'gen1'] },
  {
    id: 'skyship', name: 'Operational Skyship', cost: 400, era: 'Super-Heavy',
    desc: 'Rapid-turnaround 150 t Skyship. Qualify it with 3 successful Behemoth flights.',
    requires: ['hull', 'raptor', 'tiles'], flights: { rocket: 'behemoth', n: 3 },
  },
  { id: 'tanker', name: 'Orbital Tanker', cost: 600, era: 'Lunar', desc: 'Skyship depot and tanker missions, and lunar contracts. Needs a test flight.', requires: ['skyship'] },
  { id: 'habitat', name: 'Moon Habitat Core', cost: 900, era: 'Lunar', desc: 'Habitat, reactor and drone bay module ships', requires: ['skyship'] },
  { id: 'isru', name: 'Lunar ISRU Mining', cost: 1200, era: 'Lunar', desc: 'Smelter and Fabricator module ships', requires: ['skyship'] },
  { id: 'ice', name: 'Lunar Ice Mining', cost: 700, era: 'Lunar', desc: 'Ice miners and refineries at Shackleton make lunar methalox', requires: ['isru'] },
  { id: 'marsTransit', name: 'Mars Transfer Vehicle', cost: 2000, era: 'Mars', desc: 'Mars orbit and landing sites, Mars contracts and launch windows', requires: ['ice', 'habitat'] },
];

// Techs that are finished by flying a prototype (GDD 2.12). Funding the research moves the tech to "testing":
// build a test article in a factory (cost $M, days, t of metal), then fly it. odds is the first attempt's chance,
// and every failure adds ODDS_LEARNING to the next one.
export const PROTOS = {
  landing: { name: 'Landing test article', cost: 3, days: 6, metal: 'aluminum', t: 20, odds: 0.5, ops: 0.5 },
  droneship: { name: 'Ocean landing article', cost: 4, days: 8, metal: 'aluminum', t: 25, odds: 0.55, ops: 0.6 },
  heavyCores: { name: 'Heavy test article', cost: 9, days: 14, metal: 'aluminum', t: 60, odds: 0.6, ops: 1.2 },
  hull: { name: 'Hull test article', cost: 14, days: 12, metal: 'steel', t: 120, odds: 0.5, ops: 2 },
  raptor: { name: 'Engine test article', cost: 18, days: 14, metal: 'steel', t: 100, odds: 0.45, ops: 2.5 },
  tiles: { name: 'Re-entry test article', cost: 16, days: 12, metal: 'steel', t: 100, odds: 0.5, ops: 2 },
  tanker: { name: 'Transfer demo article', cost: 22, days: 14, metal: 'steel', t: 150, odds: 0.6, ops: 3 },
};
export const ODDS_LEARNING = 0.12;
export const ODDS_MAX = 0.9;
export const RD_DEFAULT = { buildFactor: 1, costFactor: 1, padTurn: 2, failClosed: 14, learning: 1 }; // prototype work at an ordinary site

// ---- Lunar base (GDD 2.8) ----------------------------------------------------
// len: tiles along the tube. power: MW (positive makes power). need: crew to run it. cover: tonnes of regolith to bury it.
export const MODULES = {
  habitat: { name: 'Habitat', len: 5, power: -0.15, need: 0, crew: 6, cover: 30, color: 0xdfe6f2, blurb: 'Houses 6 crew.' },
  reactor: { name: 'Reactor', len: 4, power: 1.0, need: 0, cover: 30, color: 0xf0a35a, blurb: 'Fission power: 1.0 MW.' },
  drones: { name: 'Drone Bay', len: 3, power: -0.2, need: 1, drones: 4, cover: 20, color: 0x8fd18f, blurb: 'Houses 4 construction drones.' },
  smelter: { name: 'Smelter', len: 5, power: -0.5, need: 2, cover: 30, color: 0x9fb0c8, blurb: 'Makes oxygen, iron and silica from regolith.' },
  fab: { name: 'Fabricator', len: 5, power: -0.3, need: 2, cover: 30, color: 0xe8d36a, blurb: 'Builds modules and Skyships from local materials.' },
  icer: { name: 'Ice Miner', len: 4, power: -0.4, need: 2, cover: 30, color: 0x7fd0ff, blurb: 'Drills ice. Only works at Shackleton.' },
  refinery: { name: 'Refinery', len: 5, power: -0.6, need: 2, cover: 30, color: 0x6fd6b0, blurb: 'Turns ice into lunar methalox.' },
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
export const ICE_RATE = 1.2; // t of ice per day per miner at full output (Shackleton only)
export const REFINERY_ICE = 3; // t of ice a refinery eats per day
export const REFINERY_OUT = 2; // t of methalox it makes from that
export const BASE_CAPS = { ice: 300, methalox: 600 };
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
  // A hull built on the Moon joins the fleet based at the Moon, and can only fly from there.
  skyship: { iron: 300, silica: 150, oxygen: 50, cash: 35, days: 30, ship: 'skyship', name: 'Skyship hull' },
};

// ---- Mars (GDD 2.9) ----------------------------------------------------------------------------
// The planets line up for `length` days every `period` days, first at day `first`. No flight can launch outside it.
// Calendar (GDD 2.11): day 1 is 1 January 2010.
export const START_DATE = Date.UTC(2010, 0, 1);
const D = (y, m, d) => Math.round((Date.UTC(y, m - 1, d) - START_DATE) / 86400000) + 1;
// Real Earth to Mars launch windows [open day, close day], then predicted ones from the 779.94-day synodic period.
export const MARS_WINDOWS = (() => {
  const w = [
    [D(2011, 11, 25), D(2011, 12, 18)], [D(2013, 11, 18), D(2013, 12, 7)], [D(2016, 3, 4), D(2016, 3, 25)],
    [D(2018, 5, 5), D(2018, 6, 8)], [D(2020, 7, 17), D(2020, 8, 15)],
  ];
  for (let i = 1; i <= 10; i++) { const o = Math.round(D(2020, 7, 17) + 779.94 * i); w.push([o, o + 30]); }
  return w;
})();
// ascentRisk is added to the launch failure chance, landRisk is rolled when the ship arrives at Mars.
export const MARS_ROUTES = {
  direct: { name: 'Direct from Earth', ascentRisk: 0.12, landRisk: 0.15, days: 180 },
  moon: { name: 'From the Moon', ascentRisk: 0, landRisk: 0.06, days: 175, fuelPerTon: 4, hullFuel: 450 },
};
export const MARS_DESTS = ['marsOrbit', 'jezero', 'utopia'];
export const MARS_SITES = ['jezero', 'utopia'];
// Every successful Mars landing teaches the company something: the direct and Moon-route risks fall (GDD 2.17).
export const MARS_LEARNING = { ascent: 0.015, land: 0.02, moonLand: 0.01, minAscent: 0.03, minLand: 0.05, minMoonLand: 0.03 };

// Return flights (GDD 2.17): a Mars-based Skyship flies home on the base's methalox.
export const MARS_RETURN = { name: 'Home from Mars', ascentRisk: 0.08, landRisk: 0.04, days: 200, fuelPerTon: 5, hullFuel: 500, refit: 15 };
// Mars to Earth windows open about 60 days before each Earth to Mars window and last 30 days.
export const MARS_RETURN_WINDOWS = MARS_WINDOWS.map(([open]) => [open - 60, open - 31]);
export const MARS_RETURN_CONTRACT = { chance: 0.12, mass: [10, 60], rate: [3, 4], base: [20, 40], expires: 300 };

// What differs between the Moon base and the Mars base (GDD 2.8, 2.17).
export const BASE_PARAMS = {
  moon: { iceSites: ['shackleton'], refineryOut: 2, caps: { ice: 300, methalox: 600 }, storms: false },
  mars: { iceSites: ['utopia'], refineryOut: 4, caps: { ice: 400, methalox: 1500 }, storms: true },
};
export const STORM_CHANCE = 1 / 90;
export const STORM_DAYS = [12, 30];
export const STORM_WORK = 0.5;
export const MARS_CONTRACT = { chance: 0.15, mass: [30, 100], rate: [2.6, 3.4], base: [15, 30], expires: 200 };
