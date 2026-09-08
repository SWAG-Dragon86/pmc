import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require("C:/Users/30912/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const adbPath = resolve("output/android-tools/adb/platform-tools/adb.exe");
const adb = (...args) => execFileSync(adbPath, ["-s", "emulator-5556", ...args], { encoding: "utf8", windowsHide: true }).trim();
const pid = adb("shell", "pidof", "cn.pmc.calculator");
assert(pid, "Launch QA instrumentation first");
adb("forward", "tcp:9225", "localabstract:webview_devtools_remote_" + pid);
const browser = await chromium.connectOverCDP("http://127.0.0.1:9225", { noDefaults: true });
const page = browser.contexts()[0].pages()[0];
const errors = [], checks = [];
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(15000);
mkdirSync("output/android/qa", { recursive: true });
const check = async (name, fn) => { await fn(); checks.push(name); console.log("PASS", name); };
try {
  console.log("WebView:", await page.evaluate(() => navigator.userAgent));
  await page.reload();
  await page.getByTestId("workspace-heading").waitFor();
  await check("Cold start uses local HTTPS assets, with no web service worker", async () => {
    assert.equal(new URL(page.url()).host, "appassets.androidplatform.net");
    assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length), 0);
    assert.equal(await page.locator(".pokemon-card").count(), 2);
    assert.equal(await page.evaluate(() => Array.from(document.images).filter(i => !i.complete || !i.naturalWidth).length), 0);
  });
  await check("Single battle calculates remaining HP offline", async () => {
    adb("shell", "svc", "wifi", "disable");
    adb("shell", "svc", "data", "disable");
    await page.reload();
    const enable = page.getByRole("button", { name: "启用社区试算", exact: true });
    if (await enable.count()) await enable.click();
    await page.locator(".damage-hero").waitFor();
    assert.match(await page.locator(".damage-hero").innerText(), /%/);
  });
  await check("Chinese/pinyin search works inside native WebView", async () => {
    await page.getByRole("button", { name: "选择进攻宝可梦 1", exact: true }).click();
    await page.getByRole("textbox", { name: "选择进攻宝可梦 1搜索", exact: true }).fill("phl");
    assert((await page.locator(".option-list .option").count()) >= 3);
    adb("shell", "input", "keyevent", "4");
    await page.locator("dialog[open]").waitFor({ state: "hidden" });
  });
  await check("Duplicate-name configurations survive reload", async () => {
    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "保存1号配置", exact: true }).click();
      await page.getByRole("textbox", { name: "保存名称", exact: true }).fill("安卓离线验证");
      await page.getByRole("button", { name: "保存", exact: true }).click();
    }
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("pmc.workspace.v1")).builds.filter(b => b.name === "安卓离线验证").length >= 2);
    await page.reload();
    await page.getByTestId("workspace-heading").waitFor();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("pmc.workspace.v1")));
    assert(saved.builds.filter(b => b.name === "安卓离线验证").length >= 2);
    writeFileSync("output/android/qa/saved-workspace.json", JSON.stringify(saved));
  });
  await check("Settings show bundled resources and manual APK updates", async () => {
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.getByText("安装包已内置", { exact: true }).waitFor();
    await page.getByRole("button", { name: "安卓版更新说明", exact: true }).click();
    assert.match(await page.locator(".toast").innerText(), /APK/);
  });
  await page.screenshot({ path: "output/android/qa/android-settings.png", fullPage: true });
  assert.deepEqual(errors, []);
  writeFileSync("output/android/qa/runtime-checks.json", JSON.stringify({ checks, errors }, null, 2));
} finally { await browser.close(); }
