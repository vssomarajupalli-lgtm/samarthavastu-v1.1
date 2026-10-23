const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const test = require('node:test');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const helperMatch = appSource.match(/function captureFloorReportImage\(floor\)\s*\{[\s\S]*?\n    \}/);
assert.ok(helperMatch, 'app.js must define captureFloorReportImage');

function loadCaptureHelper(context) {
  return vm.runInNewContext(`(${helperMatch[0]})`, context);
}

test('report floor capture restores the active floor and arrays if drawing fails', () => {
  const originalRooms = [{ name: 'Ground Floor' }];
  const originalWalls = [{ id: 'ground-wall' }];
  const context = {
    state: { currentFloor: 0, rooms: originalRooms, walls: originalWalls,
      roomsByFloor: { 1: [{ name: 'First Floor' }] }, wallsByFloor: { 1: [{ id: 'first-wall' }] } },
    window: { draw() { if (context.state.currentFloor === 1) throw new Error('draw failed'); } },
    canvas: { toDataURL() { return 'data:image/png;base64,test'; } },
    JSON
  };
  const capture = loadCaptureHelper(context);
  assert.throws(() => capture(1), /draw failed/);
  assert.equal(context.state.currentFloor, 0);
  assert.equal(context.state.rooms, originalRooms);
  assert.equal(context.state.walls, originalWalls);
});

test('report floor capture restores state after successful capture', () => {
  const originalRooms = [{ name: 'Ground Floor' }];
  const originalWalls = [];
  const context = {
    state: { currentFloor: 0, rooms: originalRooms, walls: originalWalls,
      roomsByFloor: { 1: [{ name: 'First Floor' }] }, wallsByFloor: { 1: [] } },
    window: { draw() {} },
    canvas: { toDataURL() { return 'data:image/png;base64,test'; } },
    JSON
  };
  const capture = loadCaptureHelper(context);
  assert.equal(capture(1), 'data:image/png;base64,test');
  assert.equal(context.state.currentFloor, 0);
  assert.equal(context.state.rooms, originalRooms);
  assert.equal(context.state.walls, originalWalls);
});
