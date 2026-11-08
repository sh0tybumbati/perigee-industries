// Procedural regolith terrain for the base view, one look per landing site.
const LOOK = {
  shackleton: { base: [0.36, 0.38, 0.43], shade: true },
  tranq: { base: [0.52, 0.49, 0.43], shade: false },
  procellarum: { base: [0.4, 0.38, 0.37], shade: false },
  jezero: { base: [0.5, 0.3, 0.2], shade: false },
  utopia: { base: [0.56, 0.34, 0.22], shade: false },
};

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

function lattice(rnd, cols, rows) {
  const g = Float32Array.from({ length: (cols + 1) * (rows + 1) }, rnd);
  return (u, v) => {
    const x = u * cols;
    const y = v * rows;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const at = (i, j) => g[j * (cols + 1) + i];
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
}

export function makeTerrain(site, w, h) {
  const look = LOOK[site] ?? LOOK.tranq;
  const rnd = mulberry32([...site].reduce((n, c) => n * 31 + c.charCodeAt(0), 7));
  const coarse = lattice(rnd, 6, 4);
  const mid = lattice(rnd, 18, 12);
  const fine = lattice(rnd, 230, 148);
  const grain = lattice(rnd, 460, 296);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const v = y / h;
      let t = 0.5 + (coarse(u, v) - 0.5) * 0.35 + (mid(u, v) - 0.5) * 0.22 + (fine(u, v) - 0.5) * 0.12 + (grain(u, v) - 0.5) * 0.07;
      if (look.shade) t *= 0.55 + 0.45 * Math.min(1, (u * 0.7 + v * 0.6) * 1.2); // permanently shadowed corner
      const i = (y * w + x) * 4;
      img.data[i] = Math.min(255, look.base[0] * t * 2 * 255);
      img.data[i + 1] = Math.min(255, look.base[1] * t * 2 * 255);
      img.data[i + 2] = Math.min(255, look.base[2] * t * 2 * 255 + (look.shade ? (1 - u) * 10 : 0));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < 16; i++) {
    const r = 8 + Math.pow(rnd(), 2) * 46;
    const cx = rnd() * w;
    const cy = rnd() * h;
    const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.15, cx, cy, r);
    g.addColorStop(0, 'rgba(0,0,0,0.28)');
    g.addColorStop(0.75, 'rgba(0,0,0,0.12)');
    g.addColorStop(0.9, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '20,20,24' : '230,230,235'},${0.1 + rnd() * 0.25})`;
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2.2, 1 + rnd() * 1.8);
  }
  return canvas;
}
