// Lunar base simulation (GDD 2.8). Pure functions: no Phaser or Three, so it runs under plain node.
import {
  MODULES, BASE_W, BASE_H, DUCT_COST, DUCT_MAX, DRONE_RATE, SMELTER_REGOLITH, SMELTER_OUT, STOCK_PRICES,
  STOCK_KEEP, SPE_CHANCE, CREW_DEATH_COST, CREW_REPLACE_COST, DRONE_POLICIES, LOCAL_RECIPES, CASH_FLOOR,
  ICE_RATE, REFINERY_ICE, REFINERY_OUT, BASE_CAPS,
} from './data.js';

export function createBase(site) {
  return {
    site,
    modules: [],
    ducts: [],
    pending: [], // delivered or locally built modules waiting to be placed
    fabQueue: [],
    stock: { regolith: 0, oxygen: 0, iron: 0, silica: 0, ice: 0, methalox: 0 },
    ships: [], // Skyship hulls the Fabricator has finished, handed to the fleet by the main sim
    policy: 'balanced',
    dug: 0, // total regolith dug, drives the pits drawn on the surface
    nextId: 1,
    lastSpe: null,
  };
}

// ---- geometry ------------------------------------------------------------------

export function tilesOf(type, x, y, rot) {
  const len = MODULES[type].len;
  return Array.from({ length: len }, (_, i) => (rot ? { x, y: y + i } : { x: x + i, y }));
}

export const moduleTiles = (m) => tilesOf(m.type, m.x, m.y, m.rot);

export function canPlace(base, type, x, y, rot) {
  const taken = new Set(base.modules.flatMap((m) => moduleTiles(m).map((t) => `${t.x},${t.y}`)));
  return tilesOf(type, x, y, rot).every((t) => t.x >= 0 && t.y >= 0 && t.x < BASE_W && t.y < BASE_H && !taken.has(`${t.x},${t.y}`));
}

// Each module has a port at each end: index 0 and the last tile.
export function portTile(m, end) {
  const tiles = moduleTiles(m);
  return end === 0 ? tiles[0] : tiles[tiles.length - 1];
}

export const portId = (m, end) => `${m.id}:${end}`;

export function findPort(base, id) {
  const [mid, end] = id.split(':').map(Number);
  const m = base.modules.find((x) => x.id === mid);
  return m ? { module: m, end, tile: portTile(m, end) } : null;
}

export const portUsed = (base, id) => base.ducts.some((d) => d.a === id || d.b === id);

// ---- placing and connecting --------------------------------------------------------------

export function placeModule(base, pendingId, x, y, rot) {
  const i = base.pending.findIndex((p) => p.id === pendingId);
  if (i < 0) return false;
  const { type } = base.pending[i];
  if (!canPlace(base, type, x, y, rot ? 1 : 0)) return false;
  base.pending.splice(i, 1);
  base.modules.push({ id: base.nextId++, type, x, y, rot: rot ? 1 : 0, cover: 0, crew: MODULES[type].crew ?? 0 });
  return true;
}

export function ductBlocker(base, a, b) {
  const pa = findPort(base, a);
  const pb = findPort(base, b);
  if (!pa || !pb) return 'Pick two ports';
  if (pa.module === pb.module) return 'A duct joins two different modules';
  if (portUsed(base, a) || portUsed(base, b)) return 'That port already has a duct';
  const dist = Math.abs(pa.tile.x - pb.tile.x) + Math.abs(pa.tile.y - pb.tile.y);
  if (dist > DUCT_MAX) return `Ducts reach ${DUCT_MAX} tiles`;
  return null;
}

export function connect(base, a, b) {
  if (ductBlocker(base, a, b)) return false;
  base.ducts.push({ id: base.nextId++, a, b });
  return true;
}

// ---- networks -------------------------------------------------------------------------------

