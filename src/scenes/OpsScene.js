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
import { CHAPTERS, COLONY_DAYS, currentChapter, chapterDone, goalProgress } from '../goals.js';
import { W, H, EXTRA, PHONE } from '../layout.js';

const STATUS_SHIFT = 190; // on a phone the bottom strip is a panel over the lower half of the screen
import * as audio from '../audio.js';

const SAVE_KEY = 'perigee-industries-save';
const MAP = { x: 10, y: 90, w: 690 + EXTRA, h: 432 };
const DOCK = { x: 722 + EXTRA, y: 98, w: 536 };
// how far the dock slides left when it has the whole screen to itself
const DOCK_SHIFT = { dock: () => Math.round((W - 560) / 2) - (710 + EXTRA) };
const TABS = [['mission', 'Mission'], ['fleet', 'Fleet'], ['factory', 'Factory'], ['sites', 'Sites'], ['base', 'Base'], ['tech', 'R&D'], ['skylink', 'Skylink']];
const TICK_MS = 2400;

export class OpsScene extends Phaser.Scene {
  constructor() {
    super('ops');
    this.speed = 1;
    this.tab = 'mission';
    this.lastTickAt = 0;
    this.baseView = 'closed'; // closed | zooming | open
    this.baseBody = 'moon'; // which base the base view and Base tab show
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
    this.view = 'split'; // 'split' | 'map' | 'dock'
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
      getBase: () => this.activeBase(),
      getMode: () => this.baseMode,
      onTile: (t, cancel) => this.act(() => this.baseTile(t, cancel)),
      onPort: (id) => this.act(() => this.basePort(id)),
      setHint: (t) => this.hint.setText(t),
    });
    this.input.mouse?.disableContextMenu();
    this.input.keyboard?.on('keydown-Z', () => this.act(() => this.undoBase()));
    this.input.keyboard?.on('keydown-R', () => this.act(() => { if (this.baseMode.kind === 'place') this.baseMode.rot ^= 1; }));
    this.input.keyboard?.on('keydown-ESC', () => this.act(() => { this.baseMode = { kind: 'idle', rot: 0 }; }));
    // The bottom strip: always on screen on desktop and tablet, a toggled panel on a phone.
    this.statusLayer = this.add.container(0, -STATUS_SHIFT).setDepth(300).setVisible(!PHONE);
    if (PHONE) { this.statusLayer.setVisible(false); this.buildStatusPanel(); }
    this.lane = new Lane(this, PHONE ? this.statusLayer : null);
    this.fx = new FX(this, MAP);
    this.fx.pinPos = (id) => (this.baseView === 'closed' && this.map.bodyId === 'earth' ? this.map.pinPos(id) : null);
    sim.setEventSink((e) => this.onEvent(e));
    this.input.on('pointerdown', () => audio.unlock());
    this.setupKeys();
    this.cameras.main.setBounds(0, 0, W, H);
    this.ui = this.add.container(0, 0).setDepth(10); // above the pins and labels the map layer draws
    this.dockC = this.add.container(0, 0).setDepth(9); // the dock panel, which slides over when it has the screen to itself
    this.hint = this.add.text(MAP.x + 10, MAP.y + MAP.h - 20, '', { fontFamily: FONT, fontSize: 12, color: hex(COL.accent), stroke: '#05070d', strokeThickness: 3 });
    this.uiHelper = new UI(this, this.ui, (fn) => this.act(fn), (t) => this.hint.setText(t));
    this.dockUi = new UI(this, this.dockC, (fn) => this.act(fn), (t) => this.hint.setText(t));
    this.statusUi = PHONE ? new UI(this, this.statusDyn, (fn) => this.act(fn), (t) => this.hint.setText(t)) : null;
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
      g.fillRect(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 1.5, 1.5);
    }
  }

  // The view decides which panels are drawn: 'split' is map and dock side by side, 'map' and 'dock' give one the whole width.
  drawFrame() {
    const g = (this.frameG ??= this.add.graphics());
    g.clear();
    const panels = [];
    if (this.view === 'split') panels.push([10, 58, 690 + EXTRA, 466], [710 + EXTRA, 58, 560, 466]);
    else if (this.view === 'map') panels.push([10, 58, W - 20, 466]);
    else panels.push([DOCK_SHIFT.dock() + 710 + EXTRA, 58, 560, 466]);
    if (!PHONE) panels.push([10, 530, 690 + EXTRA, 180], [710 + EXTRA, 530, 560, 180]);
    for (const [x, y, w, h] of panels) {
      g.fillStyle(COL.panel, 0.92).fillRect(x, y, w, h);
      g.lineStyle(1, COL.line).strokeRect(x + 0.5, y + 0.5, w, h);
    }
    g.fillStyle(COL.panel, 0.95).fillRect(0, 0, W, 50);
    g.lineStyle(1, COL.line).lineBetween(0, 50, W, 50);
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
      callback: () => { if (this.fx.busy) return; sim.tick(this.s); this.lastTickAt = this.time.now; this.saveGame(); this.render(); this.checkAutoLaunch(); },
    });
  }

  // A locked loadout launches by itself once every payload has arrived (GDD 2.22).
  checkAutoLaunch() {
    if (this.fx.busy) return;
    const L = sim.nextAutoLaunch(this.s);
    if (!L) return;
    const origin = this.map.sitePos(L.site) ?? { x: MAP.x + MAP.w / 2 + 40, y: MAP.y + MAP.h - 60 };
    this.fx.launch(origin, () => {
      const res = sim.launchLoadout(this.s, L.id);
      this.syncMap();
      this.saveGame();
      this.time.delayedCall(0, () => this.render());
      return res;
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
    } else if (e.type === 'dock') {
      // a ship refuels after its ascent, so that scene waits for the launch animation
      this.fx.dock(e.mode, e.t, e.left, e.mode === 'refuel' ? 1900 : 0);
    } else if (e.type === 'victory') {
      this.victoryOpen = true;
      this.setSpeed(0);
      audio.success();
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
    const base = this.activeBase();
    if (base && B.undoBlocker(base) === null) B.undoLast(this.s, base);
  }

  update(time, delta) {
    this.updateGesture();
    this.map.update(delta, this.dayFrac());
    this.base.update(time);
    this.lane.update(this.s, this.dayFrac());
  }

  // ---- base view ------------------------------------------------------------
  activeBase() { return this.baseBody === 'mars' ? this.s.marsBase : this.s.base; }

  openBase(body = this.baseBody) {
    const base = body === 'mars' ? this.s.marsBase : this.s.base;
    if (!base || this.baseView !== 'closed') return;
    this.baseBody = body;
    this.baseView = 'zooming';
    this.tab = 'base';
    this.map.setBody(body);
    this.map.zoomIn(base.site, () => {
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
    if (m.kind !== 'place' || !this.activeBase()) return;
    if (B.placeModule(this.activeBase(), m.pendingId, tile.x, tile.y, m.rot)) {
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
    const base = this.activeBase();
    const blocker = B.ductBlocker(base, m.ductFrom, id) ?? (sim.canSpend(s, DUCT_COST) ? null : 'Not enough cash for a duct');
    if (blocker) { this.hint.setText(blocker); this.baseMode = { ...m, ductFrom: null }; return; }
    B.connect(base, m.ductFrom, id);
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
      setPlan: (id) => sim.setPlan(s, id),
      cycleSatGen: () => sim.cycleSatGen(s),
      skyTab: (id) => { this.skyTab = id; },
      applyLicense: (id) => sim.applyLicense(s, id),
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
      buildWell: (id) => sim.buildWell(s, id),
      buyCommodity: (id, type, amt) => sim.buyCommodity(s, id, type, amt),
      expandTank: (id, type) => sim.expandTank(s, id, type),
      buildPlant: (id, fuel) => sim.buildPlant(s, id, fuel),
      buyDroneship: () => sim.buyDroneship(s),
      factorySite: (id) => { this.factorySite = id; },
      openBase: (body) => this.openBase(body),
      setOrigin: (o) => sim.setOrigin(s, o),
      closeBase: () => this.closeBase(),
      baseSub: (id) => { this.baseSub = id; },
      undo: () => this.undoBase(),
      skipTutorial: () => sim.skipTutorial(s),
      setPolicy: (id) => { this.activeBase().policy = id; },
      startPlace: (pendingId) => {
        if (this.baseView !== 'open') this.openBase();
        this.baseMode = { kind: 'place', pendingId, rot: this.baseMode.rot ?? 0 };
      },
      toggleDuct: () => {
        if (this.baseView !== 'open') this.openBase();
        this.baseMode = this.baseMode.kind === 'duct' ? { kind: 'idle', rot: 0 } : { kind: 'duct', rot: 0, ductFrom: null };
      },
      rotate: () => { if (this.baseMode.kind === 'place') this.baseMode.rot ^= 1; },
      sellSurplus: () => { const got = B.sellSurplus(s, this.activeBase()); sim.note(s, `Sold lunar materials for $${got}M.`); },
      queueLocal: (type) => B.queueLocalBuild(s, type, (m) => sim.note(s, m), this.activeBase()),
      lockLoadout: () => { if (sim.lockLoadout(s)) { this.saveGame(); this.checkAutoLaunch(); } },
      cancelLoadout: (id) => { sim.cancelLoadout(s, id); this.saveGame(); },
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
    this.dockC.removeAll(true);
    this.hint.setText(''); // hovered widgets are rebuilt below, so their pointerout never fires
    if (this.lastCash !== undefined) {
      const d = s.cash - this.lastCash;
      if (Math.abs(d) >= 0.5) { this.fx.floatCash(d, 505, 38); if (d >= 1) audio.coin(); }
    }
    this.lastCash = s.cash;
    const step = sim.tutorialStep(s);
    this.renderTopBar(s, ui);
    const dui = this.dockUi;
    if (this.view !== 'dock') this.renderMapTabs(s, ui);
    this.renderViewButtons(ui);
    if (this.view !== 'map') this.renderDockTabs(dui);
    const { x, y, w } = DOCK;
    const actions = this.actions;
    const ctx = { mode: this.baseMode, sub: this.baseSub, view: this.baseView, base: this.activeBase(), body: this.baseBody, factorySite: this.factorySite, siteView: this.siteView, skyTab: this.skyTab };
    if (this.view === 'map') { /* the dock is hidden */ }
    else if (this.tab === 'base') renderBase(dui, s, x, y, w, actions, ctx);
    else ({ mission: renderMission, fleet: renderFleet, factory: renderFactory, sites: renderSites, tech: renderTech, skylink: renderSkylink })[this.tab](dui, s, x, y, w, actions, ctx);
    if (PHONE) this.renderStatus(s);
    else { renderFlights(ui, s); renderDepotAndLog(ui, s); }
    if (this.view !== 'dock' && (this.tab === 'sites' || this.tab === 'factory')) renderSiteScene(ui, s, this.tab === 'sites' ? (this.siteView && s.sites[this.siteView] ? this.siteView : s.site) : this.factorySite);
    if (step) this.renderCoach(ui, step);
    else if (this.view !== 'dock') this.renderGoalStrip(s, ui);
    if (this.goalsOpen && this.view !== 'dock') this.renderGoals(s, ui);
    if (this.victoryOpen) this.renderVictory(s, ui);
  }

  // ---- goals (GDD 2.21) ------------------------------------------------------------------
  // The strip at the foot of the map: the current objective and its progress. Press it for the Goals panel.
  renderGoalStrip(s, ui) {
    const ch = currentChapter(s);
    const g = ch?.goals.find((x) => s.goals[x.id] == null);
    const w = Math.min(380, MAP.w - 20);
    const x = MAP.x + MAP.w - w - 8;
    const y = MAP.y + MAP.h - 30;
    const prog = g && goalProgress(s, g);
    const text = !ch ? 'Colony won. Goals complete' : `${ch.name}: ${g.text}${prog ? `  (${prog[0]} / ${prog[1]})` : ''}`;
    ui.row(x, y, w, 24, { on: !!this.goalsOpen, onClick: () => { this.goalsOpen = !this.goalsOpen; }, hint: 'Your current goal. Press for all goals.' });
    ui.label(x + 8, y + 5, 'GOAL', { size: 10, bold: true, color: hex(COL.warn) });
    ui.label(x + 44, y + 5, text, { size: 11, wrap: w - 52 });
  }

  renderGoals(s, ui) {
    const w = Math.min(520, MAP.w - 20);
    const x = MAP.x + 10;
    const y = MAP.y + 8;
    const h = MAP.h - 48;
    ui.row(x, y, w, h, { fill: 0x0a1426, stroke: COL.accent, onClick: () => {} }).setAlpha(0.97);
    ui.heading(x + 12, y + 8, 'GOALS');
    ui.button(x + w - 62, y + 6, 52, 22, 'Close', () => { this.goalsOpen = false; }, { size: 11 });
    const cur = currentChapter(s);
    let ly = y + 34;
    CHAPTERS.forEach((ch, i) => {
      const done = chapterDone(s, ch);
      const open = ch === cur;
      const col = done ? hex(COL.good) : open ? COL.text : COL.dimText;
      ui.label(x + 12, ly, `${done ? '✓' : open ? '▶' : '•'}  ${i + 1}. ${ch.name}`, { size: 13, bold: true, color: col });
      ui.label(x + w - 12, ly + 1, done ? `done day ${Math.max(...ch.goals.map((g) => s.goals[g.id]))}` : ch.grant ? `grant $${ch.grant}M` : 'the win', { size: 11, right: true, color: COL.dimText });
      ly += 20;
      if (!open) return;
      for (const g of ch.goals) {
        const d = s.goals[g.id] != null;
        const prog = !d && goalProgress(s, g);
        ui.label(x + 34, ly, `${d ? '✓' : '○'}  ${g.text}${prog ? `   ${prog[0]} / ${prog[1]}` : ''}`, { size: 12, color: d ? hex(COL.good) : COL.text });
        ly += 18;
      }
      if (ch.id === 'colony') {
        for (const m of s.colonyMissing ?? []) { ui.label(x + 34, ly, `✗  ${m}`, { size: 11, color: hex(COL.warn) }); ly += 16; }
        ui.label(x + 34, ly, 'Three crewed, powered habitats, a working Ice Miner and Refinery, and a Mars-based Skyship that has flown home.', { size: 10, color: COL.dimText, wrap: w - 50 });
        ly += 30;
      }
      ly += 4;
    });
  }

  renderVictory(s, ui) {
    const best = this.recordBest(s.won);
    const w = 460;
    const x = Math.round((W - w) / 2);
    const y = 110;
    ui.row(0, 0, W, H, { fill: 0x000000, stroke: 0x000000, onClick: () => {} }).setAlpha(0.6);
    ui.row(x, y, w, 300, { fill: 0x0a1426, stroke: COL.good, onClick: () => {} });
    ui.label(x + w / 2, y + 16, 'A SELF-SUSTAINING MARS COLONY', { size: 20, bold: true, color: hex(COL.good), center: true });
    ui.label(x + w / 2, y + 46, 'Perigee Industries has done it.', { size: 14, center: true });
    const lost = s.trips.filter((t) => t.status === 'lost').length;
    const rows = [
      ['Date', sim.dateOf(s.won).text], ['Years taken', (s.won / 365).toFixed(1)], ['Successful flights', sim.reputation(s)],
      ['Vehicles lost', lost], ['Skylink subscribers', `${Math.round(sim.totalSubs(s))}k`], ['Cash', `$${s.cash.toFixed(0)}M`],
      ['Mars base crew', s.marsBase ? B.baseStatus(s.marsBase).crew : 0],
    ];
    rows.forEach(([k, v], i) => {
      ui.label(x + 40, y + 84 + i * 20, k, { size: 13, color: COL.dimText });
      ui.label(x + w - 40, y + 84 + i * 20, String(v), { size: 13, right: true });
    });
    ui.label(x + w / 2, y + 232, best.fresh ? 'Your fastest finish so far.' : `Your fastest finish: ${(best.day / 365).toFixed(1)} years.`, { size: 12, color: hex(COL.warn), center: true });
    ui.button(x + w / 2 - 70, y + 258, 140, 30, 'Keep playing', () => { this.victoryOpen = false; }, { fill: COL.btnOn, stroke: COL.good });
  }

  // The earliest finish is kept in the browser. Returns it, and whether this run set it.
  recordBest(day) {
    const key = 'perigee-industries-best';
    try {
      const prev = +localStorage.getItem(key);
      if (!prev || day < prev) { localStorage.setItem(key, String(day)); return { day, fresh: true }; }
      return { day: prev, fresh: false };
    } catch {
      return { day, fresh: true };
    }
  }

  // ---- phone: the status panel -----------------------------------------------------------
  buildStatusPanel() {
    const g = this.add.graphics();
    g.fillStyle(COL.panel, 0.98).fillRect(10, 530, 690 + EXTRA, 180).fillRect(710 + EXTRA, 530, 560, 180);
    g.lineStyle(2, COL.accent).strokeRect(10.5, 530.5, 690 + EXTRA, 180).strokeRect(710.5 + EXTRA, 530.5, 560, 180);
    const block = this.add.zone(0, 530, W, 190).setOrigin(0).setInteractive(); // taps on the panel stay on the panel
    this.statusDyn = this.add.container(0, 0);
    this.statusLayer.add([g, block, this.statusDyn]);
  }

  renderStatus(s) {
    this.statusDyn.removeAll(true);
    this.statusLayer.setVisible(!!this.statusOpen);
    if (!this.statusOpen) return;
    renderFlights(this.statusUi, s);
    renderDepotAndLog(this.statusUi, s);
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
    const date = sim.dateOf(s.day).text;
    const rx = 846 + EXTRA - (PHONE ? 40 : 0); // where the right-hand buttons start
    ui.label(20, PHONE ? 15 : 13, 'PERIGEE INDUSTRIES', { size: PHONE ? 17 : 20, bold: true, color: hex(COL.accent) });
    ui.label(PHONE ? 225 : 262, 15, PHONE ? date : `${date}  ·  Day ${s.day}`, { size: 15 });
    ui.label(PHONE ? 335 : 470, 15, `Cash $${s.cash.toFixed(1)}M`, { size: 16, color: hex(COL.good) });
    if (!PHONE) this.sparkline(596, 12, 80, 26, s.cashHistory);
    const nx = PHONE ? 475 : 686;
    ui.label(nx, 9, `Net ${net >= 0 ? '+' : '-'}$${Math.abs(net).toFixed(2)}M/day`, { size: 15 });
    ui.label(nx, 29, runway === Infinity ? 'Profitable' : `Runway ${runway} days`, {
      size: 11, bold: true, color: runway === Infinity ? hex(COL.good) : runway < 20 ? hex(COL.bad) : runway < 60 ? hex(COL.warn) : COL.dimText,
    });
    [[0, 'Pause'], [1, '1x'], [3, '3x'], [8, '8x']].forEach(([v, name], i) => {
      ui.button(rx + i * 50, 10, 46, 30, name, () => this.setSpeed(v), {
        fill: this.speed === v ? COL.btnOn : COL.btn, stroke: this.speed === v ? COL.good : COL.accent, size: 12,
        hint: 'Space pauses, 1 2 3 pick the speed.',
      });
    });
    const st = audio.getSettings();
    const small = (x, w, label, cb, on, hint, off = false) => ui.button(x, 10, w, 30, label, cb, {
      size: 10, fill: on ? COL.btnOn : off ? 0x3a2030 : COL.btn, stroke: on ? COL.good : off ? COL.bad : COL.accent, hint,
    });
    small(rx + 202, 32, st.mute ? 'Mute' : 'Snd', () => audio.setSetting('mute', !st.mute), false, 'Sound on or off (M).', st.mute);
    small(rx + 238, 30, 'AP', () => audio.setSetting('autoPause', !st.autoPause), st.autoPause, `Auto-pause on important events: ${st.autoPause ? 'on' : 'off'} (P).`);
    small(rx + 272, 34, 'Tips', () => { this.helpMode = !this.helpMode; this.hint.setText(this.helpMode ? 'Tips mode: tap anything to read about it' : ''); }, this.helpMode, 'Tips mode: tapping a button shows what it does instead of pressing it.');
    small(rx + 310, 30, 'Fit', () => this.resetZoom(), false, 'Back to the full view. Pinch with two fingers to zoom.');
    small(rx + 344, 34, 'Full', () => (this.scale.isFullscreen ? this.scale.stopFullscreen() : this.scale.startFullscreen()), false, 'Fullscreen.');
    let nxt = rx + 382;
    if (PHONE) {
      small(nxt, 34, 'Log', () => { this.statusOpen = !this.statusOpen; }, !!this.statusOpen, 'Transit lane, flights, depot and mission log.');
      nxt += 38;
    }
    const sure = this.confirmNew;
    ui.button(nxt, 10, 46, 30, sure ? 'Erase?' : 'New', () => {
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
    let bx = 20 + 3 * 88;
    for (const [body, base, name] of [['moon', s.base, 'Moon base'], ['mars', s.marsBase, 'Mars base']]) {
      if (!base) continue;
      const open = this.baseView !== 'closed' && this.baseBody === body;
      const pending = base.pending.length;
      ui.button(bx, 63, 104, 24, pending ? `${name} · ${pending} new` : name, () => (open ? this.closeBase() : this.openBase(body)), {
        size: 12, fill: open ? COL.btnOn : pending ? 0x5a3a12 : COL.btn, stroke: open ? COL.good : pending ? COL.warn : COL.accent,
        hint: `Zoom into the ${body === 'mars' ? 'Mars' : 'lunar'} base.`,
      });
      bx += 110;
    }
    if (this.view === 'map') ui.label(MAP.x + MAP.w - 170, 69, 'Drag to rotate  ·  click an orbit or pin', { size: 11, color: COL.dimText, right: true });
  }

  // Split, Map or Dock: which panel gets the screen. In dock view there is no map tab row, so the buttons sit in the free margin.
  renderViewButtons(ui) {
    const x = this.view === 'dock' ? 20 : MAP.x + MAP.w - 152;
    [['split', 'Split', 'Map and dock side by side.'], ['map', 'Map', 'The map takes the whole width and the dock is hidden.'], ['dock', 'Dock', 'The dock on its own, with the map hidden.']].forEach(([id, name, hint], i) => {
      const on = this.view === id;
      ui.button(x + i * 50, 63, 46, 24, name, () => this.setView(id), {
        size: 11, fill: on ? COL.btnOn : COL.btn, stroke: on ? COL.good : COL.accent, hint,
      });
    });
  }

  setView(v) {
    if (v === this.view) return;
    this.view = v;
    this.forceCloseBase();
    MAP.w = v === 'map' ? W - 20 : 690 + EXTRA;
    this.map.resize();
    this.base.resize();
    this.map.setActive(v !== 'dock');
    this.dockC.x = v === 'dock' ? DOCK_SHIFT.dock() : 0;
    this.drawFrame();
    this.syncMap(true);
  }

  renderDockTabs(ui) {
    const step = sim.tutorialStep(this.s);
    TABS.forEach(([id, name], i) => {
      const on = this.tab === id;
      const nudge = step?.tab === id && !on; // the tutorial wants this tab
      ui.button(720 + EXTRA + i * 78, 63, 74, 24, name, () => { this.tab = id; }, {
        size: 11, fill: on ? COL.btnOn : nudge ? 0x5a4a12 : COL.btn, stroke: on ? COL.good : nudge ? 0xffd166 : COL.accent,
      });
    });
  }
}
