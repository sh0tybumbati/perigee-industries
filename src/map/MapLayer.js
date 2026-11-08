// The map view: a 3D planet with 2D orbit rings, landing-site pins, and dashed flight trails drawn on top.
import * as THREE from 'three';
import { Globe, ringPoints, ringAnchor, surfacePoint, CAM_DIST } from './globe.js';
import { DESTINATIONS, SITES, SITE_IDS } from '../data.js';
import * as sim from '../sim.js';
import { COL, FONT, hex } from '../ui/ui.js';

const CENTER = { earth: [SITES.cape.lat, SITES.cape.lon], moon: [-10, -10], mars: [25, 95] };
const FAR_OUT = new THREE.Vector3(1.7, 0.95, 0.2); // where Moon/Mars-bound flights leave the Earth view
const FAR_IN = new THREE.Vector3(-1.7, 0.95, 0.8); // where they enter the Moon/Mars view
const HISTORY = 24;

const ROLE_COLOR = { payload: COL.accent, tanker: COL.warn, depot: COL.violet };

function dashed(g, pts, ox, oy, dash = 7, gap = 5) {
  let on = true;
  let left = dash;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a.hidden || b.hidden) { on = true; left = dash; continue; }
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (!len) continue;
    const ux = dx / len;
    const uy = dy / len;
    let x = a.x;
    let y = a.y;
    let pos = 0;
    while (pos < len) {
      const step = Math.min(left, len - pos);
      if (on) g.lineBetween(ox + x, oy + y, ox + x + ux * step, oy + y + uy * step);
      x += ux * step; y += uy * step; pos += step; left -= step;
      if (left <= 0) { on = !on; left = on ? dash : gap; }
    }
  }
}

function solid(g, pts, ox, oy) {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i - 1].hidden || pts[i].hidden) continue;
    g.lineBetween(ox + pts[i - 1].x, oy + pts[i - 1].y, ox + pts[i].x, oy + pts[i].y);
  }
}

const smooth = (u) => u * u * (3 - 2 * u);

export class MapLayer {
  constructor(scene, rect, { getState, onSelect, onSite, setHint }) {
    this.scene = scene;
    this.rect = rect;
    this.getState = getState;
    this.onSelect = onSelect;
    this.onSite = onSite;
    this.sitePins = {};
    this.setHint = setHint;
    this.globe = new Globe(rect.w, rect.h);
    this.tex = scene.textures.addCanvas('globe', this.globe.view);
    this.image = scene.add.image(rect.x, rect.y, 'globe').setOrigin(0);
    this.g = scene.add.graphics();
    // Everything drawn over the planet is clipped to the map panel.
    const clip = scene.make.graphics({ x: 0, y: 0, add: false });
    clip.fillStyle(0xffffff).fillRect(rect.x, rect.y, rect.w, rect.h);
    this.mask = clip.createGeometryMask();
    this.g.setMask(this.mask);
    this.pins = {};
    this.anchors = {};
    this.bodyId = null;
    this.lastTripId = 0;
    this.pulse = null;
    this.zoom = null; // active zoom animation
    this.overlays = true; // rings, trails and pins hide while zoomed in
    this.active = true;
    this.zone = scene.add.zone(rect.x, rect.y, rect.w, rect.h).setOrigin(0).setInteractive({ useHandCursor: true });
    let last = null;
    this.zone.on('pointerdown', (p) => { last = { x: p.x, y: p.y }; });
    this.zone.on('pointermove', (p) => {
      if (!p.isDown || !last) return;
      this.globe.rotate(p.x - last.x, p.y - last.y);
      last = { x: p.x, y: p.y };
    });
    this.zone.on('pointerup', () => { last = null; });
    this.zone.on('pointerout', () => { last = null; });
  }

  setBody(id) {
    if (this.bodyId === id) return;
    this.bodyId = id;
    this.globe.setBody(id);
    this.globe.faceTo(...CENTER[id], true);
    this.buildPins();
  }

  centerDir() {
    return surfacePoint(...CENTER[this.bodyId]).normalize();
  }

