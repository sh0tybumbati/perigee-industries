import Phaser from 'phaser';
import { OpsScene } from './scenes/OpsScene.js';
import { W, widthFor } from './layout.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: 720,
  backgroundColor: '#05070d',
  input: { activePointers: 3 }, // two fingers for pinch-zoom, plus one spare
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [OpsScene],
});

if (import.meta.env.DEV) window.__perigee = game; // handy for debugging in the console

// Installable and offline-capable in the built game (not in the dev server, where it would cache stale code).
if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

// The layout is picked from the screen's shape when the page loads, so a rotation to a different shape reloads it.
// The game saves on every action and every day, so nothing is lost.
let resizeTimer = 0;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (Math.abs(widthFor(innerWidth, innerHeight) - W) > 30) location.reload(); }, 400);
});
