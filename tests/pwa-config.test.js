const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));

test('app registers the same-origin service worker', () => {
  assert.match(app, /serviceWorker\.register\('\.\/service-worker\.js'/);
  assert.doesNotMatch(app, /register\(encoded|register\(blobUrl/);
});

test('service worker only deletes caches in its own namespace', () => {
  assert.match(worker, /CACHE_PREFIX = 'samartha-vastu-v1\.1::' \+ new URL\(self\.registration\.scope\)\.pathname/);
  assert.match(worker, /key\.startsWith\(CACHE_PREFIX\) && key !== CACHE_NAME/);
  assert.match(worker, /CDN_HOSTS = new Set/);
  assert.match(worker, /CDN_HOSTS\.has\(requestUrl\.hostname\)/);
  assert.match(worker, /response\.type === 'opaque'/);
  assert.match(worker, /'\.\/icon\.svg'/);
});

test('manifest and icon are linked and present', () => {
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.ok(fs.existsSync(path.join(root, 'icon.svg')));
});
