// Synthesized sound (GDD 2.13): everything is built from oscillators and filtered noise, no audio files.
// Browsers only allow audio after a user gesture, so the context is created on the first click.
const KEY = 'perigee-industries-settings';

const settings = { mute: false, autoPause: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) ?? '{}')); } catch { /* storage blocked */ }
const saveSettings = () => { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* nothing to do */ } };

let ctx = null;
let master = null;
let ambient = null;

export const getSettings = () => settings;
export function setSetting(k, v) { settings[k] = v; saveSettings(); if (k === 'mute') applyMute(); }

function applyMute() {
  if (!master) return;
  master.gain.value = settings.mute ? 0 : 0.5;
}

// Call from any user gesture. Safe to call again and again.
export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.connect(ctx.destination);
  applyMute();
  startAmbient();
}

function tone(freq, start, dur, { type = 'sine', gain = 0.2, to = null, attack = 0.01 } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(start, dur, { gain = 0.3, from = 800, to = 200, q = 0.7 } = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

export const click = () => tone(660, 0, 0.05, { type: 'square', gain: 0.05 });
export const beep = (final = false) => tone(final ? 880 : 520, 0, final ? 0.35 : 0.12, { type: 'square', gain: 0.1 });
export const ignition = () => { noise(0, 2.2, { gain: 0.5, from: 1400, to: 120 }); tone(55, 0, 2, { type: 'sawtooth', gain: 0.18, to: 90 }); };
export const success = () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.35, { type: 'triangle', gain: 0.14 }));
export const failure = () => { noise(0, 1.2, { gain: 0.6, from: 2400, to: 80 }); tone(180, 0.1, 0.9, { type: 'sawtooth', gain: 0.16, to: 45 }); };
export const coin = () => { tone(988, 0, 0.08, { type: 'square', gain: 0.06 }); tone(1319, 0.07, 0.18, { type: 'square', gain: 0.06 }); };
export const fanfare = () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.5, { type: 'triangle', gain: 0.13 }));
export const warn = () => { tone(440, 0, 0.12, { type: 'triangle', gain: 0.1 }); tone(330, 0.13, 0.2, { type: 'triangle', gain: 0.1 }); };

// A slow, quiet pad: two detuned saws through a low-pass filter whose cutoff drifts.
function startAmbient() {
  if (!ctx || ambient) return;
  const g = ctx.createGain();
  g.gain.value = 0.035;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 380;
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.06;
  lfoGain.gain.value = 140;
  lfo.connect(lfoGain).connect(f.frequency);
  lfo.start();
  for (const [freq, det] of [[110, -6], [110, 7], [164.8, 3]]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = det;
    o.connect(f);
    o.start();
  }
  f.connect(g).connect(master);
  ambient = g;
}
