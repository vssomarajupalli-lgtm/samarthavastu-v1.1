const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const test = require('node:test');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const helperMatch = appSource.match(/function validateImportedProject\(raw\)\s*\{[\s\S]*?\n    \}/);
assert.ok(helperMatch, 'app.js must define validateImportedProject');
const validateImportedProject = vm.runInNewContext(`(${helperMatch[0]})`);

test('accepts a minimal valid project and strips unknown top-level keys', () => {
  const result = validateImportedProject({ siteN: 40, rooms: [], privateData: 'ignored' });
  assert.equal(result.siteN, 40);
  assert.deepEqual(Array.from(Object.keys(result)).sort(), ['rooms', 'siteN']);
});

test('rejects non-object and missing project markers', () => {
  assert.throws(() => validateImportedProject(null));
  assert.throws(() => validateImportedProject([]));
  assert.throws(() => validateImportedProject({ clientName: 'x' }));
});

test('rejects invalid numeric values and invalid collection shapes', () => {
  assert.throws(() => validateImportedProject({ siteN: '40' }));
  assert.throws(() => validateImportedProject({ siteN: -1 }));
  assert.throws(() => validateImportedProject({ rooms: {} }));
  assert.throws(() => validateImportedProject({ rooms: [null] }));
});

test('sanitizes bounded user strings before state mutation', () => {
  const result = validateImportedProject({ rooms: [{ name: '<img>', wF: 12.5 }], clientName: '<Client>' });
  assert.equal(result.rooms[0].name, '&lt;img&gt;');
  assert.equal(result.rooms[0].wF, 12);
  assert.equal(result.rooms[0].wI, 6);
  assert.equal(result.clientName, '&lt;Client&gt;');
});
