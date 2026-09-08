import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultScene,createBuild} from '../src/model.mjs';
import {openingBranches,entrySpeed,applyOpponentBoost,OPENING_RULES} from '../src/opening.mjs';
const c=JSON.parse(readFileSync('src/data/catalog.json','utf8'));
const build=(id,ability)=>({...createBuild(c,id),...(ability?{ability}: {})});
test('New scenes use the current opening rules version',()=>assert.equal(defaultScene(c).openingRules,OPENING_RULES));
test('Opening weather uses slowest living setter even protected; no input mutation',()=>{
 const s=defaultScene(c);s.actors[0]=build('charizardmegay');s.actors[2]=build('pelipper','Drizzle');
 s.actors[2].protected=true; const before=structuredClone(s);
 assert.equal(openingBranches(s,c)[0].scene.field.weather,'Rain');assert.deepEqual(s,before);
 s.actors[2].present=false;assert.equal(openingBranches(s,c)[0].scene.field.weather,'Sun');
});
test('Opening speed ignores stages, paralysis and Tailwind but includes items',()=>{
 const a=build('charizardmegay'); const n=entrySpeed(a,c);a.boosts.spe=6;a.status='par';
 assert.equal(entrySpeed(a,c),n);a.item='Choice Scarf';assert.equal(entrySpeed(a,c),Math.floor(n*1.5));
 a.item='Iron Ball';assert.equal(entrySpeed(a,c),Math.floor(n/2));
});
test('Equal-speed opposing weather branches equally and manual override wins',()=>{
 const s=defaultScene(c); s.actors[0]=build('torkoal','Drought');s.actors[2]=build('torkoal','Drizzle');
 const branches=openingBranches(s,c);assert.equal(branches.length,2);assert.deepEqual(branches.map(x=>x.p),[.5,.5]);
 assert.deepEqual(new Set(branches.map(x=>x.scene.field.weather)),new Set(['Sun','Rain']));
 s.field.weatherMode='manual';s.field.weather='Snow';assert.equal(openingBranches(s,c)[0].scene.field.weather,'Snow');
});
test('Intimidate lowers before Defiant and Competitive, once per setter on both sides',()=>{
 const s=defaultScene(c);s.mode='double';s.actors[0]=build('incineroar','Intimidate');s.actors[1]=build('arcanine','Intimidate');
 s.actors[2]=build('kingambit','Defiant');s.actors[3]=build('milotic','Competitive');
 const a=openingBranches(s,c)[0].scene.actors;assert.equal(a[2].boosts.atk,2);assert.equal(a[3].boosts.atk,-2);assert.equal(a[3].boosts.spa,4);
 s.actors[2]=build('annihilape','Inner Focus');assert.equal(openingBranches(s,c)[0].scene.actors[2].boosts.atk,0);
});
test('Both sides hazards apply once before actions, protect does not block entry damage',()=>{
 const s=defaultScene(c);s.field.attacker={isSR:true,spikes:3};s.field.defender={isSR:true,spikes:1};s.actors[0].protected=true;
 const before=structuredClone(s), b=openingBranches(s,c)[0];
 assert.equal(b.hp[0],b.max[0]-Math.floor(b.max[0]/2)); // Fire/Flying: 4x rock, no Spikes
 assert.equal(b.hp[2],b.max[2]-2*Math.floor(b.max[2]/8));
 assert.deepEqual(s,before);
 s.actors[2].ability='Magic Guard';assert.equal(openingBranches(s,c)[0].hp[2],b.max[2]);
});
test('Stat-drop immunity, lower bound and deterministic pre-action trigger',()=>{
 const s=defaultScene(c);s.actors[2]=build('kingambit','Defiant');
 const state={scene:s,hp:[100,100,100,100],done:[],log:[]};
 applyOpponentBoost(state,0,2,{atk:-1},'招式',false);assert.equal(s.actors[2].boosts.atk,-1);
 applyOpponentBoost(state,0,2,{atk:-1},'招式',true);assert.equal(s.actors[2].boosts.atk,0);
 state.done=[2];applyOpponentBoost(state,0,2,{atk:-1},'招式',true);assert.equal(s.actors[2].boosts.atk,-1);
 s.actors[2].boosts.atk=-6;state.done=[];applyOpponentBoost(state,0,2,{atk:-1},'招式',true);assert.equal(s.actors[2].boosts.atk,-6);
});

test('A weather setter knocked out by entry hazards does not set weather',()=>{
 const s=defaultScene(c);s.actors[0]=build('charizardmegay');s.actors[2]=build('pelipper','Drizzle');
 s.actors[2].hp=1;s.field.defender.isSR=true;
 const r=openingBranches(s,c)[0];assert.equal(r.hp[2],0);assert.equal(r.scene.field.weather,'Sun');
});

test('Supersweet Syrup lowers both opposing evasion stages and immediately triggers reactive abilities',()=>{
 const s=defaultScene(c);s.mode='double';s.actors[0]=build('hydrapple','Supersweet Syrup');
 s.actors[1]=build('pikachu');s.actors[2]=build('kingambit','Defiant');s.actors[3]=build('milotic','Competitive');
 const r=openingBranches(s,c)[0],a=r.scene.actors;
 assert.equal(a[2].boosts.evasion,-1);assert.equal(a[2].boosts.atk,2);
 assert.equal(a[3].boosts.evasion,-1);assert.equal(a[3].boosts.spa,2);
 assert(r.openingLog.some(x=>x.includes('甘露之蜜')));
});

test('Sticky Web affects grounded entrants, triggers Defiant, and does not change opening weather speed comparison',()=>{
 const s=defaultScene(c);s.mode='double';s.field.attacker.stickyWeb=true;
 s.actors[0]=build('kingambit','Defiant');s.actors[1]=build('charizardmegay');
 s.actors[2]=build('pelipper','Drizzle');s.actors[3]=build('pikachu');
 const r=openingBranches(s,c)[0],a=r.scene.actors;
 assert.equal(a[0].boosts.spe,-1);assert.equal(a[0].boosts.atk,2);
 assert.equal(a[1].boosts.spe,0);assert.equal(r.scene.field.weather,'Rain');
});
