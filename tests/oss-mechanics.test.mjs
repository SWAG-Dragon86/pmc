import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../src/data/catalog.json' with {type: 'json'};
import { createBuild, defaultScene } from '../src/model.mjs';
import { simulateTurn, damageFor, makePokemon, canApplySecondary } from '../src/engine.mjs';
import { groundedOnTerrain } from '../src/grounding.mjs';

const build = (species, move, overrides = {}) => {
  assert(catalog.pokemon.some(p => p.id === species), `Unknown fixture species: ${species}`);
  return {...createBuild(catalog, species), moves: [move, '', '', ''], ...overrides};
};
function duel(a, d, terrain = '') {
  const s = defaultScene(catalog);
  s.actors[0] = a; s.actors[2] = d;
  s.field.terrain = terrain; s.field.terrainMode = 'manual';
  s.field.weatherMode = 'manual';
  return s;
}
function run(s, data = catalog) { const r = simulateTurn(s, data); assert.equal(r.error, undefined); return r; }
const glide = () => duel(build('rillaboom', 'grassyglide', {hp: 1}), build('pikachu', 'thunderbolt', {hp: 1}), 'Grassy');
const fake = (overrides = {}) => duel(build('incineroar', 'fakeout', {ability: 'Blaze'}), build('pikachu', 'thunderbolt', overrides));
const flinched = r => r.log.some(line => line.includes('畏缩'));

