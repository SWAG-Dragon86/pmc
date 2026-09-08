import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createBuild,defaultScene,validateBuild} from '../src/model.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/30912/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const catalog=JSON.parse(readFileSync('src/data/catalog.json','utf8'));
const out='output/android/qa-1.1';mkdirSync(out,{recursive:true});
const mode=process.argv[2]||'web',checks=[],errors=[];
const adb=(...args)=>execFileSync(resolve('output/android-tools/adb/platform-tools/adb.exe'),['-s','emulator-5556',...args],{encoding:'utf8',windowsHide:true}).trim();
const browser=mode==='web'?await chromium.launch({headless:true,executablePath:'C:/Users/30912/AppData/Local/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe',args:['--disable-gpu']}):await chromium.connectOverCDP('http://127.0.0.1:9225',{noDefaults:true});
const page=mode==='web'?await (await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true})).newPage():browser.contexts()[0].pages()[0];
page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name);}
async function appearance(){return page.evaluate(async()=>{
 const db=await new Promise((res,rej)=>{const r=indexedDB.open('pmc-appearance',1);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
 const files=await new Promise((res,rej)=>{const r=db.transaction('assets').objectStore('assets').getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});db.close();
 return Promise.all(files.map(async b=>({size:b.size,type:b.type,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await b.arrayBuffer()))),bytes:b.size})));
});}
async function enable(){const button=page.getByRole('button',{name:'启用社区试算',exact:true});if(await button.count())await button.click();await page.locator('.damage-hero').waitFor();}
async function layout(){return page.locator('.pokemon-card').evaluateAll(cards=>cards.map(c=>{const r=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width};}));}
try {
 if(mode==='before') {
   await page.evaluate(async()=>{
     const blob=await (await fetch('/rotom-icon-32.png')).blob();
     const db=await new Promise(res=>{const r=indexedDB.open('pmc-appearance',1);r.onupgradeneeded=()=>r.result.createObjectStore('assets');r.onsuccess=()=>res(r.result);});
     await new Promise((res,rej)=>{const t=db.transaction('assets','readwrite');t.objectStore('assets').put(blob,'background-portrait');t.oncomplete=res;t.onerror=()=>rej(t.error);});db.close();
   });
   writeFileSync(out+'/before.json',JSON.stringify({workspace:await page.evaluate(()=>localStorage.getItem('pmc.workspace.v1')),appearance:await appearance()},null,2));
   checks.push('Old version workspace and binary background snapshot captured');
 } else if(mode==='android') {
   await page.getByTestId('workspace-heading').waitFor();
   const before=JSON.parse(readFileSync(out+'/before.json','utf8'));
   await check('1.0.0 to 1.1.0 upgrade preserves all saved workspace records',async()=>assert.deepEqual(JSON.parse(await page.evaluate(()=>localStorage.getItem('pmc.workspace.v1'))),JSON.parse(before.workspace)));
   await check('Upgrade preserves custom background bytes',async()=>assert.deepEqual(await appearance(),before.appearance));
   await check('Old scene warning is visible without deleting or resetting records',async()=>assert.match(await page.locator('.legacy-opening-notice').innerText(),/威吓前/));
   adb('shell','svc','wifi','disable');adb('shell','svc','data','disable');await page.reload();await enable();
   await check('Offline release APK computes on Android',async()=>assert.match(await page.locator('.damage-hero').innerText(),/%/));
   await page.getByRole('button',{name:'设置',exact:true}).click();
   await page.getByLabel('APP 屏幕方向',{exact:true}).selectOption('landscape');
   await page.waitForFunction(()=>innerWidth>innerHeight);
   await page.getByRole('button',{name:'伤害计算',exact:true}).click();
   await check('Native landscape rotates real viewport and arranges combatants side by side',async()=>{const r=await layout();assert(Math.abs(r[0].y-r[1].y)<2);assert(r[1].x>r[0].x);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));});
   await page.screenshot({path:out+'/android-landscape.png'});
   await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByLabel('APP 屏幕方向',{exact:true}).selectOption('portrait');await page.waitForFunction(()=>innerWidth<innerHeight);
   await page.getByRole('button',{name:'伤害计算',exact:true}).click();
   await check('Native portrait restores vertical layout',async()=>{const r=await layout();assert(r[1].y>r[0].y);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));});
   await page.screenshot({path:out+'/android-portrait.png'});
   await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByLabel('APP 屏幕方向',{exact:true}).selectOption('auto');
   assert.equal(await page.evaluate(()=>PMCAndroid.getScreenMode()),'auto');checks.push('Native automatic rotation preference persists');
 } else {
   await page.goto('http://127.0.0.1:4188/');await page.getByTestId('workspace-heading').waitFor();
   const scene=defaultScene(catalog);scene.mode='double';scene.name='双打集火验证';
   scene.actors[0]=createBuild(catalog,'charizardmegay');scene.actors[0].moves=['heatwave','','',''];
   scene.actors[1]=createBuild(catalog,'garchomp');scene.actors[1].moves=['rockslide','','',''];
   scene.actors[2]=createBuild(catalog,'kingambit');scene.actors[2].ability='Defiant';scene.actors[2].moves=['suckerpunch','','',''];
   scene.actors[3]=createBuild(catalog,'maushold');scene.actors[3].ability='Friend Guard';scene.actors[3].moves=['protect','','',''];
   for(const b of scene.actors)assert.deepEqual(validateBuild(b,catalog),[],'UI fixtures must use the current Champions catalog');
   await page.evaluate(s=>localStorage.setItem('pmc.workspace.v1',JSON.stringify({scene:s,builds:[],scenes:[],theme:'light'})),scene);await page.reload();await enable();
   await check('Automatic opening weather and sorted nature labels appear',async()=>{
     assert.match(await page.locator('.weather-readout').innerText(),/晴天/);
     assert.deepEqual(await page.getByLabel('性格 1',{exact:true}).locator('option').allTextContents().then(a=>a.slice(0,6)),['内敛（特攻↑、攻击↓）','固执（攻击↑、特攻↓）','胆小（速度↑、攻击↓）','爽朗（速度↑、特攻↓）','大胆（防御↑、攻击↓）','温和（特防↑、攻击↓）']);
   });
   await page.locator('.field-details').filter({hasText:'墙、顺风'}).locator('summary').click();
   const guard=page.locator('.switch-grid').nth(1).getByRole('checkbox',{name:'友情防守',exact:true});
   await check('Friend Guard is auto-checked and remains manually toggleable',async()=>{assert(await guard.isChecked());await guard.uncheck();assert(!await guard.isChecked());await guard.check();assert(await guard.isChecked());});
   await guard.uncheck();await page.getByLabel('特性 4',{exact:true}).selectOption('Cheek Pouch');assert(!await guard.isChecked());
   await page.getByLabel('特性 4',{exact:true}).selectOption('Friend Guard');assert(await guard.isChecked());checks.push('Selecting Friend Guard teammate resets the checkbox to automatic on');
   await page.getByLabel('天气',{exact:true}).selectOption('Rain');assert.match(await page.locator('.weather-readout').innerText(),/手动天气：雨天/);
   await page.getByLabel('天气',{exact:true}).selectOption('auto');
   await page.locator('.hazard-options summary').click();await page.getByLabel('我方隐形岩',{exact:true}).check();await page.getByLabel('对方隐形岩',{exact:true}).check();await page.getByLabel('对方撒菱层数',{exact:true}).selectOption('2');
   checks.push('Both sides hazards and manual-to-automatic weather controls work');
   await page.getByLabel('我方隐形岩',{exact:true}).uncheck();await page.getByLabel('对方隐形岩',{exact:true}).uncheck();await page.getByLabel('对方撒菱层数',{exact:true}).selectOption('0');
   for(const viewport of [{width:390,height:844},{width:844,height:390},{width:667,height:375},{width:1440,height:900}]){
     await page.setViewportSize(viewport);await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+1);
     const r=await layout();if(viewport.width>viewport.height&&viewport.width<1100){assert(Math.abs(r[0].y-r[1].y)<2);assert(r[1].x>r[0].x);}if(viewport.width===390)assert(r[1].y>r[0].y);
     await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+`/web-${viewport.width}.png`});checks.push(`Web layout ${viewport.width}x${viewport.height}`);
   }
   await page.locator('.damage-hero').waitFor();
   for(const [button,file] of [['保存结果图片','summary.png'],['导出分支详情图片','branches.png']]){
     const waiting=page.waitForEvent('download');await page.getByRole('button',{name:button,exact:true}).click();const download=await waiting;await download.saveAs(out+'/'+file);checks.push(button+' PNG saved');
   }
 }
 assert.deepEqual(errors,[]);writeFileSync(out+`/${mode}-checks.json`,JSON.stringify({checks,errors},null,2));
} finally {await browser.close();}
