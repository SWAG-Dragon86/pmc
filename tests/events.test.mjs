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

test('Cud Chew is inert in the one-turn calculator and does not block normal berry use',()=>{
 const s=defaultScene(c);s.actors[0]=b('pikachu','quickattack','Static');
 s.actors[2]=b('farigiraf','psychic','Cud Chew');s.actors[2].item='Sitrus Berry';s.actors[2].hp=50;
 const r=simulateTurn(s,c);assert.equal(r.error,undefined);
 assert.equal(r.log.filter(x=>x.includes('文柚果回复')).length,1);
 assert(!r.log.some(x=>x.includes('反刍')));
});

test('Battle Bond is inert after a KO in the one-turn calculator',()=>{
 const s=defaultScene(c);s.actors[0]=b('greninja','waterpulse','Battle Bond');
 s.actors[0].boosts.spa=6;s.actors[2]=b('pikachu','reflect','Static');s.actors[2].hp=1;
 const r=simulateTurn(s,c);assert.equal(r.error,undefined);assert.equal(r.endKO,100);
 assert(!r.log.some(x=>x.includes('牵绊变身')));
});

test('Toxic Debris is inert when the one-turn calculator has no switching',()=>{
 const s=defaultScene(c);s.actors[0]=b('pikachu','quickattack','Static');
 s.actors[2]=b('glimmora','powergem','Toxic Debris');
 const r=simulateTurn(s,c);assert.equal(r.error,undefined);assert(r.damage.mean>0);
 assert(!r.log.some(x=>x.includes('毒满地')));
});

test('Ripen doubles healing berries and strengthens resistance berries',()=>{
 const normal=defaultScene(c);normal.actors[0]=b('pikachu','quickattack','Static');
 normal.actors[2]=b('appletun','sunnyday','Gluttony');normal.actors[2].item='Sitrus Berry';normal.actors[2].hp=25;
 const ripe=structuredClone(normal);ripe.actors[2].ability='Ripen';
 const normalTurn=simulateTurn(normal,c),ripeTurn=simulateTurn(ripe,c);
 assert.equal(normalTurn.error,undefined);assert.equal(ripeTurn.error,undefined);
 assert(ripeTurn.remaining.mean>normalTurn.remaining.mean+20);
 const iceAttacker=b('weavile','icepunch','Pressure'),normalIce=structuredClone(normal.actors[2]),ripeIce=structuredClone(ripe.actors[2]);
 normalIce.item='Yache Berry';ripeIce.item='Yache Berry';
 assert(damageFor(iceAttacker,ripeIce,'icepunch',ripe,c).mean<damageFor(iceAttacker,normalIce,'icepunch',normal,c).mean);
 const resistTurn=defaultScene(c);resistTurn.actors[0]=iceAttacker;resistTurn.actors[0].boosts.atk=-6;
 resistTurn.actors[2]=b('appletun','sunnyday','Ripen');resistTurn.actors[2].item='Yache Berry';
 const resistResult=simulateTurn(resistTurn,c);assert.equal(resistResult.error,undefined);
 assert(resistResult.log.some(x=>x.includes('熟成后本次第一击降至四分之一')));
});

test('Cheek Pouch heals after both healing and resistance berries are consumed',()=>{
 const normal=defaultScene(c);normal.actors[0]=b('pikachu','quickattack','Static');normal.actors[0].boosts.atk=-6;
 normal.actors[2]=b('dedenne','sunnyday','Pickup');normal.actors[2].item='Sitrus Berry';normal.actors[2].hp=25;
 const cheek=structuredClone(normal);cheek.actors[2].ability='Cheek Pouch';
 const normalTurn=simulateTurn(normal,c),cheekTurn=simulateTurn(cheek,c);
 assert.equal(normalTurn.error,undefined);assert.equal(cheekTurn.error,undefined);
 assert(cheekTurn.remaining.mean>normalTurn.remaining.mean+30);
 assert.equal(cheekTurn.log.filter(x=>x.includes('颊囊回复')).length,1);
 const resistNormal=defaultScene(c);resistNormal.actors[0]=b('tinkaton','facade','Mold Breaker');resistNormal.actors[0].boosts.atk=-6;
 resistNormal.actors[2]=b('maushold','sunnyday','Friend Guard');resistNormal.actors[2].item='Chilan Berry';
 const resistCheek=structuredClone(resistNormal);resistCheek.actors[2].ability='Cheek Pouch';
 const normalResistTurn=simulateTurn(resistNormal,c),cheekResistTurn=simulateTurn(resistCheek,c);
 assert.equal(normalResistTurn.error,undefined);assert.equal(cheekResistTurn.error,undefined);
 assert(cheekResistTurn.remaining.mean>normalResistTurn.remaining.mean);
 assert.equal(cheekResistTurn.log.filter(x=>x.includes('颊囊回复')).length,1);
 const blocked=structuredClone(cheek);blocked.actors[0]=b('arbok','round','Unnerve');blocked.actors[0].boosts.spa=-6;
 const blockedTurn=simulateTurn(blocked,c);assert.equal(blockedTurn.error,undefined);
 assert(!blockedTurn.log.some(x=>x.includes('文柚果回复')||x.includes('颊囊回复')));
});

