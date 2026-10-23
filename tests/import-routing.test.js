const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('all project import entry points delegate to the schema-filtered importer', () => {
  assert.match(app, /window\.importProject\(\{ target: \{ files: \[f\] \} \}\)/, 'welcome screen must use shared importer');
  assert.equal((html.match(/window\.importProject\(\{target:\{files:\[f\]\}\}\)/g) || []).length, 2, 'desktop and mobile menus must use shared importer');
  assert.doesNotMatch(html, /Object\.assign\(state,\s*p\)/, 'HTML import handlers must not merge unvalidated JSON into app state');
});
test('import only closes the project manager when it is already open', () => {
  const importer = app.slice(app.indexOf('window.importProject = function'), app.indexOf('// ── Shared helper: build project summary text'));
  assert.match(importer, /projectModal && projectModal\.style\.display === 'flex'\) window\.toggleProjectManager\(\)/);
});
