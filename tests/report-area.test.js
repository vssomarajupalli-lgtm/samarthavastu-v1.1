const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const test = require('node:test');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const helperMatch = appSource.match(/function calculatePolygonArea\(polygon\)\s*\{[\s\S]*?\n    \}/);
assert.ok(helperMatch, 'app.js must define calculatePolygonArea');
const calculatePolygonArea = vm.runInNewContext(`(${helperMatch[0]})`);

test('site polygon area matches a rectangle', () => {
  const rect = { sw: { x: 0, y: 0 }, se: { x: 50, y: 0 }, ne: { x: 50, y: 60 }, nw: { x: 0, y: 60 } };
  assert.equal(calculatePolygonArea(rect), 3000);
});

test('site polygon area accounts for a trapezoid instead of multiplying adjacent sides', () => {
  const trapezoid = { sw: { x: 0, y: 0 }, se: { x: 50, y: 0 }, ne: { x: 45, y: 40 }, nw: { x: 5, y: 40 } };
  assert.equal(calculatePolygonArea(trapezoid), 1800);
  assert.notEqual(calculatePolygonArea(trapezoid), 50 * 40);
});

test('invalid polygons return zero instead of propagating NaN', () => {
  assert.equal(calculatePolygonArea({ sw: { x: 0, y: 0 }, se: { x: 10, y: 0 } }), 0);
  assert.equal(calculatePolygonArea({ sw: { x: NaN, y: 0 }, se: { x: 10, y: 0 }, ne: { x: 10, y: 10 }, nw: { x: 0, y: 10 } }), 0);
});
