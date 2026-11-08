// 3D planet models (Three.js) rendered into a canvas that Phaser shows as a texture.
// Pins, orbit rings and flight trails are drawn in 2D by the scene, using the projection helpers here.
import * as THREE from 'three';
import { makeEarth, makeMoon, makeMars } from './textures.js';

export const CAM_DIST = 3.6;
export const FOV = 38;
const DEG = Math.PI / 180;
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const CAMERA = new THREE.Vector3(0, 0, CAM_DIST);

// lat/lon to a point on a sphere, matching how three's SphereGeometry wraps an equirectangular map.
export function surfacePoint(lat, lon, r = 1) {
  const phi = (lon + 180) * DEG;
  const la = lat * DEG;
  return new THREE.Vector3(-Math.cos(phi) * Math.cos(la) * r, Math.sin(la) * r, Math.sin(phi) * Math.cos(la) * r);
}

function orbitPoint(ring, theta) {
  let r = ring.r;
  if (ring.apo) {
    const a = (ring.r + ring.apo) / 2;
    const e = (ring.apo - ring.r) / (ring.apo + ring.r);
    r = (a * (1 - e * e)) / (1 + e * Math.cos(theta));
  }
  return new THREE.Vector3(r * Math.cos(theta), 0, r * Math.sin(theta))
    .applyAxisAngle(X, ring.incl * DEG)
    .applyAxisAngle(Y, ring.node * DEG);
}

export function ringPoints(ring, n = 96) {
  return Array.from({ length: n + 1 }, (_, i) => orbitPoint(ring, (i / n) * Math.PI * 2));
}

// Where the clickable orbit pin sits: the ring point nearest `centerDir`, shifted along the ring by the ring's phase.
export function ringAnchor(ring, centerDir) {
  let best = 0;
  let bestDot = -2;
  for (let i = 0; i < 360; i++) {
    const d = orbitPoint(ring, i * DEG).normalize().dot(centerDir);
    if (d > bestDot) { bestDot = d; best = i; }
  }
  return orbitPoint(ring, (best + (ring.phase ?? 0)) * DEG);
}

const BODY_STYLE = {
  earth: { make: makeEarth, glow: [0.3, 0.6, 1.0], glowPower: 2.6 },
  moon: { make: makeMoon, glow: null },
  mars: { make: makeMars, glow: [1.0, 0.55, 0.3], glowPower: 4 },
};

function glowMaterial([r, g, b], power) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: { color: { value: new THREE.Color(r, g, b) }, power: { value: power } },
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 color; uniform float power; varying vec3 vN; void main(){ float i = pow(max(0.0, 0.72 - dot(vN, vec3(0.0, 0.0, 1.0))), power); gl_FragColor = vec4(color * i * 1.6, i); }',
  });
}

export class Globe {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 0);
    this.camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 50);
    this.camera.position.copy(CAMERA);
    this.camera.lookAt(0, 0, 0);
    this.view = document.createElement('canvas'); // 2D copy that Phaser can upload as a texture
    this.view.width = width;
    this.view.height = height;
    this.viewCtx = this.view.getContext('2d');
    this.bodies = {};
    this.body = null;
    this.tanHalf = Math.tan((FOV * DEG) / 2);
  }

  ensure(id) {
    if (this.bodies[id]) return this.bodies[id];
    const style = BODY_STYLE[id];
    const scene = new THREE.Scene();
    const tex = new THREE.CanvasTexture(style.make());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 })));
    if (style.glow) group.add(new THREE.Mesh(new THREE.SphereGeometry(1.06, 64, 48), glowMaterial(style.glow, style.glowPower)));
    scene.add(group);
    scene.add(new THREE.AmbientLight(0x8a9bbd, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.position.set(-3, 2, 5);
    scene.add(sun);
    return (this.bodies[id] = { scene, group, target: null });
  }

  setBody(id) {
    this.body = this.ensure(id);
  }

  rotate(dx, dy) {
    const q = this.body.group.quaternion;
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(Y, dx * 0.008));
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(X, dy * 0.008));
    this.body.target = null;
  }

  // Turn the planet so lat/lon faces the camera (animated unless `snap`).
  faceTo(lat, lon, snap = false) {
    const target = new THREE.Quaternion().setFromUnitVectors(surfacePoint(lat, lon).normalize(), Z);
    if (snap) { this.body.group.quaternion.copy(target); this.body.target = null; } else this.body.target = target;
  }

  update(dtMs) {
    const b = this.body;
    if (!b?.target) return;
    b.group.quaternion.slerp(b.target, 1 - Math.pow(0.002, dtMs / 1000));
    if (b.group.quaternion.angleTo(b.target) < 0.002) b.target = null;
  }

  render() {
    this.renderer.render(this.body.scene, this.camera);
    this.viewCtx.clearRect(0, 0, this.width, this.height);
    this.viewCtx.drawImage(this.renderer.domElement, 0, 0);
  }

  // Local planet coordinates to world coordinates (applies the current rotation).
  world(local) {
    return local.clone().applyQuaternion(this.body.group.quaternion);
  }

  // World point to pixels inside the globe view. `hidden` is true when the planet blocks the camera's view of it.
  project(w) {
    const dz = CAM_DIST - w.z;
    const x = this.width / 2 + (w.x / dz / (this.tanHalf * (this.width / this.height))) * (this.width / 2);
    const y = this.height / 2 - (w.y / dz / this.tanHalf) * (this.height / 2);
    return { x, y, hidden: dz <= 0.05 || this.occluded(w) };
  }

  occluded(w) {
    const d = w.clone().sub(CAMERA);
    const a = d.dot(d);
    const b = 2 * CAMERA.dot(d);
    const c = CAMERA.dot(CAMERA) - 0.995;
    const disc = b * b - 4 * a * c;
    if (disc <= 0) return false;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t > 0 && t < 1;
  }

  get planetRadiusPx() {
    return (Math.tan(Math.asin(1 / CAM_DIST)) / this.tanHalf) * (this.height / 2);
  }
}
