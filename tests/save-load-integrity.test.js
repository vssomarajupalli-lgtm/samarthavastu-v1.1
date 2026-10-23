const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const test = require('node:test');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const helperMatch = appSource.match(/function validateImportedProject\(raw\)\s*\{[\s\S]*?\n    \}/);
assert.ok(helperMatch, 'app.js must define validateImportedProject');
const validateImportedProject = vm.runInNewContext(`(${helperMatch[0]})`);

test('project import validation preserves supported per-floor data', () => {
  const project = {
    siteN: 40,
    rooms: [{ name: 'GF', type: 'Hall' }],
    roomsByFloor: { 0: [{ name: 'GF', type: 'Hall' }], 1: [{ name: 'FF', type: 'Hall' }] },
    wallsByFloor: { 0: [{ p1: { x: 0, y: 0 }, p2: { x: 2, y: 2 } }], 1: [] },
    textsByFloor: { 0: [{ text: 'Ground' }], 1: [{ text: 'First' }] },
    floorInitialized: { 0: true, 1: true },
    showDevataZoneLines: true
  };
  const original = JSON.parse(JSON.stringify(project));
  const result = JSON.parse(JSON.stringify(validateImportedProject(project)));
  assert.deepEqual(project, original, 'validation must not mutate the input project');
  assert.deepEqual(result.roomsByFloor, project.roomsByFloor);
  assert.deepEqual(result.wallsByFloor, project.wallsByFloor);
  assert.deepEqual(result.textsByFloor, project.textsByFloor);
  assert.deepEqual(result.floorInitialized, project.floorInitialized);
  assert.equal(result.showDevataZoneLines, true);
});

test('saved project loader validates before merging and restores floor data', () => {
  const loader = appSource.slice(appSource.indexOf('window.loadSavedProject = function'), appSource.indexOf('window.exportProject = function'));
  assert.match(loader, /validateImportedProject\(pr\)/);
  assert.match(loader, /window\.migrateToFloors\(\)/);
  assert.ok(loader.indexOf('validateImportedProject(pr)') < loader.indexOf('Object.assign(state, validatedProject)'));
});
