const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const languages = ['en', 'hi', 'kn', 'ml', 'ta', 'te'];

test('all guide and consultation PDF links target bundled local files', () => {
  for (const language of languages) {
    for (const kind of ['guide', 'consult']) {
      const filename = `${kind}_${language}.pdf`;
      assert.ok(app.includes(`./${filename}`) || html.includes(`./${filename}`), `${filename} must be linked locally`);
      assert.ok(fs.existsSync(path.join(root, filename)), `${filename} must exist in the project`);
    }
  }
  assert.doesNotMatch(app + html, /vssomarajupalli-lgtm\.github\.io\/samarthavastu_mobile-app\/(?:guide|consult)_/);
});
