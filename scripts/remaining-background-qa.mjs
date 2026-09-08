import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createBuild, defaultScene } from '../src/model.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/30912/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const catalog = JSON.parse(await readFile('src/data/catalog.json','utf8'));
const scene = defaultScene(catalog);
scene.actors[0]=createBuild(catalog,'charizardmegay');scene.actors[0].points.spa=0;
scene.actors[0].moves=['flamethrower','','',''];
scene.actors[2]=createBuild(catalog,'lycanrocdusk');scene.actors[2].moves=['accelerock','','',''];
scene.actors[2].ability='Tough Claws';scene.actors[2].active=false;
const browser = await chromium.launch({headless:true, executablePath:process.env.PMC_BROWSER_PATH || 'C:/Users/30912/AppData/Local/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe',args:['--disable-gpu']});
const context=await browser.newContext({viewport:{width:1440,height:1050},colorScheme:'light',acceptDownloads:true});
await context.addInitScript(scene=>{
  if(!localStorage.getItem('pmc.workspace.v1')) localStorage.setItem('pmc.workspace.v1',JSON.stringify({scene,builds:[scene.actors[2]],scenes:[scene],theme:'light'}));
},scene);
const page=await context.newPage();const checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name);}
const settings=()=>page.getByRole('button',{name:'设置',exact:true}).click();
const background=()=>page.locator('.fixed-background').evaluate(e=>e.style.backgroundImage);
async function matchesPreview(orientation){
  await page.waitForFunction(orientation=>document.querySelector('.fixed-background').style.backgroundImage===document.querySelector(`.background-preview.${orientation}`).style.backgroundImage,orientation);
}
try {
  await page.goto('http://127.0.0.1:4173/');
  await page.getByTestId('workspace-heading').waitFor();
  await check('Legacy inactive defender acts first; main result is remaining 100%',async()=>{
    await page.getByRole('button',{name:'启用社区试算',exact:true}).click();
    await page.locator('.damage-hero').waitFor();
    assert.match(await page.locator('.damage-hero > strong').innerText(),/^100\.0%/);
    assert.match(await page.locator('.damage-hero > small').innerText(),/回合末所剩血量/);
    await page.locator('.pokemon-card').last().getByRole('button',{name:'能力阶段与行动设置'}).click();
    assert.equal(await page.getByText('本回合行动',{exact:true}).count(),0);
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('pmc.workspace.v1')).scene.actors[2].active===true);
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('pmc.workspace.v1')));
    assert.equal(saved.scenes[0].actors[2].active,false,'saved snapshots remain unchanged');
    assert.equal(saved.builds.length,1);
  });
  await check('Export PNG shows remaining HP and automatic action',async()=>{
    await page.evaluate(()=>{
      window.pmcDrawnText=[];
      const original=CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.pmcDrawnText.push(text);return original.call(this,text,...args);};
    });
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'保存结果图片',exact:true}).click();
    await(await download).saveAs('output/playwright/remaining-result.png');
    const text=await page.evaluate(()=>window.pmcDrawnText.join('\n'));
    assert.match(text,/100\.0% – 100\.0%/);
    assert.match(text,/回合末所剩血量/);
    assert.doesNotMatch(text,/累计实际损血|不主动行动/);
  });
  await settings();
  await check('Landscape and portrait files persist separately and switch on rotation',async()=>{
    await page.getByLabel('横屏背景文件',{exact:true}).setInputFiles('public/backgrounds/pmc-default-pokeball.png');
    await page.waitForFunction(()=>document.querySelector('.background-preview.landscape').style.backgroundImage.includes('blob:'));
    await matchesPreview('landscape');
    await page.getByLabel('竖屏背景文件',{exact:true}).setInputFiles('public/icon-512.png');
    await page.waitForFunction(()=>document.querySelector('.background-preview.portrait').style.backgroundImage.includes('blob:'));
    const landscape=await background();
    await page.screenshot({path:'output/playwright/backgrounds-desktop.png',fullPage:true,animations:'disabled'});
    await page.setViewportSize({width:375,height:850});await matchesPreview('portrait');
    assert.notEqual(await background(),landscape);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:'output/playwright/backgrounds-mobile.png',fullPage:true,animations:'disabled'});
    await page.reload();await settings();
    await page.waitForFunction(()=>document.querySelector('.background-preview.portrait').style.backgroundImage.includes('blob:'));
    await matchesPreview('portrait');
    await page.setViewportSize({width:850,height:375});await matchesPreview('landscape');
  });
  await check('One image is shared across orientations; reset clears both slots',async()=>{
    await page.getByRole('button',{name:'清除竖屏背景',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('.background-preview.portrait').style.backgroundImage);
    await page.setViewportSize({width:375,height:850});await matchesPreview('landscape');
    await page.getByRole('button',{name:'恢复默认',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('.fixed-background').style.backgroundImage);
    await page.reload();await settings();
    assert.equal(await background(),'');
  });
  await check('Mobile result uses the same remaining HP as desktop',async()=>{
    await page.getByRole('button',{name:'伤害计算',exact:true}).click();
    await page.getByRole('button',{name:'启用社区试算',exact:true}).click();
    await page.locator('.damage-hero').waitFor();
    assert.match(await page.locator('.mobile-result small').innerText(),/回合末所剩血量/);
    assert.equal(await page.locator('.mobile-result strong').innerText(),await page.locator('.damage-hero > strong').innerText());
    await page.screenshot({path:'output/playwright/remaining-mobile.png',fullPage:true,animations:'disabled'});
  });
  assert.deepEqual(errors,[]);
} finally {await writeFile('output/playwright/remaining-background-report.json',JSON.stringify({checks,errors,at:new Date().toISOString()},null,2));await browser.close();}
