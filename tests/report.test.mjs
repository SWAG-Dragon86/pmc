import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultScene,createBuild} from '../src/model.mjs';
import {simulateTurn,previewDamage,damageFor} from '../src/engine.mjs';
import {buildReport,summaryTimeline} from '../src/report.mjs';
import {parseImport,exportPayload} from '../src/storage.mjs';
const c=JSON.parse(readFileSync('src/data/catalog.json','utf8'));
test('Report keeps configuration and per-action HP, omits zero/default clutter',()=>{
 const s=defaultScene(c);s.mode='double';s.actors[1].selected=3;s.actors[2].selected=3;
 const r=simulateTurn(s,c);assert.equal(r.error,undefined);
 const text=buildReport(s,r,c).map(x=>x.text).join('\n');
 assert.match(text,/集火过程/);assert.match(text,/目标剩余/);assert.match(text,/其它宝可梦/);assert.match(text,/能力点/);
 assert(!text.includes('攻击0'));assert(!text.includes('非随机要害'));assert(!text.includes('开局触发请手动设置'));
 assert.match(buildReport(s,r,c,{details:true}).map(x=>x.text).join('\n'),/路径 我方/);
});
test('Summary merges conditional distributions with probability weights',()=>{
 const base={step:0,actor:0,move:'tackle',weather:'',notes:[]};
 const rows=summaryTimeline([{...base,probability:25,damage:{min:10,max:10,mean:10},remaining:{min:90,max:90,mean:90}}, {...base,probability:75,damage:{min:20,max:20,mean:20},remaining:{min:80,max:80,mean:80}}]);
 assert.equal(rows[0].remaining.mean,82.5);assert.equal(rows[0].probability,100);
});
test('Single-move preview applies opening Intimidate once without mutating inputs',()=>{
 const s=defaultScene(c);s.actors[0]=createBuild(c,'garchomp');s.actors[0].moves=['earthquake','','',''];s.actors[2]=createBuild(c,'incineroar');s.actors[2].ability='Intimidate';
 const before=structuredClone(s),r=previewDamage(s.actors[0],s.actors[2],'earthquake',s,c);
 s.actors[0].boosts.atk=-1;assert.equal(r.mean,damageFor(s.actors[0],s.actors[2],'earthquake',s,c).mean);s.actors[0].boosts.atk=0;assert.deepEqual(s,before);
});
test('Old backups accepted unchanged; invalid hazards rejected',()=>{
 const s=defaultScene(c);delete s.openingRules;delete s.field.weatherMode;const data=exportPayload([], [s]);
 assert.deepEqual(parseImport(JSON.stringify(data)).scenes[0],s);
 s.field.attacker.spikes=4;assert.throws(()=>parseImport(JSON.stringify(exportPayload([],[s]))),/撒菱/);
});
test('Automatic Friend Guard can be disabled and re-enabled manually',()=>{
 const s=defaultScene(c);s.mode='double';s.actors[3]=createBuild(c,'maushold');s.actors[3].ability='Friend Guard';
 const hit=()=>damageFor(s.actors[0],s.actors[2],'flamethrower',s,c).mean,normal=hit();
 s.field.defender.friendGuardOverride=false;assert(hit()>normal);
 s.field.defender.friendGuardOverride=true;s.field.defender.isFriendGuard=true;assert.equal(hit(),normal);
});

test('Android manifest, settings and share report advertise the same release',()=>{
 const manifest=readFileSync('android/AndroidManifest.xml','utf8'),app=readFileSync('src/App.jsx','utf8');
 const version=manifest.match(/android:versionName="([^"]+)"/)[1];
 assert(app.includes(`安卓离线版 ${version}`));assert(app.includes(`当前版本 ${version}`));
 const s=defaultScene(c);assert(buildReport(s,simulateTurn(s,c),c).some(r=>r.text.includes(`PMC ${version}`)));
});
