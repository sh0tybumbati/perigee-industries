import Phaser from 'phaser';
import { BODIES, DESTINATIONS, REGIONS, DUCT_COST, SITES } from '../data.js';
import * as sim from '../sim.js';
import * as B from '../base.js';
import { MapLayer } from '../map/MapLayer.js';
import { BaseLayer } from '../map/BaseLayer.js';
import { COL, FONT, UI, hex } from '../ui/ui.js';
import { renderMission, renderFleet, renderFactory, renderSites, renderTech, renderSkylink, renderBase } from '../ui/dock.js';
import { Lane, renderFlights, renderDepotAndLog } from '../ui/bottom.js';

const SAVE_KEY = 'perigee-industries-save';
const MAP = { x: 10, y: 90, w: 690, h: 432 };
const DOCK = { x: 722, y: 98, w: 536 };
const TABS = [['mission', 'Mission'], ['fleet', 'Fleet'], ['factory', 'Factory'], ['sites', 'Sites'], ['base', 'Base'], ['tech', 'R&D'], ['skylink', 'Skylink']];
const TICK_MS = 2400;

export class OpsScene extends Phaser.Scene {
  constructor() {
    super('ops');
    this.speed = 1;
    this.tab = 'mission';
    this.lastTickAt = 0;
    this.baseView = 'closed'; // closed | zooming | open
    this.baseSub = 'control';
    this.factorySite = 'cape';
    this.siteView = null;
    this.baseMode = { kind: 'idle', rot: 0 };
  }

  create() {
    this.s = this.loadGame() ?? sim.createState();
    this.drawStars();
    this.drawFrame();
    this.map = new MapLayer(this, MAP, {
      getState: () => this.s,
      onSelect: (id) => this.act(() => this.selectDest(id)),
      onSite: (id) => this.act(() => this.pickSite(id)),
      setHint: (t) => this.hint.setText(t),
    });
    this.base = new BaseLayer(this, MAP, {
      getState: () => this.s,
      getMode: () => this.baseMode,
      onTile: (t, cancel) => this.act(() => this.baseTile(t, cancel)),
      onPort: (id) => this.act(() => this.basePort(id)),
      setHint: (t) => this.hint.setText(t),
    });
    this.input.mouse?.disableContextMenu();
    this.input.keyboard?.on('keydown-R', () => this.act(() => { if (this.baseMode.kind === 'place') this.baseMode.rot ^= 1; }));
    this.input.keyboard?.on('keydown-ESC', () => this.act(() => { this.baseMode = { kind: 'idle', rot: 0 }; }));
    this.lane = new Lane(this);
    this.ui = this.add.container(0, 0);
    this.hint = this.add.text(MAP.x + 10, MAP.y + MAP.h - 20, '', { fontFamily: FONT, fontSize: 12, color: hex(COL.accent), stroke: '#05070d', strokeThickness: 3 });
    this.uiHelper = new UI(this, this.ui, (fn) => this.act(fn), (t) => this.hint.setText(t));
    this.map.setBody(DESTINATIONS[this.s.dest].body);
    this.map.focus(this.s.dest);
    this.lastDest = this.s.dest;
    this.scheduleTick();
    this.render();
  }

