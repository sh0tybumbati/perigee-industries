// Static game data, taken from GDD sections 2.1-2.2 and 3.

export const ROCKETS = {
  peregrine9: { name: 'Peregrine 9', payload: 22, volume: 60, turnaround: 7, refurb: 0.4, ops: 0.8, sats: 24 },
  peregrineHeavy: { name: 'Peregrine Heavy', payload: 64, volume: 140, turnaround: 14, refurb: 1.2, ops: 2.5, sats: 24, requires: 'heavyCores' },
};

export const RTLS_PAYLOAD_PENALTY = 0.2;
export const RTLS_TURNAROUND_SAVED = 2;
export const DRONESHIP_FEE = 0.3; // $M per launch
export const CORE_LIFE = 10; // launches before a core must be decommissioned
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
  { id: 'hull', name: 'Stainless Hull', cost: 90, era: 'Super-Heavy', desc: 'Required for super-heavy', requires: ['heavyCores', 'gen1'] },
  { id: 'raptor', name: 'Harrier V3', cost: 110, era: 'Super-Heavy', desc: 'Required for super-heavy', requires: ['heavyCores', 'gen1'] },
  { id: 'tiles', name: 'Heat Shield Tiles', cost: 100, era: 'Super-Heavy', desc: 'Required for super-heavy', requires: ['heavyCores', 'gen1'] },
  { id: 'tanker', name: 'Orbital Tanker', cost: 200, era: 'Lunar', desc: 'Tanker runs (coming soon)', requires: ['hull', 'raptor', 'tiles'] },
  { id: 'habitat', name: 'Moon Habitat Core', cost: 260, era: 'Lunar', desc: 'Lunar base (coming soon)', requires: ['hull', 'raptor', 'tiles'] },
  { id: 'isru', name: 'Lunar ISRU Mining', cost: 320, era: 'Lunar', desc: 'Lunar base (coming soon)', requires: ['hull', 'raptor', 'tiles'] },
];
