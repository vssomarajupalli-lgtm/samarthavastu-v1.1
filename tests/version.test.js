const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

test('visible application version consistently identifies v1.1', () => {
  assert.match(app, /const APP_VERSION = 'v1\.1'/);
  assert.match(html, /<title>SAMARTHA VASTU v1\.1 - Architect Edition<\/title>/);
  assert.match(html, /id="header-version">v1\.1<\/span>/);
  assert.match(html, /id="footer-version">v1\.1<\/span>/);
  assert.match(html, /Architect Edition v1\.1<\/p>/);
});
