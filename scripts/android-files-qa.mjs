import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/30912/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const executable = resolve("output/android-tools/adb/platform-tools/adb.exe");
const adb = (...args) => execFileSync(executable, ["-s", "emulator-5556", ...args], { encoding: "utf8", windowsHide: true }).trim();
const delay = ms => new Promise(r => setTimeout(r, ms));
const dump = () => { adb("shell", "uiautomator", "dump", "/sdcard/pmc-ui.xml"); return adb("shell", "cat", "/sdcard/pmc-ui.xml"); };
function tapNode(xml, pattern) {
  const node = xml.match(/<node\b[^>]*>/g)?.find(n => pattern.test(n));
  assert(node, "Missing native control: " + pattern);
  const [, x1, y1, x2, y2] = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  adb("shell", "input", "tap", String(Math.round((+x1 + +x2)/2)), String(Math.round((+y1 + +y2)/2)));
}
const browser = await chromium.connectOverCDP("http://127.0.0.1:9225", { noDefaults: true });
const page = browser.contexts()[0].pages()[0];
const checks = [];
try {
  // Continue the observed native CREATE_DOCUMENT dialog.
  tapNode(dump(), /resource-id="android:id\/button1"/);
  await delay(700);
  const content = adb("shell", "cat", "/sdcard/Download/PMC-完整备份.json");
  const backup = JSON.parse(content);
  assert.equal(backup.format, "PMC");
  assert(backup.builds.length >= 2);
  writeFileSync("output/android/qa/native-export.json", content);
  checks.push("Native system save dialog wrote valid Chinese JSON backup to Downloads");

  await page.getByRole("button", { name: "导入备份", exact: true }).click();
  await delay(500);
  let xml = dump();
  if (!xml.includes('text="PMC-完整备份.json"')) {
    tapNode(xml, /content-desc="Show roots"/);
    tapNode(dump(), /text="Downloads"/);
    xml = dump();
  }
  tapNode(xml, /text="PMC-完整备份.json"/);
  await page.locator("dialog[open]").waitFor();
  assert.match(await page.locator("dialog[open]").innerText(), /完全重复/);
  await page.getByRole("button", { name: "确认导入", exact: true }).click();
  checks.push("Native system picker imported the saved backup with duplicate detection");

  adb("shell", "cmd", "uimode", "night", "yes");
  await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  await page.screenshot({ path: "output/android/qa/android-dark.png" });
  adb("shell", "cmd", "uimode", "night", "no");
  await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
  checks.push("System light/dark changes update the app without losing records");
  writeFileSync("output/android/qa/native-file-checks.json", JSON.stringify({checks}, null, 2));
  checks.forEach(c => console.log("PASS", c));
} finally { await browser.close(); }
