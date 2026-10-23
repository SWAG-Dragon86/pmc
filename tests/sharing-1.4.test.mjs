import test from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import catalog from '../src/data/catalog.json' with {type:'json'};
import feed from '../src/data/open-teams.json' with {type:'json'};
import { createBuild, defaultScene, withMandatoryActions, uid } from '../src/model.mjs';
import { encodeShare, decodeShare } from '../src/share-code.mjs';
import { fetchTeamFeed, newestFeed, sameTeams } from '../src/team-feed.mjs';
import { sharingWords, buildName, localTime } from '../src/sharing-language.mjs';
import { simulateTurn } from '../src/engine.mjs';
import { readFileSync } from 'node:fs';
import { shareBalls,ballPalette,ballName,selectedShareBall } from '../src/share-balls.mjs';
import { TYPES } from '../src/model.mjs';

function team() {return {id:uid(),name:'队伍 · チーム · 팀 · Team',members:['tyranitar','excadrill','salamence','milotic','rillaboom','indeedeef'].map(id=>createBuild(catalog,id))};}
test('a single share restores its fixed build without copying temporary battle state',()=>{
  const build=createBuild(catalog,'indeedeef');build.ability='Psychic Surge';build.points={hp:32,atk:0,def:32,spa:0,spd:2,spe:0};build.nature='Relaxed';
  build.hp=37;build.boosts.spa=2;const restored=decodeShare(encodeShare('build',build,catalog),catalog).value;
  for(const key of ['id','name','species','ability','item','nature','points','moves','selected'])assert.deepEqual(restored[key],build[key]);
  assert.equal(restored.hp,100);assert.equal(restored.boosts.spa,0);
});
test('team codes preserve all six forms and complete configurations across UI languages',()=>{
  const original=team(),restored=decodeShare(encodeShare('team',original,catalog),catalog).value;
  assert.deepEqual(restored,original);
  for(const language of ['zhHans','zhHant','ja','ko','en'])assert(buildName(restored.members[5],catalog,language));
  assert.equal(buildName(restored.members[5],catalog,'en'),'Indeedee-F');
});
test('scene codes preserve every field, selected move, HP, boosts and fourth actor action',()=>{
  const scene=defaultScene(catalog);scene.mode='double';scene.actors[0].hp=73;scene.actors[1].boosts.atk=-1;
  scene.field.weather='Rain';scene.field.weatherMode='manual';scene.field.defender.isReflect=true;
  scene.actors[3].moves=['protect','','',''];scene.actors[3].actionEnabled=true;
  const restored=decodeShare(encodeShare('scene',scene,catalog),catalog).value;
  assert.deepEqual(restored,scene);
});
test('corrupt and non-PMC codes cannot produce importable data',()=>{
  const code=encodeShare('team',team(),catalog);
  assert.throws(()=>decodeShare('https://example.org',catalog),/invalidCode/);
  assert.throws(()=>decodeShare(code.replace(/:[0-9A-F]{8}:/,':00000000:'),catalog),/invalidCode/);
  assert.throws(()=>decodeShare(code.slice(0,-10),catalog),/invalidCode/);
  const invalid=team();invalid.members[0].points.hp=50;assert.throws(()=>encodeShare('team',invalid,catalog));
});
test('a full six-Pokémon code is a readable QR and includes its complete configuration',()=>{
  const original=team(),code=encodeShare('team',original,catalog),qr=QRCode.create(code,{errorCorrectionLevel:'M'}),unit=5,margin=4;
  const width=(qr.modules.size+margin*2)*unit,pixels=new Uint8ClampedArray(width*width*4);pixels.fill(255);
  for(let row=0;row<qr.modules.size;row++)for(let column=0;column<qr.modules.size;column++)if(qr.modules.get(row,column)){
    for(let y=0;y<unit;y++)for(let x=0;x<unit;x++){
      const offset=(((row+margin)*unit+y)*width+(column+margin)*unit+x)*4;
      pixels[offset]=pixels[offset+1]=pixels[offset+2]=0;
    }
  }
  assert.equal(jsQR(pixels,width,width).data,code);
  assert.deepEqual(decodeShare(code,catalog).value,original);
});
test('the default fourth slot remains passive and can act when the user opts in',()=>{
  const old=defaultScene(catalog);old.mode='double';old.actors.forEach(build=>{build.moves=['protect','','',''];build.selected=0;});
  let scene=withMandatoryActions(old);assert.equal(scene.actors[3].active,false);
  const baseline=simulateTurn(scene,catalog);assert(!baseline.error);assert(!baseline.timeline.some(row=>row.actor===3));
  scene.actors[3].actionEnabled=true;scene=withMandatoryActions(scene);
  const result=simulateTurn(scene,catalog);assert(!result.error,result.error);assert(result.timeline.some(row=>row.actor===3));
  scene.actors[3].moves=['','','',''];assert.equal(withMandatoryActions(scene).actors[3].active,false);
});
test('a successful stale main response does not hide a newer mirror',async()=>{
  const old=structuredClone(feed);old.meta.updatedAt='2026-09-28';delete old.meta.checkedAt;
  const newer=structuredClone(feed);newer.meta.updatedAt='2026-10-14';newer.meta.checkedAt='2026-10-14T05:00:00Z';
  newer.teams.push({...structuredClone(newer.teams[0]),id:'qa-new-team'});
  const fetcher=async url=>({ok:true,json:async()=>String(url).includes('team-feeds.json')?{mirrors:['https://backup.example/live-teams.json']}:String(url).includes('backup.example')?newer:old});
  const result=await fetchTeamFeed(old,old,catalog,{baseUrl:'https://main.example/',fetcher});
  assert.equal(result.feed.teams.length,old.teams.length+1);assert.equal(result.changed,true);assert(result.checkedAt);
});
test('checking unchanged teams is not reported as a content update and failures keep local data',async()=>{
  const original=structuredClone(feed),newer=structuredClone(feed);newer.meta.checkedAt='2099-01-01T00:00:00Z';
  assert(sameTeams(original,newer));assert.equal(newestFeed([original,newer]),newer);
  const success=await fetchTeamFeed(feed,feed,catalog,{baseUrl:'https://main.example/',android:true,fetcher:async()=>({ok:true,json:async()=>newer})});
  assert.equal(success.changed,false);
  const before=structuredClone(feed);
  await assert.rejects(()=>fetchTeamFeed(feed,feed,catalog,{baseUrl:'https://main.example/',android:true,fetcher:async()=>{throw new Error('offline');}}),/updateFailed/);
  assert.deepEqual(feed,before);
});
test('all new labels cover five languages and device timezone formats check timestamps',()=>{
  for(const [key,translations] of Object.entries(sharingWords))assert(translations.length===5&&translations.every(value=>typeof value==='string'&&value.length),key);
  const previous=process.env.TZ;
  try{process.env.TZ='Asia/Tokyo';assert.match(localTime('2026-10-14T00:00:00Z','en'),/09:00:00/);
    process.env.TZ='Asia/Shanghai';assert.match(localTime('2026-10-14T00:00:00Z','zhHans'),/08:00:00/);
  }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('every selectable ball and move type has a valid local image and localized ball name',()=>{
  assert.equal(shareBalls.length,37);
  for(const ball of shareBalls){
    const image=readFileSync(new URL(`../public/${ball.sprite}`,import.meta.url));
    assert.equal(image.subarray(1,4).toString(),'PNG',ball.name);
    for(const language of ['zhHans','zhHant','ja','ko','en'])assert(ballName(ball,language),ball.name);
    assert(Object.values(ballPalette(ball.name)).every(color=>/^#[0-9a-f]{6}$/i.test(color)),ball.name);
  }
  for(const type of Object.keys(TYPES))assert.equal(readFileSync(new URL(`../public/types/${type.toLowerCase()}.png`,import.meta.url)).subarray(1,4).toString(),'PNG');
  assert.equal(selectedShareBall('invalid').name,'poke-ball');
  assert.equal(selectedShareBall('lastrange-ball').name,'poke-ball');
});
