// Procedural equirectangular planet textures, so the game ships no image assets.
const W = 1024;
const H = 512;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value noise on a lattice that wraps horizontally, so the texture has no seam.
class Noise {
  constructor(seed, cols, rows) {
    const rnd = mulberry32(seed);
    this.cols = cols;
    this.rows = rows;
    this.grid = Float32Array.from({ length: cols * rows }, rnd);
  }

  at(u, v) {
    const x = u * this.cols;
    const y = v * (this.rows - 1);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const g = (i, j) => this.grid[Math.min(this.rows - 1, j) * this.cols + (((i % this.cols) + this.cols) % this.cols)];
    const a = g(x0, y0) + (g(x0 + 1, y0) - g(x0, y0)) * sx;
    const b = g(x0, y0 + 1) + (g(x0 + 1, y0 + 1) - g(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  }
}

function fbm(layers, u, v) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (const n of layers) {
    sum += n.at(u, v) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

const makeLayers = (seed) => [4, 8, 16, 32, 64].map((c, i) => new Noise(seed + i * 101, c, Math.max(2, c / 2) + 1));
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function newCanvas() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return c;
}

const px = (lon) => ((lon + 180) / 360) * W;
const py = (lat) => ((90 - lat) / 180) * H;

// Rough continent outlines as flat [lon, lat, lon, lat, ...] lists.
const LAND = [
  // North America (with Alaska and Central America)
  [-168, 65.5, -162, 70, -141, 69.5, -125, 70, -110, 68, -95, 69, -82, 66, -80, 63, -65, 60, -60, 55, -56, 52, -60, 47, -66, 45, -70, 42, -74, 40, -76, 35, -81, 31, -80, 26, -82, 28, -84, 30, -90, 30, -94, 29, -97, 26, -97, 21, -92, 18.5, -90, 21, -87, 21, -88, 17, -84, 15.5, -83, 11, -80, 9, -77.5, 8.5, -80, 7.5, -83, 8.5, -86, 11, -90, 13.5, -95, 16, -100, 17, -105, 20, -106, 23, -110, 26, -113, 31, -117, 32.5, -121, 35, -124, 40, -124.5, 46, -123, 49, -130, 55, -137, 58.5, -146, 60.5, -152, 59, -158, 56.5, -164, 54.5, -158, 58.5, -162, 60, -166, 62],
  // South America
  [-77.5, 8.5, -72, 12, -64, 10.5, -60, 8, -52, 5, -50, 0, -44, -2.5, -35, -5.5, -39, -13, -41, -22, -48, -26, -53, -34, -58, -38, -62, -41, -65, -45, -68, -50, -69, -53, -72, -54, -74, -50, -73, -42, -72, -33, -70, -20, -76, -14, -81, -5, -80, 0, -78, 2],
  // Africa
  [-17, 21, -13, 28, -6, 35.7, 10, 37, 11, 33, 20, 32, 32, 31, 34, 28, 38, 19, 43, 12, 51, 12, 48, 5, 41, -2, 39, -8, 40, -15, 35, -24, 32, -29, 27, -34, 19, -34.5, 15, -27, 12, -17, 13, -9, 9, -1, 9.5, 4, 4, 6, -5, 5, -8, 4.5, -13, 8, -17, 14],
  // Eurasia
  [-9, 43, -9, 37, -5, 36.2, 0, 38.5, 3, 42, 7, 43.5, 10, 44, 12.5, 41.8, 16, 38, 18.5, 40.5, 14, 45.5, 19, 42, 23, 37, 26, 40.5, 29, 41, 35, 36.8, 36, 34, 35, 29, 39, 22, 43, 13, 45, 13, 52, 16, 57, 19, 59, 22.5, 56, 26, 51, 24.5, 48, 30, 56, 27, 61, 25, 67, 24.5, 72, 21, 73, 16, 77, 8, 80, 13, 80, 16, 88, 22, 92, 21.5, 94, 17, 98, 16, 98, 8, 101, 3, 104, 1.5, 100, 7, 101, 12, 105, 9, 107, 11, 109, 15, 106, 20, 110, 21, 117, 24, 122, 30, 121, 37, 118, 38, 122, 40.5, 126, 38, 129, 35, 130, 42, 135, 43, 140, 48, 141, 53, 137, 54, 142, 59, 150, 59, 156, 57, 156, 51, 160, 54, 163, 59, 170, 60, 180, 65, 180, 69, 170, 70, 160, 69.5, 140, 72, 128, 72, 113, 74, 105, 77, 95, 76, 80, 73, 70, 73, 68, 69, 60, 69.5, 45, 68, 40, 66, 33, 67, 28, 71, 20, 70, 15, 68, 5, 62, 6, 58, 11, 59, 12, 56, 9, 54, 14, 54, 20, 54.5, 24, 59, 30, 60, 22, 60.5, 21, 65, 25, 65.5, 17, 62, 17, 57, 12, 56, 8, 57, 8, 54, 4, 52, -1, 50, -5, 48, -2, 46, -2, 43.5],
  // Australia
  [114, -22, 122, -18, 130, -12, 137, -12, 136, -15, 141, -17, 143, -11, 146, -19, 153, -26, 151, -34, 146, -39, 140, -38, 135, -35, 129, -32, 115, -34, 114, -26],
  // Greenland
  [-55, 60, -44, 60, -38, 66, -22, 70, -20, 76, -18, 82, -40, 83.5, -62, 82, -72, 78, -58, 75, -52, 68],
  // Antarctica
  [-180, -70, -150, -75, -120, -73, -90, -72, -60, -65, -62, -72, -40, -78, 0, -70, 40, -68, 80, -67, 120, -66, 150, -68, 180, -70, 180, -90, -180, -90],
  // Madagascar, Great Britain, Ireland, Japan, Indonesia, New Guinea, New Zealand, Iceland, Borneo
  [44, -25, 47, -25, 50, -15, 49, -12, 44, -17],
  [-5, 50, 1.5, 51, 0, 54, -3, 58.5, -6, 56, -3, 54],
  [-10, 52, -6, 52, -6, 55, -9, 54.5],
  [130, 31, 134, 34, 140, 36, 142, 40, 141, 45, 139, 42, 135, 36, 131, 34],
  [95, 5, 98, 4, 106, -3, 106, -6, 101, -3],
  [106, -6, 114, -8, 114, -7.5, 108, -6],
  [131, -1, 141, -3, 150, -10, 144, -8, 138, -8],
  [166, -46, 171, -44, 174, -41, 178, -38, 175, -37, 172, -41, 169, -45],
  [-24, 64, -18, 63.5, -14, 65, -20, 66],
  [109, 1, 116, 7, 119, 5, 117, -3, 111, -3],
];

export function makeEarth() {
  const mask = newCanvas();
  const mctx = mask.getContext('2d');
  mctx.fillStyle = '#000';
  mctx.fillRect(0, 0, W, H);
  mctx.fillStyle = '#fff';
  for (const poly of LAND) {
    mctx.beginPath();
    for (let i = 0; i < poly.length; i += 2) {
      const x = px(poly[i]);
      const y = py(poly[i + 1]);
      if (i === 0) mctx.moveTo(x, y); else mctx.lineTo(x, y);
    }
    mctx.closePath();
    mctx.fill();
  }
  const maskData = mctx.getImageData(0, 0, W, H).data;
  const layers = makeLayers(11);
  const clouds = makeLayers(777);
  const canvas = newCanvas();
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const lat = 90 - (y / H) * 180;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      const n = fbm(layers, u, v);
      // Roughen coastlines by sampling the mask at a noise-displaced position.
      const sx = Math.min(W - 1, Math.max(0, Math.round(x + (n - 0.5) * 14)));
      const sy = Math.min(H - 1, Math.max(0, Math.round(y + (fbm(layers, v, u) - 0.5) * 8)));
      const land = maskData[(sy * W + sx) * 4] > 128;
      const alat = Math.abs(lat);
      let c;
      if (land) {
        const desert = clamp01(1 - Math.abs(alat - 24) / 10) * clamp01((n - 0.38) * 6);
        const green = mix([0.18, 0.4, 0.17], [0.3, 0.5, 0.2], n);
        c = mix(green, [0.72, 0.6, 0.38], desert);
        c = mix(c, [0.45, 0.5, 0.4], clamp01((alat - 52) / 14));
        c = mix(c, [0.95, 0.97, 1.0], clamp01((alat - 66) / 8));
        c = mix(c, [0.55, 0.45, 0.32], clamp01((n - 0.62) * 5) * 0.6); // mountains
      } else {
        c = mix([0.05, 0.16, 0.36], [0.1, 0.32, 0.55], clamp01(n * 1.3 - 0.1));
        c = mix(c, [0.9, 0.95, 1.0], clamp01((alat - 74) / 8));
      }
      const cl = clamp01((fbm(clouds, u, v) - 0.56) * 4) * 0.55;
      c = mix(c, [1, 1, 1], cl);
      const i = (y * W + x) * 4;
      img.data[i] = c[0] * 255;
      img.data[i + 1] = c[1] * 255;
      img.data[i + 2] = c[2] * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function gaussBlob(lat, lon, radius, x, y) {
  let dx = x / W * 360 - 180 - lon;
  if (dx > 180) dx -= 360;
  if (dx < -180) dx += 360;
  const dy = 90 - (y / H) * 180 - lat;
  return Math.exp(-(dx * dx + dy * dy) / (2 * radius * radius));
}

function craters(ctx, count, seed, minR, maxR, strength) {
  const rnd = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const r = minR + (maxR - minR) * Math.pow(rnd(), 3);
    const x = rnd() * W;
    const y = H * 0.06 + rnd() * H * 0.88;
    for (const ox of [-W, 0, W]) {
      const cx = x + ox;
      if (cx < -r * 2 || cx > W + r * 2) continue;
      const g = ctx.createRadialGradient(cx, y, r * 0.2, cx, y, r);
      g.addColorStop(0, `rgba(0,0,0,${0.22 * strength})`);
      g.addColorStop(0.7, `rgba(0,0,0,${0.1 * strength})`);
      g.addColorStop(0.88, `rgba(255,255,255,${0.2 * strength})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function makeMoon() {
  const layers = makeLayers(31);
  const canvas = newCanvas();
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  // [lat, lon, radius deg, strength] for the dark maria.
  const maria = [[32, -15, 14, 0.55], [28, 18, 7, 0.5], [8, 31, 9, 0.55], [-3, 52, 6, 0.4], [-21, -15, 9, 0.45], [18, -57, 24, 0.5], [17, 59, 5, 0.55], [-10, -38, 8, 0.4]];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = fbm(layers, x / W, y / H);
      let dark = 0;
      for (const [la, lo, r, s] of maria) dark = Math.max(dark, gaussBlob(la, lo, r, x, y) * s * (0.7 + n * 0.6));
      const base = 0.5 + n * 0.32;
      const v = clamp01(base - dark);
      const i = (y * W + x) * 4;
      img.data[i] = v * 255;
      img.data[i + 1] = v * 252;
      img.data[i + 2] = v * 245;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  craters(ctx, 700, 5, 1.5, 15, 1);
  craters(ctx, 24, 9, 12, 26, 0.8);
  // Permanently shadowed south pole region around Shackleton.
  const g = ctx.createLinearGradient(0, H * 0.94, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(10,10,20,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, H * 0.94, W, H * 0.06);
  return canvas;
}

export function makeMars() {
  const layers = makeLayers(51);
  const canvas = newCanvas();
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const dark = [[9, 70, 14, 0.5], [45, -30, 18, 0.35], [-20, -40, 12, 0.35], [-40, -150, 22, 0.3], [-5, 100, 16, 0.3], [30, 110, 12, 0.25]];
  for (let y = 0; y < H; y++) {
    const alat = Math.abs(90 - (y / H) * 180);
    for (let x = 0; x < W; x++) {
      const n = fbm(layers, x / W, y / H);
      let d = 0;
      for (const [la, lo, r, s] of dark) d = Math.max(d, gaussBlob(la, lo, r, x, y) * s * (0.6 + n * 0.8));
      let c = mix([0.5, 0.24, 0.13], [0.78, 0.47, 0.26], clamp01(n * 1.4 - 0.15));
      c = mix(c, [0.25, 0.14, 0.1], d);
      c = mix(c, [0.96, 0.95, 0.94], clamp01((alat - (82 + (n - 0.5) * 6)) / 2.5));
      const i = (y * W + x) * 4;
      img.data[i] = c[0] * 255;
      img.data[i + 1] = c[1] * 255;
      img.data[i + 2] = c[2] * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  craters(ctx, 260, 8, 1.5, 11, 0.7);
  ctx.strokeStyle = 'rgba(40,18,12,0.7)'; // Valles Marineris
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px(-88), py(-8));
  ctx.quadraticCurveTo(px(-65), py(-14), px(-42), py(-10));
  ctx.stroke();
  const olympus = ctx.createRadialGradient(px(-134), py(18), 2, px(-134), py(18), 22);
  olympus.addColorStop(0, 'rgba(235,190,150,0.8)');
  olympus.addColorStop(1, 'rgba(235,190,150,0)');
  ctx.fillStyle = olympus;
  ctx.beginPath();
  ctx.arc(px(-134), py(18), 22, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}
