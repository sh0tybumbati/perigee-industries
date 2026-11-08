import test from 'node:test';
import assert from 'node:assert/strict';
import { widthFor, sizeFor, isPhone, W, EXTRA } from '../src/layout.js';

test('the canvas width follows the screen shape, between 1280 and 1720', () => {
  assert.equal(widthFor(1920, 1080), 1280, '16:9 is the base layout');
  assert.equal(widthFor(2400, 1080), 1600, '20:9 phones');
  assert.equal(widthFor(2340, 1080), 1560, '19.5:9 phones');
  assert.equal(widthFor(1024, 768), 1280, 'squarer screens keep 1280 and letterbox');
  assert.equal(widthFor(4000, 1000), 1720, 'very wide screens are capped');
  assert.equal(W - EXTRA, 1280);
});

test('a short landscape screen is a phone: 530 high, and never narrower than 1180', () => {
  assert.equal(isPhone(2400, 1080), false);
  assert.equal(isPhone(844, 390), true);
  assert.equal(isPhone(390, 844), false, 'portrait is not a phone layout');
  assert.deepEqual(sizeFor(844, 390), { phone: true, H: 530, W: 1180 });
  assert.deepEqual(sizeFor(915, 412), { phone: true, H: 530, W: 1180 });
  assert.deepEqual(sizeFor(960, 400), { phone: true, H: 530, W: 1272 });
  assert.equal(sizeFor(1024, 768).H, 720, 'tablets keep the full layout');
});
