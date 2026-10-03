import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import catalog from '../src/data/catalog.json' with { type: 'json' };
import { chooseOcrEntry, chooseOcrEntryInBlock, mergeTeamScreenshots, natureFromArrows } from '../src/team-image-import.mjs';
import { setPointWithinLimit } from '../src/model.mjs';

const species = ['tyranitar','excadrill','salamence','milotic','rillaboom','armarouge'];
const members = order => order.map(id => ({ species:id, ability: catalog.pokemon.find(p => p.id === id).abilities[0], item:'', moves: catalog.pokemon.find(p => p.id === id).moves.slice(0,4), nature:'Serious', points:{hp:0,atk:0,def:0,spa:0,spd:0,spe:0} }));

test('sample screenshot names match all six Pokémon through OCR noise', () => {
  const raw = ['班 基 拉 斯 品 国','龙头 地 电 9','暴 飞龙 9','美 纳 斯 9','育 擂 金刚 猩 9，','红 莲 铅 骑 9'];
  assert.deepEqual(raw.map(value => chooseOcrEntry(value,catalog.pokemon,'pokemon','zhHans',0.63)?.entry.id), species);
});

test('whole-card fallback recovers the six sample items without using team-specific guesses',()=>{
  const scans=['扁 樱 果','下 克 头 地 鼠\n拨 沙\n气势 披 带','暴 臣\n威吓\n暴 飞 龙 进化 石','美 纳 斯\n好 竹\n鲍 文 柚 困','青草 制造 者\n奇 迹 种 子','红 连 记 好\n引火\n青草 种 子'];
  const expected=['Tanga Berry','Focus Sash','Salamencite','Sitrus Berry','Miracle Seed','Grassy Seed'];
  assert.deepEqual(scans.map(text=>chooseOcrEntryInBlock(text,catalog.items,'items','zhHans')?.entry.name),expected);
});

test('two screenshots pair by species rather than card order and keep no item', () => {
  const rows = mergeTeamScreenshots([
    {kind:'ability',members:members(species)},
    {kind:'status',members:members([...species].reverse())},
  ],catalog);
  assert.deepEqual(rows.map(row=>row.build.species),species);
  assert.ok(rows.every(row=>row.build.item===''));
  assert.ok(rows.every(row=>!row.review.includes('item')));
});

test('different six-member rosters cannot overwrite the current team', () => {
  const other = [...species]; other[5] = 'pikachu';
  assert.throws(()=>mergeTeamScreenshots([
    {kind:'ability',members:members(species)},
    {kind:'status',members:members(other)},
  ],catalog),/不是完全相同/);
});

test('one screenshot uses defaults for missing page and unknown points require review', () => {
  const status = members(species); status[0].points.hp = null;
  const rows = mergeTeamScreenshots([{kind:'status',members:status}],catalog);
  assert.equal(rows[0].build.ability,catalog.pokemon.find(p=>p.id==='tyranitar').abilities[0]);
  assert.equal(rows[0].build.points.hp,0);
  assert.ok(rows[0].review.includes('hp'));
  assert.ok(rows[0].review.includes('pointsTotal'));
});

test('nature arrow pairing reads stat direction', () => {
  assert.equal(natureFromArrows('atk','spa',catalog),'Adamant');
  assert.equal(natureFromArrows('spe','atk',catalog),'Timid');
  assert.equal(natureFromArrows(null,null,catalog),'Serious');
});

test('Stat Points stop at 66 while legacy over-budget values can be lowered', () => {
  const points={hp:30,atk:31,def:0,spa:0,spd:0,spe:3};
  assert.equal(setPointWithinLimit(points,'spe',10).spe,5);
  const legacy={...points,spe:10};
  assert.equal(setPointWithinLimit(legacy,'spe',9).spe,9);
  assert.equal(setPointWithinLimit(legacy,'spe',11).spe,10);
});

test('Android allows local OCR WebAssembly without enabling JavaScript eval', () => {
  const java=readFileSync(new URL('../android/src/cn/pmc/calculator/MainActivity.java',import.meta.url),'utf8');
  const policy=java.match(/headers\.put\("Content-Security-Policy", "([^"]+)"\)/)?.[1];
  assert.ok(policy);
  assert.match(policy,/script-src 'self' 'wasm-unsafe-eval'/);
  assert.ok(!policy.includes(" 'unsafe-eval'"));
});
