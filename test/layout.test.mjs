import test from 'node:test';
import assert from 'node:assert/strict';
import { widthFor, W, EXTRA } from '../src/layout.js';

test('the canvas width follows the screen shape, between 1280 and 1720', () => {
  assert.equal(widthFor(1920, 1080), 1280, '16:9 is the base layout');
  assert.equal(widthFor(2400, 1080), 1600, '20:9 phones');
  assert.equal(widthFor(2340, 1080), 1560, '19.5:9 phones');
  assert.equal(widthFor(1024, 768), 1280, 'squarer screens keep 1280 and letterbox');
  assert.equal(widthFor(4000, 1000), 1720, 'very wide screens are capped');
  assert.equal(W - EXTRA, 1280);
});
