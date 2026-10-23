const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('active and restored app languages update the document language', () => {
  assert.match(app, /window\.setAppLanguage = function\(lang\)\s*\{[\s\S]*?document\.documentElement\.lang = lang;/);
  assert.match(app, /window\.restoreAppLanguage = function\(\)\s*\{[\s\S]*?document\.documentElement\.lang = lang;/);
});

test('local stylesheet is included only once', () => {
  assert.equal((html.match(/<link rel="stylesheet" href="style\.css">/g) || []).length, 1);
});
