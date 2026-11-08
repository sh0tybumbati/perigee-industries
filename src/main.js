import Phaser from 'phaser';
import { OpsScene } from './scenes/OpsScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: '#05070d',
  input: { activePointers: 3 }, // two fingers for pinch-zoom, plus one spare
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [OpsScene],
});

if (import.meta.env.DEV) window.__perigee = game; // handy for debugging in the console
