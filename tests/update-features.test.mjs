import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBuild, defaultScene, resetBattleState } from '../src/model.mjs';
import { openingBranches } from '../src/opening.mjs';
import { damageFor, simulateTurn } from '../src/engine.mjs';
import { analyzeTeam } from '../src/team-analysis.mjs';
import { validateTeamFeed } from '../src/team-feed.mjs';
import { exportPayload, parseImport } from '../src/storage.mjs';
import { initialLanguage } from '../src/language-preference.mjs';

const catalog=JSON.parse(readFileSync(new URL('../src/data/catalog.json',import.meta.url)));
const bundled=JSON.parse(readFileSync(new URL('../src/data/open-teams.json',import.meta.url)));
const localeNames=JSON.parse(readFileSync(new URL('../src/data/locale-names.json',import.meta.url)));

test('first visit follows device language and later keeps the saved choice',()=>{
  assert.equal(initialLanguage(null,'zh-TW'),'zhHant');
  assert.equal(initialLanguage(null,'zh-HK'),'zhHant');
  assert.equal(initialLanguage(null,'zh-Hant-CN'),'zhHant');
  assert.equal(initialLanguage(null,'zh-Hans-TW'),'zhHans');
  assert.equal(initialLanguage(null,'ja-JP'),'ja');
  assert.equal(initialLanguage(null,'ko-KR'),'ko');
  assert.equal(initialLanguage(null,'en-US'),'zhHans');
  assert.equal(initialLanguage('ja','ko-KR'),'ja');
});

test('new configurations start at zero, empty defender moves are passive, and reset keeps the chosen set',()=>{
  const scene=defaultScene(catalog);
  assert.ok(scene.actors.every(actor=>Object.values(actor.points).every(value=>value===0)));
  assert.deepEqual(scene.actors[2].moves,['','','','']);
  scene.actors[0].points.atk=32;scene.actors[0].item='Leftovers';scene.actors[0].nature='Adamant';
  scene.actors[0].hp=25;scene.actors[0].status='brn';scene.actors[0].boosts.atk=3;
  scene.actors[2].protected=true;scene.field.trickRoom=true;scene.field.terrain='Electric';
  const reset=resetBattleState(scene,catalog);
  assert.equal(reset.actors[0].points.atk,32);assert.equal(reset.actors[0].item,'Leftovers');assert.equal(reset.actors[0].nature,'Adamant');
  assert.deepEqual(reset.actors[0].moves,scene.actors[0].moves);assert.equal(reset.actors[0].hp,100);
  assert.equal(reset.actors[0].status,'');assert.equal(reset.actors[0].boosts.atk,0);assert.equal(reset.actors[2].protected,false);
  assert.equal(reset.field.trickRoom,false);assert.equal(reset.field.terrain,'');assert.equal(reset.field.weatherMode,'auto');
});

test('automatic terrain reads entry abilities while manual terrain stays in control',()=>{
  const scene=defaultScene(catalog);scene.actors[0]=createBuild(catalog,'rillaboom');scene.actors[0].ability='Grassy Surge';
  assert.equal(openingBranches(scene,catalog)[0].scene.field.terrain,'Grassy');
  scene.field.terrainMode='manual';scene.field.terrain='Psychic';
  assert.equal(openingBranches(scene,catalog)[0].scene.field.terrain,'Psychic');
});

test('Knock Off, Final Gambit, and Steel Roller affect the rest of the turn',()=>{
  const knock=defaultScene(catalog);knock.actors[0]=createBuild(catalog,'venusaur');knock.actors[0].moves[0]='knockoff';knock.actors[2].item='Leftovers';
  const boosted=damageFor(knock.actors[0],knock.actors[2],'knockoff',knock,catalog).mean;
  knock.actors[2].item='';const plain=damageFor(knock.actors[0],knock.actors[2],'knockoff',knock,catalog).mean;
  assert.ok(boosted>plain);knock.actors[2].item='Leftovers';
  assert.ok(simulateTurn(knock,catalog).log.some(line=>line.includes('拍落了')));
  const gambit=defaultScene(catalog);gambit.actors[0]=createBuild(catalog,'lucario');gambit.actors[0].moves[0]='finalgambit';
  const fullGambit=damageFor(gambit.actors[0],gambit.actors[2],'finalgambit',gambit,catalog).dist[0].damage;
  gambit.actors[0].hp=50;
  assert.ok(damageFor(gambit.actors[0],gambit.actors[2],'finalgambit',gambit,catalog).dist[0].damage<fullGambit);
  assert.equal(simulateTurn(gambit,catalog).afterAction[0].max,0);
  const roller=defaultScene(catalog);roller.actors[0]=createBuild(catalog,'steelix');roller.actors[0].moves[0]='steelroller';
  assert.equal(damageFor(roller.actors[0],roller.actors[2],'steelroller',roller,catalog).max,0);
  roller.field.terrainMode='manual';roller.field.terrain='Grassy';
  assert.ok(simulateTurn(roller,catalog).log.some(line=>line.includes('铁滚轮清除了场地')));
});

test('old backups remain importable and six-member teams roundtrip',()=>{
  const team={id:'my-team',name:'测试队伍',members:['venusaur','charizard','blastoise','garchomp','pikachu','dragonite'].map(id=>createBuild(catalog,id))};
  assert.equal(parseImport(JSON.stringify(exportPayload([],[],[team]))).teams[0].members.length,6);
  const old=exportPayload([],[]);delete old.teams;
  assert.deepEqual(parseImport(JSON.stringify(old)).teams,[]);
  assert.ok(analyzeTeam(team.members,catalog).every(row=>row.reasons.length>0));
});

test('online feed retains every embedded team and rejects missing entries',()=>{
  assert.equal(validateTeamFeed(bundled,bundled,catalog).teams.length,bundled.teams.length);
  const incomplete=structuredClone(bundled);incomplete.teams.pop();
  assert.throws(()=>validateTeamFeed(bundled,incomplete,catalog),/缺少已有阵容/);
});

test('offline game names cover every selectable entry and distinguish Mega forms',()=>{
  for(const [kind,entries] of Object.entries({pokemon:catalog.pokemon,moves:Object.values(catalog.moves),abilities:catalog.abilities,items:catalog.items,natures:catalog.natures})){
    for(const entry of entries)for(const language of ['zhHant','ja','ko'])assert.ok(localeNames[kind][entry.id]?.[language],`${kind}/${entry.id}/${language}`);
  }
  for(const language of ['zhHant','ja','ko'])assert.notEqual(localeNames.pokemon.charizardmegax[language],localeNames.pokemon.charizardmegay[language]);
});