// Connected groups of modules, with their power and crew balance.
export function analyze(base) {
  const parent = new Map(base.modules.map((m) => [m.id, m.id]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const d of base.ducts) {
    const pa = findPort(base, d.a);
    const pb = findPort(base, d.b);
    if (pa && pb) parent.set(find(pa.module.id), find(pb.module.id));
  }
  const groups = new Map();
  for (const m of base.modules) {
    const root = find(m.id);
    if (!groups.has(root)) groups.set(root, { mods: [], supply: 0, demand: 0, crewHave: 0, crewNeed: 0 });
    const g = groups.get(root);
    const def = MODULES[m.type];
    g.mods.push(m);
    if (def.power > 0) g.supply += def.power; else g.demand -= def.power;
    g.crewHave += m.crew ?? 0;
    g.crewNeed += def.need;
  }
  const byModule = new Map();
  const nets = [...groups.values()];
  for (const g of nets) {
    g.powerFactor = g.supply <= 0 ? 0 : g.demand <= 0 ? 1 : Math.min(1, g.supply / g.demand);
    g.staffFactor = g.crewNeed <= 0 ? 1 : Math.min(1, g.crewHave / g.crewNeed);
    g.work = Math.min(g.powerFactor, g.staffFactor); // how well machines in this network run
    for (const m of g.mods) byModule.set(m.id, g);
  }
  return { nets, byModule };
}

export function baseStatus(base) {
  const { nets } = analyze(base);
  const sum = (f) => nets.reduce((n, g) => n + f(g), 0);
  return {
    supply: sum((g) => g.supply),
    demand: sum((g) => g.demand),
    crew: base.modules.reduce((n, m) => n + (m.crew ?? 0), 0),
    drones: base.modules.reduce((n, m) => n + (MODULES[m.type].drones ?? 0), 0),
    networks: nets.length,
    unpowered: nets.filter((g) => g.powerFactor === 0).reduce((n, g) => n + g.mods.length, 0),
  };
}

// ---- stockpile and local construction ------------------------------------------------------------

export function sellSurplus(s) {
  const base = s.base;
  let total = 0;
  for (const [res, price] of Object.entries(STOCK_PRICES)) {
    const extra = Math.max(0, base.stock[res] - STOCK_KEEP[res]);
    base.stock[res] -= extra;
    total += extra * price;
  }
  total = +total.toFixed(1);
  s.cash += total;
  return total;
}

export function recipeBlocker(s, type) {
  const base = s.base;
  const r = LOCAL_RECIPES[type];
  if (!base || !r) return 'No recipe';
  if (!base.modules.some((m) => m.type === 'fab')) return 'Needs a Fabricator';
  for (const res of ['iron', 'silica', 'oxygen']) if (base.stock[res] < r[res]) return `Needs ${r[res]} t ${res}`;
  if (s.cash - r.cash < CASH_FLOOR) return 'Not enough cash for components';
  return null;
}

export function queueLocalBuild(s, type, note) {
  if (recipeBlocker(s, type)) return false;
  const r = LOCAL_RECIPES[type];
  for (const res of ['iron', 'silica', 'oxygen']) s.base.stock[res] -= r[res];
  s.cash -= r.cash;
  s.base.fabQueue.push({ id: s.base.nextId++, type, daysLeft: r.days, total: r.days });
  note?.(`Fabricator started a ${r.name ?? MODULES[type].name} (-$${r.cash}M of components).`);
  return true;
}

// ---- daily tick ---------------------------------------------------------------------------------------

export function tickBase(s, note) {
  const base = s.base;
  if (!base) return;
  const { byModule } = analyze(base);
  const mods = base.modules;

  // Life support: habitats without power lose crew.
  for (const m of mods) {
    if (m.type !== 'habitat' || !m.crew) continue;
    if (byModule.get(m.id).powerFactor === 0 && s.day % 3 === 0) {
      m.crew--;
      s.cash = Math.max(0, s.cash - CREW_DEATH_COST);
      note?.(`A habitat has no power: a crew member died (-$${CREW_DEATH_COST}M).`);
    }
  }

  // Drones dig regolith and bury modules.
  const policy = DRONE_POLICIES[base.policy] ?? DRONE_POLICIES.balanced;
  let effort = 0;
  for (const m of mods) {
    if (m.type === 'drones') effort += MODULES.drones.drones * DRONE_RATE * byModule.get(m.id).work;
  }
  const dig = effort * policy.dig;
  base.stock.regolith += dig;
  base.dug += dig;
  let place = Math.min(effort * policy.place, base.stock.regolith);
  const order = [...mods].filter((m) => m.cover < 1).sort((a, b) => (b.type === 'habitat') - (a.type === 'habitat') || a.cover - b.cover);
  for (const m of order) {
    if (place <= 0) break;
    const need = MODULES[m.type].cover * (1 - m.cover);
    const u = Math.min(place, need);
    m.cover = Math.min(1, m.cover + u / MODULES[m.type].cover);
    base.stock.regolith -= u;
    place -= u;
  }

  // Smelters turn regolith into oxygen, iron and silica.
  for (const m of mods) {
    if (m.type !== 'smelter') continue;
    const w = byModule.get(m.id).work;
    const want = SMELTER_REGOLITH * w;
    const used = Math.min(want, base.stock.regolith);
    const eff = want > 0 ? w * (used / want) : 0;
    base.stock.regolith -= used;
    for (const [res, rate] of Object.entries(SMELTER_OUT)) base.stock[res] += rate * eff;
  }

  // Ice miners drill at Shackleton, refineries turn the ice into lunar methalox.
  if (base.site === 'shackleton') {
    for (const m of mods) {
      if (m.type !== 'icer') continue;
      base.stock.ice = Math.min(BASE_CAPS.ice, base.stock.ice + ICE_RATE * byModule.get(m.id).work);
    }
  }
  for (const m of mods) {
    if (m.type !== 'refinery') continue;
    const w = byModule.get(m.id).work;
    const room = (BASE_CAPS.methalox - base.stock.methalox) * (REFINERY_ICE / REFINERY_OUT);
    const use = Math.min(REFINERY_ICE * w, base.stock.ice, Math.max(0, room));
    base.stock.ice -= use;
    base.stock.methalox += use * (REFINERY_OUT / REFINERY_ICE);
  }

  // Fabricators work through the local build queue.
  const fabs = mods.filter((m) => m.type === 'fab');
  base.fabQueue.slice(0, fabs.length).forEach((q, i) => { q.daysLeft -= byModule.get(fabs[i].id).work; });
  for (const q of base.fabQueue.filter((x) => x.daysLeft <= 0)) {
    const recipe = LOCAL_RECIPES[q.type];
    if (recipe.ship) {
      base.ships.push({ id: base.nextId++, type: recipe.ship });
    } else {
      base.pending.push({ id: base.nextId++, type: q.type });
      note?.(`Fabricator finished a ${MODULES[q.type].name}: ready to place.`);
    }
  }
  base.fabQueue = base.fabQueue.filter((q) => q.daysLeft > 0);

  // Solar particle events: unburied habitats lose crew.
  if (Math.random() < SPE_CHANCE) {
    const severity = 0.3 + Math.random() * 0.7;
    let dead = 0;
    for (const m of mods) {
      if (m.type !== 'habitat') continue;
      const risk = severity * 0.6 * (1 - m.cover) ** 2;
      for (let i = m.crew; i > 0; i--) if (Math.random() < risk) { m.crew--; dead++; }
    }
    base.lastSpe = { day: s.day, severity, dead };
    if (dead) {
      s.cash = Math.max(0, s.cash - dead * CREW_DEATH_COST);
      note?.(`Solar storm: ${dead} crew lost (-$${dead * CREW_DEATH_COST}M). Bury the habitats.`);
    } else if (mods.some((m) => m.type === 'habitat')) {
      note?.('Solar storm: the crew sheltered safely.');
    }
  }

  // Replace crew, one per powered habitat per day.
  for (const m of mods) {
    if (m.type === 'habitat' && m.crew < MODULES.habitat.crew && byModule.get(m.id).powerFactor > 0 && s.cash - CREW_REPLACE_COST >= CASH_FLOOR) {
      m.crew++;
      s.cash -= CREW_REPLACE_COST;
    }
  }
}

export { DUCT_COST };
