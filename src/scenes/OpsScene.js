import Phaser from 'phaser';
import { BODIES, DESTINATIONS, REGIONS, DUCT_COST, SITES } from '../data.js';
import * as sim from '../sim.js';
import * as B from '../base.js';
import { MapLayer } from '../map/MapLayer.js';
import { BaseLayer } from '../map/BaseLayer.js';
import { COL, FONT, UI, hex } from '../ui/ui.js';
import { renderMission, renderFleet, renderFactory, renderSites, renderTech, renderSkylink, renderBase } from '../ui/dock.js';
import { Lane, renderFlights, renderDepotAndLog } from '../ui/bottom.js';
import { FX } from '../fx.js';
import { renderSiteScene } from '../ui/art.js';
import * as audio from '../audio.js';

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
    this.lastSpeed = 1; // restored by Space after a pause
    this.helpMode = false; // Tips: taps show hints instead of acting
    this.gestureUntil = 0;
    this.pinch = null;
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
    this.input.keyboard?.on('keydown-Z', () => this.act(() => this.undoBase()));
    this.input.keyboard?.on('keydown-R', () => this.act(() => { if (this.baseMode.kind === 'place') this.baseMode.rot ^= 1; }));
    this.input.keyboard?.on('keydown-ESC', () => this.act(() => { this.baseMode = { kind: 'idle', rot: 0 }; }));
    this.lane = new Lane(this);
    this.fx = new FX(this, MAP);
    sim.setEventSink((e) => this.onEvent(e));
    this.input.on('pointerdown', () => audio.unlock());
    this.setupKeys();
    this.cameras.main.setBounds(0, 0, 1280, 720);
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
    this.lastCash = undefined;
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
      callback: () => { if (this.fx.busy) return; sim.tick(this.s); this.lastTickAt = this.time.now; this.saveGame(); this.render(); },
    });
  }

  setSpeed(v) { if (v) this.lastSpeed = v; this.speed = v; this.scheduleTick(); }

  // ---- game feel (GDD 2.13) -----------------------------------------------------
  setupKeys() {
    const k = this.input.keyboard;
    if (!k) return;
    k.addCapture('SPACE');
    k.on('keydown-SPACE', () => { this.setSpeed(this.speed ? 0 : this.lastSpeed); this.render(); });
    [['ONE', 1], ['TWO', 3], ['THREE', 8]].forEach(([key, v]) => k.on(`keydown-${key}`, () => { this.setSpeed(v); this.render(); }));
    k.on('keydown-M', () => { audio.unlock(); audio.setSetting('mute', !audio.getSettings().mute); this.render(); });
    k.on('keydown-P', () => this.toggleAutoPause());
  }

  toggleAutoPause() {
    audio.setSetting('autoPause', !audio.getSettings().autoPause);
    this.fx.toast(`Auto-pause ${audio.getSettings().autoPause ? 'on' : 'off'}`);
    this.render();
  }

  // Listens to the simulation: toasts, banners, sounds and auto-pause.
  onEvent(e) {
    if (e.type === 'note') {
      if (e.kind !== 'info') this.fx.toast(e.msg, e.kind);
      if (e.kind === 'warn') audio.warn();
      if (e.pause && audio.getSettings().autoPause && this.speed) {
        this.setSpeed(0);
        this.fx.toast('Paused: press Space to resume');
      }
    } else if (e.type === 'milestone') {
      this.fx.banner(e.title, e.text, e.date);
    } else if (e.type === 'test') {
      if (e.success) audio.success();
      else { audio.failure(); this.cameras.main.shake(420, 0.01); }
    }
  }

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

  // ---- touch: pinch to zoom, two fingers to pan ---------------------------------------
  gestureActive() { return this.time.now < this.gestureUntil; }

  resetZoom() {
    const cam = this.cameras.main;
    cam.setZoom(1);
    cam.setScroll(0, 0);
    this.pinch = null;
  }

  updateGesture() {
    const { pointer1: p1, pointer2: p2 } = this.input;
    if (!p1?.isDown || !p2?.isDown) { this.pinch = null; return; }
    this.gestureUntil = this.time.now + 300;
    const cam = this.cameras.main;
    const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    if (this.pinch && this.pinch.d > 8) {
      const anchor = cam.getWorldPoint(this.pinch.mid.x, this.pinch.mid.y);
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (d / this.pinch.d), 1, 3));
      const now = cam.getWorldPoint(mid.x, mid.y);
      cam.scrollX += anchor.x - now.x;
      cam.scrollY += anchor.y - now.y;
    }
    this.pinch = { d, mid };
  }

  undoBase() {
    if (this.s.base && B.undoBlocker(this.s.base) === null) B.undoLast(this.s);
  }

  update(time, delta) {
    this.updateGesture();
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
      flyTest: (id) => sim.flyTest(s, id),
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
      undo: () => this.undoBase(),
      skipTutorial: () => sim.skipTutorial(s),
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
        if (this.fx.busy || sim.launchBlocker(s)) return;
        const origin = this.map.sitePos(s.site) ?? { x: MAP.x + MAP.w / 2 + 40, y: MAP.y + MAP.h - 60 };
        this.fx.launch(origin, () => {
          const res = sim.launch(this.s);
          this.syncMap();
          this.saveGame();
          this.time.delayedCall(0, () => this.render());
          return res;
        });
      },
    };
  }

  // ---- main render -----------------------------------------------------
  render() {
    const s = this.s;
    const ui = this.uiHelper;
    this.ui.removeAll(true);
    this.hint.setText(''); // hovered widgets are rebuilt below, so their pointerout never fires
    if (this.lastCash !== undefined) {
      const d = s.cash - this.lastCash;
      if (Math.abs(d) >= 0.5) { this.fx.floatCash(d, 505, 38); if (d >= 1) audio.coin(); }
    }
    this.lastCash = s.cash;
    const step = sim.tutorialStep(s);
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
    if (this.tab === 'sites' || this.tab === 'factory') renderSiteScene(ui, s, this.tab === 'sites' ? (this.siteView && s.sites[this.siteView] ? this.siteView : s.site) : this.factorySite);
    if (step) this.renderCoach(ui, step);
  }

  // The tutorial card, over the map's top-left corner.
  renderCoach(ui, step) {
    const x = MAP.x + 8;
    const y = MAP.y + 8;
    const w = 300;
    const g = this.add.graphics();
    g.fillStyle(0x0b1220, 0.94).fillRect(x, y, w, 96);
    g.lineStyle(2, 0xffd166).strokeRect(x + 1, y + 1, w - 2, 94);
    this.ui.add(g);
    ui.label(x + 10, y + 7, `TUTORIAL  ·  ${sim.TUTORIAL.indexOf(step) + 1} of ${sim.TUTORIAL.length}`, { size: 10, bold: true, color: '#ffd166' });
    ui.label(x + 10, y + 21, step.title, { size: 15, bold: true });
    ui.label(x + 10, y + 42, step.text, { size: 11, color: COL.dimText, wrap: w - 20 });
    ui.button(x + w - 62, y + 72, 56, 18, 'Skip', () => this.actions.skipTutorial(), { size: 10 });
  }

  renderTopBar(s, ui) {
    const net = sim.dailyRevenue(s) - sim.OVERHEAD_PER_DAY;
    const runway = sim.runwayDays(s);
    ui.label(20, 13, 'PERIGEE INDUSTRIES', { size: 20, bold: true, color: hex(COL.accent) });
    ui.label(262, 15, `${sim.dateOf(s.day).text}  ·  Day ${s.day}`, { size: 15 });
    ui.label(470, 15, `Cash $${s.cash.toFixed(1)}M`, { size: 16, color: hex(COL.good) });
    this.sparkline(596, 12, 80, 26, s.cashHistory);
    ui.label(686, 9, `Net ${net >= 0 ? '+' : '-'}$${Math.abs(net).toFixed(2)}M/day`, { size: 15 });
    ui.label(686, 29, runway === Infinity ? 'Profitable' : `Runway ${runway} days`, {
      size: 11, bold: true, color: runway === Infinity ? hex(COL.good) : runway < 20 ? hex(COL.bad) : runway < 60 ? hex(COL.warn) : COL.dimText,
    });
    [[0, 'Pause'], [1, '1x'], [3, '3x'], [8, '8x']].forEach(([v, name], i) => {
      ui.button(846 + i * 50, 10, 46, 30, name, () => this.setSpeed(v), {
        fill: this.speed === v ? COL.btnOn : COL.btn, stroke: this.speed === v ? COL.good : COL.accent, size: 12,
        hint: 'Space pauses, 1 2 3 pick the speed.',
      });
    });
    const st = audio.getSettings();
    const small = (x, w, label, cb, on, hint, off = false) => ui.button(x, 10, w, 30, label, cb, {
      size: 10, fill: on ? COL.btnOn : off ? 0x3a2030 : COL.btn, stroke: on ? COL.good : off ? COL.bad : COL.accent, hint,
    });
    small(1048, 32, st.mute ? 'Mute' : 'Snd', () => audio.setSetting('mute', !st.mute), false, 'Sound on or off (M).', st.mute);
    small(1084, 30, 'AP', () => audio.setSetting('autoPause', !st.autoPause), st.autoPause, `Auto-pause on important events: ${st.autoPause ? 'on' : 'off'} (P).`);
    small(1118, 34, 'Tips', () => { this.helpMode = !this.helpMode; this.hint.setText(this.helpMode ? 'Tips mode: tap anything to read about it' : ''); }, this.helpMode, 'Tips mode: tapping a button shows what it does instead of pressing it.');
    small(1156, 30, 'Fit', () => this.resetZoom(), false, 'Back to the full view. Pinch with two fingers to zoom.');
    small(1190, 34, 'Full', () => (this.scale.isFullscreen ? this.scale.stopFullscreen() : this.scale.startFullscreen()), false, 'Fullscreen.');
    const sure = this.confirmNew;
    ui.button(1228, 10, 46, 30, sure ? 'Erase?' : 'New', () => {
      if (sure) return this.newGame();
      this.confirmNew = true;
      this.time.delayedCall(3000, () => { this.confirmNew = false; this.render(); });
    }, { size: 10, fill: sure ? 0x7a2a1d : COL.btn, stroke: sure ? COL.bad : COL.accent, hint: 'Start a new company (asks first).' });
  }

  // A tiny line chart of the last 90 days of cash.
  sparkline(x, y, w, h, data) {
    const g = this.add.graphics();
    g.fillStyle(0x0f1830, 0.8).fillRect(x, y, w, h);
    g.lineStyle(1, COL.line).strokeRect(x + 0.5, y + 0.5, w, h);
    if (data && data.length > 1) {
      const lo = Math.min(...data);
      const hi = Math.max(...data);
      const span = Math.max(1, hi - lo);
      g.lineStyle(1.5, data[data.length - 1] >= data[0] ? COL.good : COL.bad);
      g.beginPath();
      data.forEach((v, i) => {
        const px = x + 2 + (i / (data.length - 1)) * (w - 4);
        const py = y + h - 3 - ((v - lo) / span) * (h - 6);
        if (i) g.lineTo(px, py); else g.moveTo(px, py);
      });
      g.strokePath();
    }
    this.ui.add(g);
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
    const step = sim.tutorialStep(this.s);
    TABS.forEach(([id, name], i) => {
      const on = this.tab === id;
      const nudge = step?.tab === id && !on; // the tutorial wants this tab
      ui.button(720 + i * 78, 63, 74, 24, name, () => { this.tab = id; }, {
        size: 11, fill: on ? COL.btnOn : nudge ? 0x5a4a12 : COL.btn, stroke: on ? COL.good : nudge ? 0xffd166 : COL.accent,
      });
    });
  }
}