test('Grassy Glide wins the audited speed-order KO only when grounded on Grassy Terrain', () => {
  const s = glide(), before = structuredClone(s), r = run(s);
  assert.equal(r.damage.ko, 100); assert.equal(r.afterAction[0].min, 100 / makePokemon(s.actors[0], catalog).maxHP());
  assert.deepEqual(s, before);
  for (const terrain of ['', 'Electric', 'Misty', 'Psychic']) {
    s.field.terrain = terrain;
    const r = run(s); assert.equal(r.damage.max, 0); assert.equal(r.afterAction[0].max, 0);
  }
});
for (const [label, overrides] of [
  ['Flying', {battleTypes: ['Flying']}], ['Levitate', {currentAbility: 'Levitate'}],
  ['Eelevate', {currentAbility: 'Eelevate'}], ['Air Balloon', {item: 'Air Balloon'}],
]) {
  test(`Grassy Glide has no terrain priority for ${label}, but gravity restores it`, () => {
    const s = glide(); Object.assign(s.actors[0], overrides);
    assert.equal(run(s).damage.max, 0);
    s.field.gravity = true; assert.equal(run(s).damage.ko, 100);
  });
}
test('Iron Ball grounds Flying/Levitate for Grassy Glide; Armor Tail blocks its gained priority', () => {
  const s = glide(); Object.assign(s.actors[0], {battleTypes: ['Flying'], currentAbility: 'Levitate', item: 'Iron Ball'});
  assert.equal(run(s).damage.ko, 100);
  const guarded = duel(build('rillaboom', 'grassyglide'), build('farigiraf', 'psychic', {ability: 'Armor Tail'}), 'Grassy');
  assert.equal(run(guarded).damage.max, 0);
  assert.equal(damageFor(guarded.actors[0], guarded.actors[2], 'grassyglide', guarded, catalog).max, 0);
  guarded.field.terrain = ''; assert(run(guarded).damage.mean > 0);
});
test('Psychic Terrain blocks Fake Out against grounded targets, but not airborne targets', () => {
  const s = fake(); s.field.terrain = 'Psychic';
  assert(!flinched(run(s))); assert.equal(run(s).damage.max, 0);
  s.actors[2].item = 'Air Balloon'; assert(flinched(run(s)));
  s.field.gravity = true; assert(!flinched(run(s)));
});
test('Fake Out prevents the audited unprotected target action on entry turn', () => {
  const s = fake(), before = structuredClone(s), r = run(s);
  assert(flinched(r)); assert.equal(r.afterAction[0].min, 100); assert(r.damage.mean > 0);
  assert.deepEqual(s, before);
});
for (const [label, overrides] of [
  ['Inner Focus', {currentAbility: 'Inner Focus'}], ['Shield Dust', {currentAbility: 'Shield Dust'}],
  ['Protect', {protected: true}],
]) test(`${label} prevents Fake Out flinch`, () => {
  const r = run(fake(overrides)); assert(!flinched(r)); assert(r.afterAction[0].max < 100);
});
test('Ghost immunity and an acting Protect move prevent flinch', () => {
  let s = fake(); s.actors[2] = build('gengar', 'shadowball');
  assert(!flinched(run(s))); assert.equal(run(s).damage.max, 0);
  s = fake(); s.actors[2].moves[0] = 'protect'; assert(!flinched(run(s))); assert.equal(run(s).damage.max, 0);
});
test('Mold Breaker bypasses Inner Focus and Shield Dust', () => {
  for (const ability of ['Inner Focus', 'Shield Dust']) {
    const s = fake({currentAbility: ability}); s.actors[0].currentAbility = 'Mold Breaker';
    assert(flinched(run(s)));
  }
});
test('Covert Cloak blocks secondaries at the immunity boundary; it remains outside this item pack', () => {
  const s = fake({item: 'Covert Cloak'});
  assert(!catalog.items.some(i => i.name === 'Covert Cloak'));
  assert.match(simulateTurn(s, catalog).error, /道具不在当前数据包/);
  assert.equal(canApplySecondary(s.actors[0], s.actors[2], catalog.moves.fakeout), false);
  assert.equal(canApplySecondary(s.actors[0], s.actors[2], catalog.moves.fakeout, 'Mold Breaker'), false);
});
test('Sheer Force removes flinch and known prior actions make Fake Out unavailable', () => {
  const s = fake(); s.actors[0].currentAbility = 'Sheer Force'; assert(!flinched(run(s)));
  s.actors[0].activeMoveActions = 1;
  assert.match(simulateTurn(s, catalog).error, /入场首回合/);
  assert.equal(damageFor(s.actors[0], s.actors[2], 'fakeout', s, catalog).max, 0);
});
test('A target that already moved cannot be flinched; optional flinch effects stay conditional', () => {
  const s = duel(build('arcanine', 'bite', {ability: 'Flash Fire'}), build('pikachu', 'thunderbolt'));
  assert(!flinched(run(s))); s.actors[0].secondary = true; assert(flinched(run(s)));
  s.actors[0].boosts.spe = -6; assert(!flinched(run(s)));
});
for (const [label, overrides, gravity, heals] of [
  ['grounded', {}, false, true], ['balloon', {item: 'Air Balloon'}, false, false],
  ['popped balloon', {item: ''}, false, true], ['Flying', {battleTypes: ['Flying']}, false, false],
  ['Levitate', {currentAbility: 'Levitate'}, false, false], ['Eelevate', {currentAbility: 'Eelevate'}, false, false],
  ['Flying + Iron Ball', {battleTypes: ['Flying'], item: 'Iron Ball'}, false, true],
  ['Levitate + Iron Ball', {currentAbility: 'Levitate', item: 'Iron Ball'}, false, true],
  ['balloon + gravity', {item: 'Air Balloon'}, true, true],
  ['Flying + gravity', {battleTypes: ['Flying']}, true, true],
]) test(`Grassy healing: ${label}`, () => {
  const s = duel(build('venusaur', 'protect', {hp: 50, ...overrides}), build('pikachu', ''), 'Grassy');
  s.field.gravity = gravity;
  const max = makePokemon(s.actors[0], catalog).maxHP(), hp = Math.floor(max / 2);
  const expected = (hp + (heals ? Math.floor(max / 16) : 0)) / max * 100;
  assert.equal(run(s).afterEnd[0].min, expected);
  assert.equal(groundedOnTerrain(s.actors[0], s, catalog), heals);
});
test('A balloon popped by a real hit allows healing later in that turn', () => {
  const s = duel(build('venusaur', 'energyball', {hp: 50, item: 'Air Balloon'}), build('pikachu', 'quickattack'), 'Grassy');
  const r = run(s), max = makePokemon(s.actors[0], catalog).maxHP();
  assert(Math.abs(r.afterEnd[0].mean - r.afterAction[0].mean - Math.floor(max / 16) / max * 100) < 1e-8);
});
test('Mimicry uses the terrain type for grounding and healing', () => {
  const s = duel(build('venusaur', 'protect', {hp: 50, currentAbility: 'Mimicry'}), build('pikachu', ''), 'Grassy');
  // Raw species Flying typing is replaced by Mimicry before terrain effects.
  const custom = {...catalog, pokemon: catalog.pokemon.map(p => p.id === 'venusaur' ? {...p, types: ['Flying']} : p)};
  assert.equal(groundedOnTerrain(s.actors[0], s, custom), true);
  assert(run(s).afterEnd[0].mean > run(s).afterAction[0].mean);
});
