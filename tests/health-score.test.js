const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const test = require('node:test');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const helperMatch = appSource.match(/function getAyadiHealthPenalty\(data\)\s*\{[\s\S]*?\n    \}/);
assert.ok(helperMatch, 'app.js must define getAyadiHealthPenalty');
const getAyadiHealthPenalty = vm.runInNewContext(`(${helperMatch[0]})`);

test('Ayadi penalty is zero for auspicious yoni and income above debt', () => {
  assert.equal(getAyadiHealthPenalty({ y: 1, dr: 9, ru: 4 }), 0);
});

test('non-auspicious yoni deducts 20 points', () => {
  assert.equal(getAyadiHealthPenalty({ y: 2, dr: 9, ru: 4 }), 20);
});

test('income equal to or below debt deducts 15 points', () => {
  assert.equal(getAyadiHealthPenalty({ y: 1, dr: 4, ru: 4 }), 15);
  assert.equal(getAyadiHealthPenalty({ y: 1, dr: 3, ru: 4 }), 15);
});

test('both Ayadi issues deduct 35 points', () => {
  assert.equal(getAyadiHealthPenalty({ y: 2, dr: 3, ru: 4 }), 35);
});
