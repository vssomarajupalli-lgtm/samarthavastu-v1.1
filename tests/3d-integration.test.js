const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const view = fs.readFileSync(path.join(root, '3d-view.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

test('2D stays the default and 3D renders in its own hidden layer', () => {
  assert.match(html, /data-plan-view="2d" aria-pressed="true"/);
  assert.match(html, /id="vastu3DStage"[^>]*hidden/);
  assert.match(html, /id="vastu3DCanvas"/);
  assert.match(html, /src="\.\/floorplan-3d-model\.js"/);
  assert.match(html, /type="module" src="\.\/3d-view\.js"/);
});

test('the 3D data bridge returns copied floor plan fields for both floors', () => {
  assert.match(app, /window\.getVastu3DPlan = function\(\)/);
  assert.match(app, /floors: \[floorData\(0\), floorData\(1\)\]/);
  assert.match(app, /rooms: rooms\.map\(copyRoom\)\.filter\(Boolean\)/);
  assert.match(app, /walls: walls\.map\(function\(wall\)/);
  assert.match(app, /getShiftedDevathas\(poly, north, east, south, west, state\.rotation\)/);
  assert.match(app, /showPlotDeities: !!state\.showPlotDeities/);
  assert.match(app, /showSiteDeities: !!state\.showSiteDeities/);
});

test('the default 3D camera follows the 2D compass orientation and dimensions are shown', () => {
  assert.match(view, /North is up-screen and East remains right-screen/);
  assert.match(view, /formatFeetInches\(room\.width\)/);
  assert.match(view, /formatFeetInches\(room\.depth\)/);
  assert.match(html, /id="vastu3DLabels" checked/);
});

test('3D room and Devata labels use high-contrast colors and readable sizing', () => {
  assert.match(view, /rgba\(255,255,255,0\.97\)/);
  assert.match(view, /context\.strokeStyle = '#64748b'/);
  assert.match(view, /context\.font = '700 34px system-ui, sans-serif'/);
  assert.match(view, /context\.filter = 'contrast\(110%\) saturate\(110%\)'/);
  assert.match(view, /rgba\(255,253,247,0\.98\)/);
  assert.match(view, /context\.strokeStyle = '#475569'/);
  assert.match(view, /context\.filter = 'contrast\(110%\) saturate\(110%\)'/);
  assert.match(view, /item\.rating === 'good' \? '#16a34a' : \(item\.rating === 'bad' \? '#dc2626' : '#334155'\)/);
  assert.match(view, /context\.filter = 'none'/);
  assert.match(view, /context\.font = '700 32px system-ui, sans-serif'/);
  assert.match(view, /sprite\.scale\.set\(labelWidth, labelWidth \* 0\.32, 1\)/);
});

test('3D view requires WebGL 2 and reports a fallback without affecting 2D', () => {
  assert.match(view, /WebGL\.isWebGL2Available\(\)/);
  assert.match(view, /Your 2D floor plan is unchanged/);
  assert.match(html, /Visual preview, not a construction drawing/);
  assert.match(view, /originalDraw\.apply\(this, arguments\)/);
});

test('PWA app shell precaches the local 3D renderer and controls', () => {
  assert.match(worker, /CACHE_NAME = CACHE_PREFIX \+ 'shell-v5'/);
  [
    './floorplan-3d-model.js',
    './3d-view.js',
    './vendor/three/three.module.js',
    './vendor/three/three.core.js',
    './vendor/three/addons/controls/OrbitControls.js',
    './vendor/three/addons/capabilities/WebGL.js'
  ].forEach(file => assert.ok(worker.includes("'" + file + "'"), file));
});
