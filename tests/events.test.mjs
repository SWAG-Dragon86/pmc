import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultScene,createBuild} from '../src/model.mjs';
import {simulateTurn,damageFor,turnLimits} from '../src/engine.mjs';
import {natureOptions} from '../src/natures.mjs';
const c=JSON.parse(readFileSync('src/data/catalog.json','utf8'));
const b=(id,move,ability)=>({...createBuild(c,id),moves:[move,'','',''],selected:0,...(ability?{ability}:{})});
test('Pinned nature labels have explicit increases and decreases',()=>{
 const rows=natureOptions(c.natures);assert.deepEqual(rows.slice(0,6).map(x=>x[0]),['Modest','Adamant','Timid','Jolly','Bold','Calm']);
 assert.equal(rows[0][1],'内敛（特攻↑、攻击↓）');assert.match(rows.find(x=>x[0]==='Serious')[1],/无增减/);
});
test('Sucker Punch assumes success against a status move but still respects Protect',()=>{
 const s=defaultScene(c);s.actors[0]=b('kingambit','suckerpunch','Defiant');s.actors[2]=b('pikachu','reflect');
 const r=simulateTurn(s,c);assert.equal(r.error,undefined);assert(r.damage.mean>0);
 s.actors[2].moves[0]='protect';assert.equal(simulateTurn(s,c).damage.max,0);
});
test('Brick Break clears screens before later teammate attacks without mutating inputs',()=>{
 const s=defaultScene(c);s.mode='double';s.actors[0]=b('garchomp','brickbreak');s.actors[1]=b('charizard','flamethrower');
 s.actors[0].boosts.spe=6;s.actors[2]=b('milotic','recover','Marvel Scale');s.actors[3].present=false;
 s.field.defender={isReflect:true,isLightScreen:true,isAuroraVeil:true}; const before=structuredClone(s);
 const r=simulateTurn(s,c);assert.equal(r.error,undefined);assert(r.timeline.some(x=>x.notes.some(n=>n.includes('破除'))));
 const noWalls=structuredClone(s);noWalls.field.defender={};assert.deepEqual(r.remaining,simulateTurn(noWalls,c).remaining);assert.deepEqual(s,before);
});
test('Friend Guard automatically protects only its living teammate, including when protected',()=>{
 const s=defaultScene(c);s.mode='double';s.actors[3]=b('maushold','protect','Friend Guard');s.actors[3].protected=true;
 const hit=()=>damageFor(s.actors[0],s.actors[2],'flamethrower',s,c).mean;
 const guarded=hit();s.actors[3].present=false;assert(guarded<hit());s.actors[3].present=true;s.actors[3].hp=0;assert(guarded<hit());
});
test('Timeline covers exact action probabilities and per-hit remaining HP',()=>{
 const s=defaultScene(c);s.actors[0]=b('pikachu','thunderbolt');s.actors[2]=b('pikachu','thunderbolt');
 const r=simulateTurn(s,c);assert.equal(r.error,undefined);assert(r.timeline.length>1);
 assert(Math.abs(r.timeline.filter(x=>x.step===0).reduce((n,x)=>n+x.probability,0)-100)<1e-7);
 for(const row of r.timeline){assert(row.remaining.min>=0);assert(row.remaining.max<=100);assert(row.remaining.mean>=row.remaining.min-1e-7);}
});

test('Guaranteed Snarl lowers first then Competitive raises only before the target acts',()=>{
 const s=defaultScene(c);s.actors[0]=b('arcanine','snarl','Flash Fire');s.actors[2]=b('milotic','surf','Competitive');
 s.actors[0].boosts.spe=6;
 let r=simulateTurn(s,c);assert.equal(r.error,undefined);
 const early=r.timeline.flatMap(t=>t.notes);assert(early.some(n=>n.includes('特攻 -1')));assert(early.some(n=>n.includes('好胜：特攻 +1')));
 s.actors[0].boosts.spe=-6;r=simulateTurn(s,c);assert.equal(r.error,undefined);
 assert(!r.timeline.flatMap(t=>t.notes).some(n=>n.includes('好胜')));
});

test('Probabilistic Shadow Ball drops do not trigger Competitive even when secondaries enabled',()=>{
 const s=defaultScene(c);s.actors[0]=b('gengar','shadowball');s.actors[0].secondary=true;s.actors[0].boosts.spe=6;
 s.actors[2]=b('milotic','surf','Competitive');
 const r=simulateTurn(s,c);assert.equal(r.error,undefined);
 const notes=r.timeline.flatMap(t=>t.notes);assert(notes.some(n=>n.includes('特防 -1')));assert(!notes.some(n=>n.includes('好胜')));
});

test('Hazards break Focus Sash before the first hit',()=>{
 const s=defaultScene(c);s.actors[2]=b('pikachu','reflect');s.actors[2].item='Focus Sash';s.actors[0].boosts.spa=6;
 let r=simulateTurn(s,c);assert.equal(r.error,undefined);assert(r.remaining.min>0);
 s.field.defender.isSR=true;r=simulateTurn(s,c);assert.equal(r.error,undefined);assert.equal(r.remaining.max,0);
});

test('Twin Beam runs as two sequential hits in the full turn simulator',()=>{
 const s=defaultScene(c);s.actors[0]=b('farigiraf','twinbeam','Armor Tail');s.actors[2]=b('gengar','shadowball');
 const r=simulateTurn(s,c);assert.equal(r.error,undefined);
 assert.equal(r.log.filter(x=>x.includes('双光束')).length,2);
 assert(r.damage.mean>0);
});

test('A resistance berry is consumed on the first qualifying hit and logged once',()=>{
 const s=defaultScene(c);s.actors[0]=b('farigiraf','twinbeam','Armor Tail');s.actors[2]=b('gengar','shadowball');s.actors[2].item='Payapa Berry';
 const withBerry=simulateTurn(s,c);assert.equal(withBerry.error,undefined);
 assert.equal(withBerry.log.filter(x=>x.includes('福禄果触发')).length,1);
 s.actors[2].item='';const withoutBerry=simulateTurn(s,c);
 assert(withBerry.damage.mean<withoutBerry.damage.mean);
});

test('same-side active forms with the same National Dex number are rejected, but opposing sides are allowed',()=>{
 const s=defaultScene(c);s.mode='double';s.actors[0]=b('charizard','flamethrower');s.actors[1]=b('charizardmegay','heatwave','Drought');
 assert(turnLimits(s,c).some(x=>x.includes('图鉴编号')));
 s.actors[1]=b('pikachu','thunderbolt');s.actors[2]=b('charizardmegax','flareblitz','Tough Claws');
 assert(!turnLimits(s,c).some(x=>x.includes('图鉴编号')));
});