  buildPins() {
    for (const p of [...Object.values(this.pins), ...Object.values(this.sitePins)]) { p.dot.destroy(); p.hit.destroy(); p.label.destroy(); }
    this.pins = {};
    this.sitePins = {};
    this.anchors = {};
    const dir = this.centerDir();
    for (const [id, d] of Object.entries(DESTINATIONS)) {
      if (d.body !== this.bodyId) continue;
      this.anchors[id] = d.kind === 'site' ? surfacePoint(d.lat, d.lon, 1.004) : ringAnchor(d.ring, dir);
      const dot = this.scene.add.circle(0, 0, d.kind === 'site' ? 5 : 6, COL.accent);
      const hit = this.scene.add.circle(0, 0, 13, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      const label = this.scene.add.text(0, 0, d.name, { fontFamily: FONT, fontSize: 11, color: '#e6f3ff', stroke: '#05070d', strokeThickness: 3 });
      dot.setMask(this.mask);
      label.setMask(this.mask);
      hit.on('pointerdown', () => this.onSelect(id));
      hit.on('pointerover', () => this.setHint(`${d.name}: ${d.days} day${d.days > 1 ? 's' : ''} one way. Click to select.`));
      hit.on('pointerout', () => this.setHint(''));
      this.pins[id] = { dot, hit, label };
    }
    if (this.bodyId === 'earth') {
      for (const id of SITE_IDS) {
        const d = SITES[id];
        this.anchors[`site:${id}`] = surfacePoint(d.lat, d.lon, 1.004);
        const dot = this.scene.add.rectangle(0, 0, 9, 9, COL.accent).setAngle(45);
        const hit = this.scene.add.circle(0, 0, 13, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
        const label = this.scene.add.text(0, 0, d.short, { fontFamily: FONT, fontSize: 11, color: '#cfe6ff', stroke: '#05070d', strokeThickness: 3 });
        dot.setMask(this.mask);
        label.setMask(this.mask);
        hit.on('pointerdown', () => this.onSite(id));
        hit.on('pointerover', () => this.setHint(`${d.name}: ${d.blurb} Click to launch from here.`));
        hit.on('pointerout', () => this.setHint(''));
        this.sitePins[id] = { dot, hit, label };
      }
    }
  }

  // Dolly in to a landing site over `ms`, then call done. progress(p) reports 0..1 for fades.
  zoomIn(destId, done, progress) {
    const d = DESTINATIONS[destId];
    this.globe.faceTo(d.lat, d.lon);
    this.zoom = { from: this.globe.dist, to: 1.18, t: 0, ms: 1300, done, progress };
  }

  zoomOut(done, progress) {
    this.zoom = { from: this.globe.dist, to: CAM_DIST, t: 0, ms: 1000, done, progress };
  }

  resetZoom() {
    this.zoom = null;
    this.globe.setDist(CAM_DIST);
    this.setActive(true);
  }

  setActive(on) {
    this.active = on;
    this.image.setVisible(on);
    this.zone.input.enabled = on;
    this.g.setVisible(on);
    if (!on) this.setOverlays(false);
    else this.overlays = null; // the next frame decides whether pins and labels show
  }

  stepZoom(dtMs) {
    const z = this.zoom;
    if (!z) return;
    z.t = Math.min(1, z.t + dtMs / z.ms);
    const e = z.t * z.t * (3 - 2 * z.t);
    this.globe.setDist(z.from + (z.to - z.from) * e);
    z.progress?.(z.t);
    if (z.t >= 1) { this.zoom = null; z.done?.(); }
  }

  // Turn the planet toward a destination (sites only; rings are visible from anywhere).
  focus(id) {
    const d = DESTINATIONS[id];
    if (d.body === this.bodyId && d.kind === 'site') this.globe.faceTo(d.lat, d.lon);
  }

  toScreen(world) {
    const p = this.globe.project(world);
    return p;
  }

  localToScreen(local) {
    return this.toScreen(this.globe.world(local));
  }

  // ---- flight paths ------------------------------------------------------
  arcLocal(from, to, steps = 28) {
    const r0 = from.length();
    const r1 = to.length();
    const a = from.clone().normalize();
    const b = to.clone().normalize();
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const dir = a.clone().lerp(b, u).normalize();
      pts.push(dir.multiplyScalar(r0 + (r1 - r0) * smooth(u) + 0.1 * Math.sin(Math.PI * u)));
    }
    return pts;
  }

  // World-space polyline for a trip on the current map, or null when the trip does not appear here.
  tripPath(trip) {
    const d = DESTINATIONS[trip.dest];
    const globe = this.globe;
    if (trip.origin === 'moon' && this.bodyId === 'moon') {
      // A Moon-based Mars flight lifts off from the base and leaves toward the corner of the view.
      const site = DESTINATIONS[trip.fromSite];
      const from = surfacePoint(site.lat, site.lon, 1.004);
      const pts = this.arcLocal(from, from.clone().multiplyScalar(1.12), 8).map((p) => globe.world(p));
      const last = pts[pts.length - 1];
      for (let i = 1; i <= 20; i++) pts.push(last.clone().lerp(FAR_OUT, smooth(i / 20)));
      return pts;
    }
    if (this.bodyId === 'earth') {
      if (trip.origin === 'moon') return null;
      const origin = SITES[trip.site ?? 'cape'];
      const cape = surfacePoint(origin.lat, origin.lon, 1.004);
      const leo = this.earthAnchor(d.body === 'earth' ? trip.dest : 'leo');
      if (!leo) return null;
      const pts = this.arcLocal(cape, leo).map((p) => globe.world(p));
      if (d.body === 'earth') return pts;
      const from = pts[pts.length - 1];
      for (let i = 1; i <= 20; i++) pts.push(from.clone().lerp(FAR_OUT, smooth(i / 20)));
      return pts;
    }
    if (d.body !== this.bodyId) return null;
    const end = globe.world(this.anchors[trip.dest]);
    const mid = FAR_IN.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.55, 0.3));
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      pts.push(FAR_IN.clone().multiplyScalar((1 - t) * (1 - t)).add(mid.clone().multiplyScalar(2 * (1 - t) * t)).add(end.clone().multiplyScalar(t * t)));
    }
    return pts;
  }

  earthAnchor(id) {
    if (this.bodyId !== 'earth') return null;
    return this.anchors[id] ?? null;
  }

  along(pts, frac) {
    if (!pts.length) return null;
    const i = Math.min(pts.length - 1, Math.max(0, Math.floor(frac * (pts.length - 1))));
    return pts[i];
  }

  // ---- per frame ------------------------------------------------------------
  update(dtMs, dayFrac) {
    const s = this.getState();
    const { rect, g, globe } = this;
    this.stepZoom(dtMs);
    if (!this.active) return;
    globe.update(dtMs);
    globe.render();
    this.tex.refresh();
    g.clear();

    // atmosphere-free shadow ring so the planet edge reads against the starfield
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    g.lineStyle(1, 0x2a3a5e, 0.5).strokeCircle(cx, cy, globe.planetRadiusPx + 1);

    const show = globe.dist > CAM_DIST - 0.05;
    if (show !== this.overlays) this.setOverlays(show);
    if (!show) return;
    this.drawRings(s);
    this.drawTrips(s, dayFrac);
    this.updatePins(s);
  }

  setOverlays(on) {
    this.overlays = on;
    for (const p of [...Object.values(this.pins), ...Object.values(this.sitePins)]) { p.dot.setVisible(on); p.label.setVisible(on); p.hit.input.enabled = on; }
    for (const t of this.markerTexts ?? []) t.setVisible(false);
  }

  drawRings(s) {
    const { rect, g } = this;
    for (const [id, d] of Object.entries(DESTINATIONS)) {
      if (d.body !== this.bodyId || d.kind !== 'orbit') continue;
      const sel = s.dest === id || (sim.effDest(s) === id);
      const locked = !sim.destUnlocked(s, id);
      const pts = ringPoints(d.ring).map((p) => this.localToScreen(p));
      g.lineStyle(sel ? 3 : 1.5, sel ? COL.accent : locked ? COL.dim : 0x7fa8d8, sel ? 0.95 : locked ? 0.3 : 0.6);
      if (locked) dashed(g, pts, rect.x, rect.y, 4, 6); else solid(g, pts, rect.x, rect.y);
    }
  }

  drawTrips(s, dayFrac) {
    const { rect, g } = this;
    const trips = s.trips.filter((t) => this.tripPath(t)).slice(-HISTORY);
    if (trips.length && trips.at(-1).id > this.lastTripId) {
      if (this.lastTripId && trips.at(-1).launchDay === s.day) this.pulse = this.scene.time.now;
      this.lastTripId = trips.at(-1).id;
    }
    const markers = [];
    for (const t of trips) {
      const world = this.tripPath(t);
      const color = t.status === 'lost' ? COL.bad : ROLE_COLOR[t.role];
      const active = t.status === 'enroute';
      let path = world;
      if (t.status === 'lost') path = world.slice(0, Math.max(2, Math.round(world.length * 0.45)));
      const pts = path.map((w) => this.toScreen(w));
      g.lineStyle(active ? 2 : 1.5, color, active ? 0.95 : t.status === 'lost' ? 0.55 : 0.32);
      dashed(g, pts, rect.x, rect.y);
      if (t.status === 'lost') {
        const e = pts.at(-1);
        if (!e.hidden) {
          g.lineStyle(2, COL.bad, 0.9);
          g.lineBetween(rect.x + e.x - 4, rect.y + e.y - 4, rect.x + e.x + 4, rect.y + e.y + 4);
          g.lineBetween(rect.x + e.x - 4, rect.y + e.y + 4, rect.x + e.x + 4, rect.y + e.y - 4);
        }
      }
      if (active) {
        const span = Math.max(1, t.arriveDay - t.launchDay);
        const p = Math.min(1, Math.max(0, (s.day + dayFrac - t.launchDay) / span));
        const originBody = t.origin === 'moon' ? 'moon' : 'earth';
        const far = DESTINATIONS[t.dest].body !== originBody;
        let f = p;
        if (far) {
          if (this.bodyId === originBody) f = p <= 0.35 ? p / 0.35 : null;
          else f = p >= 0.65 ? (p - 0.65) / 0.35 : null;
        }
        if (f !== null) {
          const w = this.along(world, f);
          markers.push({ pt: this.toScreen(w), color, serial: t.serial });
        }
      }
    }
    for (const m of markers) {
      if (m.pt.hidden) continue;
      g.fillStyle(m.color, 1).fillCircle(rect.x + m.pt.x, rect.y + m.pt.y, 4.5);
      g.lineStyle(1.5, 0xffffff, 0.9).strokeCircle(rect.x + m.pt.x, rect.y + m.pt.y, 7);
    }
    this.markerLabels(markers);
  }

  markerLabels(markers) {
    this.markerTexts ??= [];
    markers.forEach((m, i) => {
      let t = this.markerTexts[i];
      if (!t) {
        t = this.markerTexts[i] = this.scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: 10, color: '#ffffff', stroke: '#05070d', strokeThickness: 3 });
        t.setMask(this.mask);
      }
      t.setText(m.serial).setPosition(this.rect.x + m.pt.x + 9, this.rect.y + m.pt.y + 4).setVisible(!m.pt.hidden);
    });
    for (let i = markers.length; i < this.markerTexts.length; i++) this.markerTexts[i].setVisible(false);
  }

  updatePins(s) {
    const { rect } = this;
    const eff = sim.effDest(s);
    for (const [id, pin] of Object.entries(this.pins)) {
      const d = DESTINATIONS[id];
      const sp = this.localToScreen(this.anchors[id]);
      const locked = !sim.destUnlocked(s, id);
      const sel = eff === id;
      const x = rect.x + sp.x;
      const y = rect.y + sp.y;
      const show = !sp.hidden;
      pin.dot.setPosition(x, y).setVisible(show).setRadius(sel ? 7 : d.kind === 'site' ? 5 : 6)
        .setFillStyle(locked ? COL.dim : sel ? COL.good : COL.accent).setStrokeStyle(sel ? 2 : 1, 0xffffff, sel ? 1 : 0.6);
      pin.hit.setPosition(x, y);
      if (show) pin.hit.input.enabled = true; else pin.hit.input.enabled = false;
      const flip = sp.x > rect.w - 150;
      pin.label.setVisible(show).setText(locked ? `${d.name} (locked)` : d.name)
        .setColor(sel ? hex(COL.good) : locked ? '#7d8cab' : '#e6f3ff').setFontStyle(sel ? 'bold' : 'normal')
        .setOrigin(flip ? 1 : 0, 0.5).setPosition(x + (flip ? -10 : 10), y - 8);
    }
    if (this.bodyId === 'earth') {
      for (const [id, pin] of Object.entries(this.sitePins)) {
        const sp = this.localToScreen(this.anchors[`site:${id}`]);
        const st = s.sites[id].status;
        const sel = s.site === id;
        const x = rect.x + sp.x;
        const y = rect.y + sp.y;
        const show = !sp.hidden;
        pin.dot.setPosition(x, y).setVisible(show).setFillStyle(st === 'locked' ? COL.dim : st === 'owned' ? COL.good : COL.warn)
          .setStrokeStyle(sel ? 2 : 1, 0xffffff, sel ? 1 : 0.6).setScale(sel ? 1.25 : 1);
        pin.hit.setPosition(x, y);
        pin.hit.input.enabled = show;
        const flip = sp.x < 70;
        pin.label.setVisible(show).setText(st === 'locked' ? `${SITES[id].short} (closed)` : SITES[id].short)
          .setColor(sel ? hex(COL.good) : st === 'locked' ? '#7d8cab' : '#cfe6ff').setFontStyle(sel ? 'bold' : 'normal')
          .setOrigin(flip ? 0 : 1, 0.5).setPosition(x + (flip ? 10 : -10), y + 2);
        if (sel && show && this.pulse !== null) {
          const t = (this.scene.time.now - this.pulse) / 900;
          if (t > 1) this.pulse = null;
          else this.g.lineStyle(2, COL.warn, 1 - t).strokeCircle(x, y, 6 + 26 * t);
        }
      }
      if (s.depot.built && this.anchors.leo) {
        const dp = this.localToScreen(this.anchors.leo.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.12));
        if (!dp.hidden) this.g.fillStyle(COL.violet, 1).fillRect(rect.x + dp.x - 4, rect.y + dp.y - 4, 8, 8);
      }
    }
  }

  destroy() {
    this.zone.destroy();
    this.image.destroy();
    this.g.destroy();
  }
}

