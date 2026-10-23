const assert = require('node:assert/strict');
const test = require('node:test');
const model = require('../floorplan-3d-model');

function samplePlan() {
  return {
    houseWidth: 40,
    houseDepth: 30,
    wallThickness: 0.5,
    activeFloor: 0,
    showPlotDeities: true,
    showSiteDeities: false,
    houseDevathas: [{ name: 'Shikhi', direction: 'North', rating: 'bad', length: 2, x: 0, y: 30 }],
    siteDevathas: [{ name: 'Agni', direction: 'East', rating: 'bad', length: 3, x: 42, y: 24 }],
    siteOutline: {
      sw: { x: -5, y: -5 }, se: { x: 45, y: -5 },
      ne: { x: 45, y: 35 }, nw: { x: -5, y: 35 }
    },
    floors: [
      {
        index: 0,
        rooms: [
          { type: 'Hall', name: 'Living Hall', x: 2, y: 3, wF: 12, wI: 6, hF: 10, hI: 0, htF: 10, color: '#dbeafe' },
          { type: 'Main Door', x: 4, y: 0, wF: 3, hF: 7, isFurniture: true, color: '#ea580c' },
          { type: 'Borewell', x: 1, y: 1, isMarker: true },
          { type: 'Hidden Room', x: 0, y: 0, wF: 4, hF: 4, hidden: true }
        ],
        walls: [{ p1: { x: 1, y: 2 }, p2: { x: 1, y: 12 }, thickness: 0.4 }]
      },
      {
        index: 1,
        rooms: [{ type: 'Bedroom', x: 3, y: 4, wF: 10, hF: 12, htF: 9 }],
        walls: []
      }
    ]
  };
}

test('feet and inch values convert without changing the plan data', () => {
  const source = samplePlan();
  const before = structuredClone(source);
  assert.equal(model.feet(12, 6), 12.5);
  const result = model.normalizePlan(source);
  assert.deepEqual(source, before);
  assert.equal(result.width, 40);
  assert.equal(result.depth, 30);
  assert.equal(result.houseDevathas[0].z, 0);
  assert.equal(result.siteDevathas[0].z, 6);
  assert.equal(result.siteOutline.sw.z, 35);
});

test('active floor output includes only visible rooms and anchored wall segments', () => {
  const result = model.normalizePlan(samplePlan());
  assert.equal(result.floors.length, 1);
  assert.equal(result.floors[0].index, 0);
  assert.deepEqual(result.floors[0].rooms.map(room => room.kind), ['room', 'door']);
  assert.equal(result.floors[0].rooms[0].width, 12.5);
  assert.equal(result.floors[0].rooms[0].z, 17);
  assert.equal(result.floors[0].rooms[0].height, 10);
  assert.equal(result.floors[0].walls.length, 1);
  assert.equal(result.floors[0].walls[0].thickness, 0.4);
  assert.equal(result.floors[0].walls[0].height, 10);
  assert.equal(result.floors[0].walls[0].z1, 28);
  assert.equal(result.floors[0].walls[0].z2, 18);
  assert.equal(result.floors[0].boundaryWalls.length, 8);
  assert.ok(result.floors[0].boundaryWalls.some(wall => wall.x1 === 2 && wall.z1 === 17 && wall.x2 === 14.5 && wall.z2 === 17));
});

test('adjacent room edges become one shared partition without duplicate segments', () => {
  const plan = {
    houseWidth: 40,
    houseDepth: 30,
    floors: [{
      rooms: [
        { type: 'Hall', x: 0, y: 0, wF: 20, hF: 30 },
        { type: 'Kitchen', x: 20, y: 0, wF: 20, hF: 30 }
      ]
    }]
  };
  const walls = model.normalizePlan(plan).floors[0].boundaryWalls;
  assert.equal(walls.length, 5);
  assert.equal(walls.filter(wall => wall.x1 === 20 && wall.x2 === 20 && wall.z1 === 0 && wall.z2 === 30).length, 1);
});

test('stack mode returns each floor separately for visual stacking', () => {
  const result = model.normalizePlan(samplePlan(), { stackFloors: true });
  assert.deepEqual(result.floors.map(floor => floor.index), [0, 1]);
  assert.equal(result.floors[1].rooms[0].name, 'Bedroom');
});

test('invalid dimensions and zero-length walls do not produce invalid geometry', () => {
  assert.throws(() => model.normalizePlan({ houseWidth: 0, houseDepth: 30 }), /dimensions/);
  assert.equal(model.normalizePlan({ houseWidth: 40, houseDepth: 30 }).floors[0].boundaryWalls.length, 4);
  const source = samplePlan();
  source.floors[0].walls.push({ p1: { x: 1, y: 1 }, p2: { x: 1, y: 1 } });
  const result = model.normalizePlan(source);
  assert.equal(result.floors[0].walls.length, 1);
});

test('missing or unsafe room colors use a safe neutral color', () => {
  const source = samplePlan();
  source.floors[0].rooms[0].color = 'url(javascript:alert(1))';
  const result = model.normalizePlan(source);
  assert.equal(result.floors[0].rooms[0].color, '#cbd5e1');
});

test('Devata labels preserve the 2D coordinates and safely map the north-up view', () => {
  const result = model.normalizePlan(samplePlan());
  assert.equal(result.showPlotDeities, true);
  assert.equal(result.showSiteDeities, false);
  assert.deepEqual(result.houseDevathas[0], {
    name: 'Shikhi', direction: 'North', rating: 'bad', length: 2, x: 0, z: 0
  });
  assert.equal(result.siteDevathas[0].x, 42);
  assert.equal(result.siteDevathas[0].z, 6);
});
