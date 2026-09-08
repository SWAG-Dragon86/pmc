import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/30912/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out='output/android/qa-1.1',checks=[];
const adb=(...args)=>execFileSync(resolve('output/android-tools/adb/platform-tools/adb.exe'),['-s','emulator-5556',...args],{encoding:'utf8',windowsHide:true}).trim();
const browser=await chromium.connectOverCDP('http://127.0.0.1:9225',{noDefaults:true});
const page=browser.contexts()[0].pages()[0];page.setDefaultTimeout(15000);
const dump=()=>{adb('shell','uiautomator','dump','/sdcard/pmc-ui.xml');return adb('shell','cat','/sdcard/pmc-ui.xml');};
function tap(xml,pattern){
 const node=xml.match(/<node\b[^>]*>/g)?.find(n=>pattern.test(n));assert(node,'Native control missing: '+pattern);
 const [,a,b,c,d]=node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
 adb('shell','input','tap',String(Math.round((+a + +c)/2)),String(Math.round((+b + +d)/2)));
}
async function save(name){
 await page.waitForTimeout(500);tap(dump(),/resource-id="android:id\/button1"/);
 await page.waitForTimeout(500);checks.push(name);
}
try{
 await page.getByRole('button',{name:'设置',exact:true}).click();
 assert.match(await page.locator('body').innerText(),/安卓离线版 1\.1\.0/);checks.push('Final installed APK settings show version 1.1.0');
 await page.getByLabel('APP 屏幕方向',{exact:true}).selectOption('auto');
 const workspace=await page.evaluate(()=>localStorage.getItem('pmc.workspace.v1'));
 adb('emu','sensor','set','acceleration','9.8:0:0');await page.waitForFunction(()=>innerWidth>innerHeight);
 await page.getByRole('button',{name:'伤害计算',exact:true}).click();
 await page.locator('.pokemon-card').first().scrollIntoViewIfNeeded();await page.screenshot({path:out+'/android-auto-landscape-cards.png'});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 checks.push('Automatic rotation responds to horizontal accelerometer orientation');
 adb('emu','sensor','set','acceleration','0:9.8:0');await page.waitForFunction(()=>innerWidth<innerHeight);
 assert.equal(await page.evaluate(()=>localStorage.getItem('pmc.workspace.v1')),workspace);
 checks.push('Automatic rotation returns to portrait without changing saved scene');
 const filesBefore=adb('shell','ls','/sdcard/Download').split(/\r?\n/);
 await page.getByRole('button',{name:'保存结果图片',exact:true}).click();await save('Native PNG save dialog completes');
 const png=adb('shell','ls','/sdcard/Download').split(/\r?\n/).find(n=>n.startsWith('PMC-伤害结果-')&&n.endsWith('.png')&&!filesBefore.includes(n));assert(png);
 adb('pull','/sdcard/Download/'+png,out+'/native-result.png');
 assert.equal(readFileSync(out+'/native-result.png').subarray(1,4).toString(),'PNG');
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('button',{name:'完整导出',exact:true}).click();
 await page.waitForTimeout(500);
 // Give this test a unique filename, avoiding any overwrite of prior exports.
 const xml=dump();tap(xml,/resource-id="android:id\/title"[^>]*class="android.widget.EditText"/);
 adb('shell','input','keyevent','123');adb('shell','input','keyevent','--longpress','67');
 // The picker initially selects the filename; use Ctrl+A then a simple ASCII test name.
 const backupName=`PMC-1.1-QA-${Date.now()}.json`;
 adb('shell','input','keycombination','113','29');adb('shell','input','text',backupName);
 await save('Native JSON save dialog completes');
 const backup=JSON.parse(adb('shell','cat','/sdcard/Download/'+backupName));assert.equal(backup.format,'PMC');assert(backup.builds.length>=2);
 writeFileSync(out+'/native-export.json',JSON.stringify(backup,null,2));
 checks.push('Exported JSON contains the upgraded saved configurations');
 writeFileSync(out+'/native-extra-checks.json',JSON.stringify({checks},null,2));
 checks.forEach(c=>console.log('PASS',c));
}finally{await browser.close();}