test('Parental Bond uses two ordered single-target hits but never doubles spread moves',()=>{
 const s=defaultScene(c);s.actors[0]=b('kangaskhanmega','facade','Parental Bond');s.actors[0].boosts.spe=6;
 s.actors[2]=b('garchomp','swordsdance','Rough Skin');
 const r=simulateTurn(s,c);assert.equal(r.error,undefined);
 assert.equal(r.log.filter(x=>x.includes('超级袋兽 → 烈咬陆鲨')).length,2);
 assert.equal(r.log.filter(x=>x.includes('接触反伤')).length,2);
 const sash=defaultScene(c);sash.actors[0]=b('kangaskhanmega','gigaimpact','Parental Bond');sash.actors[0].boosts.atk=6;
 sash.actors[2]=b('pikachu','reflect','Static');sash.actors[2].item='Focus Sash';
 const sashResult=simulateTurn(sash,c);assert.equal(sashResult.error,undefined);assert.equal(sashResult.endKO,100);
 assert.equal(sashResult.log.filter(x=>x.includes('气势披带触发')).length,1);
 const spread=defaultScene(c);spread.mode='double';spread.actors[0]=b('kangaskhanmega','earthquake','Parental Bond');
 assert.equal(damageFor(spread.actors[0],spread.actors[2],'earthquake',spread,c).hitDists.length,1);
});

test('Disguise blocks only the first damaging hit, loses one eighth HP, and is bypassed by Mold Breaker',()=>{
 const s=defaultScene(c);s.actors[0]=b('pikachu','thunderbolt','Static');s.actors[2]=b('mimikyu','sunnyday','Disguise');
 const first=simulateTurn(s,c);assert.equal(first.error,undefined);assert.equal(first.damage.mean,0);
 assert(first.remaining.mean<100&&first.remaining.mean>85);assert.equal(first.log.filter(x=>x.includes('画皮')).length,1);
 const multi=defaultScene(c);multi.actors[0]=b('kangaskhanmega','crunch','Parental Bond');multi.actors[0].boosts.spe=6;
 multi.actors[2]=b('mimikyu','sunnyday','Disguise');
 const multiResult=simulateTurn(multi,c);assert.equal(multiResult.error,undefined);assert(multiResult.damage.mean>0);
 assert.equal(multiResult.log.filter(x=>x.includes('超级袋兽 → 谜拟丘')).length,2);
 assert.equal(multiResult.log.filter(x=>x.includes('画皮')).length,1);
 const breaker=defaultScene(c);breaker.actors[0]=b('tinkaton','gigatonhammer','Mold Breaker');breaker.actors[0].boosts.spe=6;
 breaker.actors[2]=b('mimikyu','sunnyday','Disguise');
 const bypass=simulateTurn(breaker,c);assert.equal(bypass.error,undefined);assert(bypass.damage.mean>0);
 assert(!bypass.log.some(x=>x.includes('画皮')));
});

test('Stance Change uses Blade stats before attacking and keeps the form for later hits',()=>{
 const attack=defaultScene(c);attack.actors[0]=b('aegislash','shadowball','Stance Change');
 attack.actors[0].boosts.spe=6;attack.actors[0].boosts.spa=-6;
 attack.actors[2]=b('pikachu','thunderbolt','Static');
 const changed=simulateTurn(attack,c);assert.equal(changed.error,undefined);
 assert(changed.log.some(x=>x.includes('战斗切换')&&x.includes('刀剑形态')));
 const preview=structuredClone(attack);preview.actors[0].boosts.spa=0;
 assert(damageFor(preview.actors[0],preview.actors[2],'shadowball',preview,c).mean>90);
 const status=structuredClone(attack);status.actors[0].moves[0]='sunnyday';
 const stayedShield=simulateTurn(status,c);assert.equal(stayedShield.error,undefined);
 assert(!stayedShield.log.some(x=>x.includes('刀剑形态')));
 assert(changed.afterAction[0].mean<stayedShield.afterAction[0].mean);
});

test('same-side active forms with the same National Dex number are rejected, but opposing sides are allowed',()=>{
 const s=defaultScene(c);s.mode='double';s.actors[0]=b('charizard','flamethrower');s.actors[1]=b('charizardmegay','heatwave','Drought');
 assert(turnLimits(s,c).some(x=>x.includes('图鉴编号')));
 s.actors[1]=b('pikachu','thunderbolt');s.actors[2]=b('charizardmegax','flareblitz','Tough Claws');
 assert(!turnLimits(s,c).some(x=>x.includes('图鉴编号')));
});