  // ---- static decor ----------------------------------------------------
  drawStars() {
    const g = this.add.graphics();
    for (let i = 0; i < 160; i++) {
      g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.1, 0.6));
      g.fillRect(Phaser.Math.Between(0, 1280), Phaser.Math.Between(0, 720), 1.5, 1.5);
    }
  }

  drawFrame() {
    const g = this.add.graphics();
    const panels = [[10, 58, 690, 466], [710, 58, 560, 466], [10, 530, 690, 180], [710, 530, 560, 180]];
    for (const [x, y, w, h] of panels) {
      g.fillStyle(COL.panel, 0.92).fillRect(x, y, w, h);
      g.lineStyle(1, COL.line).strokeRect(x + 0.5, y + 0.5, w, h);
    }
    g.fillStyle(COL.panel, 0.95).fillRect(0, 0, 1280, 50);
    g.lineStyle(1, COL.line).lineBetween(0, 50, 1280, 50);
  }

  // ---- save / load ------------------------------------------------------
  loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? sim.deserialize(raw) : null;
    } catch {
      return null; // storage blocked or unavailable
    }
  }

  saveGame() {
    try {
      localStorage.setItem(SAVE_KEY, sim.serialize(this.s));
    } catch {
      // Storage full or blocked: the game still plays, it just won't persist.
    }
  }

  newGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing to clear */ }
    this.s = sim.createState();
    this.confirmNew = false;
    this.saveGame();
    this.map.lastTripId = 0;
    this.forceCloseBase();
    this.baseMode = { kind: 'idle', rot: 0 };
    this.syncMap(true);
  }

  // ---- time ------------------------------------------------------------
  scheduleTick() {
    this.tickEvent?.remove();
    if (!this.speed) return;
    this.lastTickAt = this.time.now;
    this.tickEvent = this.time.addEvent({
      delay: TICK_MS / this.speed, loop: true,
      callback: () => { sim.tick(this.s); this.lastTickAt = this.time.now; this.saveGame(); this.render(); },
    });
  }

  setSpeed(v) { this.speed = v; this.scheduleTick(); }

  dayFrac() {
    if (!this.speed) return 0;
    return Math.min(1, (this.time.now - this.lastTickAt) / (TICK_MS / this.speed));
  }

  // Runs a state change, saves, and re-renders on the next frame (so a clicked button is never destroyed mid-event).
  act(fn) {
    fn();
    this.syncMap();
    this.saveGame();
    this.time.delayedCall(0, () => this.render());
  }

  // Keep the map on the body of the selected destination.
  syncMap(force = false) {
    const body = DESTINATIONS[this.s.dest].body;
    if (force || this.lastDest !== this.s.dest) {
      this.forceCloseBase();
      this.lastDest = this.s.dest;
      this.map.setBody(body);
      this.map.focus(this.s.dest);
    }
  }

  update(time, delta) {
    this.map.update(delta, this.dayFrac());
    this.base.update(time);
    this.lane.update(this.s, this.dayFrac());
  }

  // ---- base view ------------------------------------------------------------
  openBase() {
    if (!this.s.base || this.baseView !== 'closed') return;
    this.baseView = 'zooming';
    this.tab = 'base';
    this.map.setBody('moon');
    this.map.zoomIn(this.s.base.site, () => {
      this.base.show();
      this.baseView = 'open';
      this.time.delayedCall(380, () => { if (this.baseView === 'open') this.map.setActive(false); });
      this.render();
    });
    this.render();
  }

  closeBase() {
    if (this.baseView !== 'open') return;
    this.baseMode = { kind: 'idle', rot: 0 };
    this.baseView = 'zooming';
    this.base.hide();
    this.map.setActive(true);
    this.map.zoomOut(() => { this.baseView = 'closed'; this.render(); });
    this.render();
  }

  forceCloseBase() {
    if (this.baseView === 'closed') return;
    this.base.hide(true);
    this.map.resetZoom();
    this.baseView = 'closed';
    this.baseMode = { kind: 'idle', rot: 0 };
  }

  baseTile(tile, cancel) {
    const m = this.baseMode;
    if (cancel) { this.baseMode = { kind: 'idle', rot: 0 }; return; }
    if (m.kind !== 'place' || !this.s.base) return;
    if (B.placeModule(this.s.base, m.pendingId, tile.x, tile.y, m.rot)) {
      this.baseMode = { kind: 'idle', rot: 0 };
    } else {
      this.hint.setText('Cannot place a module there: it overlaps another or leaves the grid.');
    }
  }

  basePort(id) {
    const s = this.s;
    const m = this.baseMode;
    if (m.kind !== 'duct') return;
    if (!m.ductFrom) { this.baseMode = { ...m, ductFrom: id }; return; }
    if (m.ductFrom === id) { this.baseMode = { ...m, ductFrom: null }; return; }
    const blocker = B.ductBlocker(s.base, m.ductFrom, id) ?? (sim.canSpend(s, DUCT_COST) ? null : 'Not enough cash for a duct');
    if (blocker) { this.hint.setText(blocker); this.baseMode = { ...m, ductFrom: null }; return; }
    B.connect(s.base, m.ductFrom, id);
    s.cash -= DUCT_COST;
    sim.note(s, `Duct connected (-$${DUCT_COST}M).`);
    this.baseMode = { ...m, ductFrom: null };
  }

  // ---- actions ------------------------------------------------------------
  pickSite(id) {
    if (sim.setSite(this.s, id)) { this.siteView = id; return; }
    this.siteView = id;
    this.tab = 'sites';
    this.hint.setText(`${SITES[id].name} is closed: lease or buy it in the Sites tab.`);
  }

  selectDest(id) {
    const s = this.s;
    if (!DESTINATIONS[id].locked || s.tech.has(DESTINATIONS[id].locked)) {
      sim.setDest(s, id);
      // Picking a destination means planning a payload flight, so leave tanker/depot duty.
      if (sim.rocketDef(s).role !== 'payload') {
        const pick = ['skyship', 'behemoth', 'peregrineHeavy', 'peregrine9'].find((t) => sim.readyVehicles(s, t).length) ?? 'peregrine9';
        sim.setRocket(s, pick);
      }
      this.lastDest = null; // force the map to follow
    } else {
      this.hint.setText(`${DESTINATIONS[id].name} is locked.`);
    }
  }

  get actions() {
    const s = this.s;
    return {
      pickRocket: (id) => sim.setRocket(s, id),
      toggleContract: (id) => {
        if (!sim.toggleContract(s, id)) this.hint.setText('One destination per launch: unload the others first.');
        this.lastDest = null;
      },
      cycleRegion: () => { s.region = REGIONS[(REGIONS.findIndex((r) => r.id === s.region) + 1) % REGIONS.length].id; },
      pickRegion: (id) => { s.region = id; },
      buyPad: () => sim.buyPad(s),
      buyLine: (id) => sim.buyLine(s, id),
      queueBuild: (id, siteId) => sim.queueBuild(s, id, siteId),
      cancelBuild: (siteId, id) => sim.cancelBuild(s, siteId, id),
      buyTech: (id) => sim.buyTech(s, id),
      queueTest: (id, siteId) => sim.queueTest(s, id, siteId),
      flyTest: (id) => { const r = sim.flyTest(s, id); if (r.ok && !r.success) this.cameras.main.shake(300, 0.006); },
      setMarsRoute: (route) => sim.setMarsRoute(s, route),
      viewSite: (id) => { this.siteView = id; if (s.sites[id].status !== 'locked') sim.setSite(s, id); },
      setSite: (id) => sim.setSite(s, id),
      acquireSite: (id, mode) => sim.acquireSite(s, id, mode),
      buyPad: (id) => sim.buyPad(s, id),
      buildTower: (id, i) => sim.buildTower(s, id, i),
      addBay: (id) => sim.addBay(s, id),
      buyCommodity: (id, type, amt) => sim.buyCommodity(s, id, type, amt),
      expandTank: (id, type) => sim.expandTank(s, id, type),
      buildPlant: (id, fuel) => sim.buildPlant(s, id, fuel),
      buyDroneship: () => sim.buyDroneship(s),
      factorySite: (id) => { this.factorySite = id; },
      openBase: () => this.openBase(),
      closeBase: () => this.closeBase(),
      baseSub: (id) => { this.baseSub = id; },
      setPolicy: (id) => { s.base.policy = id; },
      startPlace: (pendingId) => {
        if (this.baseView !== 'open') this.openBase();
        this.baseMode = { kind: 'place', pendingId, rot: this.baseMode.rot ?? 0 };
      },
      toggleDuct: () => {
        if (this.baseView !== 'open') this.openBase();
        this.baseMode = this.baseMode.kind === 'duct' ? { kind: 'idle', rot: 0 } : { kind: 'duct', rot: 0, ductFrom: null };
      },
      rotate: () => { if (this.baseMode.kind === 'place') this.baseMode.rot ^= 1; },
      sellSurplus: () => { const got = B.sellSurplus(s); sim.note(s, `Sold lunar materials for $${got}M.`); },
      queueLocal: (type) => B.queueLocalBuild(s, type, (m) => sim.note(s, m)),
      launch: () => {
        const res = sim.launch(s);
        if (res.ok && res.failed) this.cameras.main.shake(300, 0.006);
      },
    };
  }

  // ---- main render -----------------------------------------------------
  render() {
    const s = this.s;
    const ui = this.uiHelper;
    this.ui.removeAll(true);
    this.hint.setText(''); // hovered widgets are rebuilt below, so their pointerout never fires
    this.renderTopBar(s, ui);
    this.renderMapTabs(s, ui);
    this.renderDockTabs(ui);
    const { x, y, w } = DOCK;
    const actions = this.actions;
    const ctx = { mode: this.baseMode, sub: this.baseSub, view: this.baseView, factorySite: this.factorySite, siteView: this.siteView };
    if (this.tab === 'base') renderBase(ui, s, x, y, w, actions, ctx);
    else ({ mission: renderMission, fleet: renderFleet, factory: renderFactory, sites: renderSites, tech: renderTech, skylink: renderSkylink })[this.tab](ui, s, x, y, w, actions, ctx);
    renderFlights(ui, s);
    renderDepotAndLog(ui, s);
  }

  renderTopBar(s, ui) {
    const net = sim.dailyRevenue(s) - sim.OVERHEAD_PER_DAY;
    ui.label(20, 13, 'PERIGEE INDUSTRIES', { size: 20, bold: true, color: hex(COL.accent) });
    ui.label(275, 15, `${sim.dateOf(s.day).text}  ·  Day ${s.day}`, { size: 16 });
    ui.label(520, 15, `Cash $${s.cash.toFixed(1)}M`, { size: 16, color: hex(COL.good) });
    ui.label(680, 15, `Net ${net >= 0 ? '+' : '-'}$${Math.abs(net).toFixed(2)}M/day`, { size: 16 });
    [[0, 'Pause'], [1, '1x'], [3, '3x'], [8, '8x']].forEach(([v, name], i) => {
      ui.button(880 + i * 66, 10, 60, 30, name, () => this.setSpeed(v), {
        fill: this.speed === v ? COL.btnOn : COL.btn, stroke: this.speed === v ? COL.good : COL.accent, size: 13,
      });
    });
    const sure = this.confirmNew;
    ui.button(1150, 10, 120, 30, sure ? 'Erase save?' : 'New game', () => {
      if (sure) return this.newGame();
      this.confirmNew = true;
      this.time.delayedCall(3000, () => { this.confirmNew = false; this.render(); });
    }, { size: 13, fill: sure ? 0x7a2a1d : COL.btn, stroke: sure ? COL.bad : COL.accent });
  }

  renderMapTabs(s, ui) {
    Object.entries(BODIES).forEach(([id, b], i) => {
      const on = this.map.bodyId === id;
      ui.button(20 + i * 88, 63, 82, 24, b.name, () => { this.forceCloseBase(); this.map.setBody(id); }, {
        size: 12, fill: on && this.baseView === 'closed' ? COL.btnOn : COL.btn, stroke: on && this.baseView === 'closed' ? COL.good : COL.accent,
      });
    });
    if (s.base) {
      const open = this.baseView !== 'closed';
      const pending = s.base.pending.length;
      ui.button(20 + 3 * 88, 63, 96, 24, pending ? `Base · ${pending} new` : 'Base', () => (open ? this.closeBase() : this.openBase()), {
        size: 12, fill: open ? COL.btnOn : pending ? 0x5a3a12 : COL.btn, stroke: open ? COL.good : pending ? COL.warn : COL.accent,
        hint: 'Zoom into the lunar base.',
      });
    }
    ui.label(MAP.x + MAP.w - 12, 69, 'Drag to rotate  ·  click an orbit or pin', { size: 11, color: COL.dimText, right: true });
  }

  renderDockTabs(ui) {
    TABS.forEach(([id, name], i) => {
      const on = this.tab === id;
      ui.button(720 + i * 78, 63, 74, 24, name, () => { this.tab = id; }, {
        size: 11, fill: on ? COL.btnOn : COL.btn, stroke: on ? COL.good : COL.accent,
      });
    });
  }
}
