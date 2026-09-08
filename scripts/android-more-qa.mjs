import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/30912/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const executable = resolve("output/android-tools/adb/platform-tools/adb.exe");
const adb = (...args) => execFileSync(executable, ["-s", "emulator-5556", ...args], { encoding: "utf8", windowsHide: true }).trim();
const delay = ms => new Promise(r => setTimeout(r, ms));
const dump = () => { adb("shell", "uiautomator", "dump", "/sdcard/pmc-ui.xml"); return adb("shell", "cat", "/sdcard/pmc-ui.xml"); };
function tap(xml, pattern) {
  const node = xml.match(/<node\b[^>]*>/g)?.find(n => pattern.test(n));
  assert(node, String(pattern));
  const [,a,b,c,d] = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  adb("shell", "input", "tap", String(Math.round((+a + +c)/2)), String(Math.round((+b + +d)/2)));
}
const browser = await chromium.connectOverCDP("http://127.0.0.1:9225", { noDefaults: true });
const page = browser.contexts()[0].pages()[0];
page.setDefaultTimeout(15000);
const checks = [];
try {
  adb("push", "public/rotom-icon-512.png", "/sdcard/Download/pmc-test.png");
  await page.getByRole("button", { name: "选择竖屏背景", exact: true }).click();
  await delay(600);
  let xml = dump();
  if (!xml.includes('pmc-test.png')) {
    tap(xml, /content-desc="Show roots"/);
    await delay(500);
    tap(dump(), /text="Downloads" resource-id="android:id\/title"/);
    await delay(700);
    xml = dump();
  }
  tap(xml, /(?:text|content-desc)="pmc-test\.png(?:,|")/);
  await page.waitForFunction(() => document.querySelector('.background-preview.portrait').style.backgroundImage.includes('blob:'));
  await page.reload();
  await page.getByTestId("workspace-heading").waitFor();
  await page.waitForFunction(() => document.querySelector('.fixed-background').style.backgroundImage.includes('blob:'));
  checks.push("Native image picker persists portrait background in IndexedDB after reload");
  await page.getByRole("button", {name:"设置",exact:true}).click();
  await page.getByRole("button", {name:"清除竖屏背景",exact:true}).click();
  await page.getByRole("button", {name:/配置库/}).first().click();
  const boxes = page.locator('.library-check input');
  for (let i=0;i<2;i++) await boxes.nth(i).check();
  await page.getByRole("button", {name:"用两只进行集火",exact:true}).click();
  const enable = page.getByRole("button", {name:"启用社区试算",exact:true});
  if (await enable.count()) await enable.click();
  await page.locator('.damage-hero').waitFor();
  assert.equal(await page.locator('.pokemon-card').count(),4);
  checks.push("Double focus fire calculates offline with four on-field slots");
  await page.screenshot({path:'output/android/qa/android-calculator.png'});
  await page.getByRole("button", {name:/导出.*图片|保存.*图片|结果图片/}).click();
  tap(dump(), /resource-id="android:id\/button1"/);
  await delay(600);
  const files = adb('shell','ls','/sdcard/Download');
  const png = files.split(/\r?\n/).find(n=>n.startsWith('PMC-伤害结果-')&&n.endsWith('.png'));
  assert(png, files);
  adb('pull','/sdcard/Download/'+png,'output/android/qa/native-result.png');
  checks.push("Result PNG exported through the Android save dialog");
  writeFileSync('output/android/qa/more-checks.json',JSON.stringify({checks},null,2));
  checks.forEach(c=>console.log('PASS',c));
} finally { await browser.close(); }
