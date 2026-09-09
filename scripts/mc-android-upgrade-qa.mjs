import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require(
  "C:/Users/30912/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
);
const adbPath = resolve("output/android-tools/adb/platform-tools/adb.exe");
const adb = (...args) =>
  execFileSync(adbPath, ["-s", "emulator-5556", ...args], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
const out = "output/android/qa-mc";
mkdirSync(out, { recursive: true });
const mode = process.argv[2];
const browser = await chromium.connectOverCDP("http://127.0.0.1:9225", {
  noDefaults: true,
});
const page = browser.contexts()[0].pages()[0];
page.setDefaultTimeout(20000);

try {
  await page.getByTestId("workspace-heading").waitFor();
  if (mode === "before") {
    const saved = await page.evaluate(() => {
      const key = "pmc.workspace.v1";
      const workspace = JSON.parse(localStorage.getItem(key) || "{}");
      workspace.heading = {
        text: "M-C覆盖安装保留测试",
        size: 31,
        color: "#236bd1",
      };
      localStorage.setItem(key, JSON.stringify(workspace));
      return localStorage.getItem(key);
    });
    writeFileSync(`${out}/before.json`, saved, "utf8");
    console.log("PASS 1.1.0 local workspace snapshot prepared");
  } else if (mode === "after") {
    const normalize = (value) => {
      const data = JSON.parse(value);
      for (const build of [
        ...(data.scene?.actors || []),
        ...(data.builds || []),
        ...(data.scenes || []).flatMap((scene) => scene.actors || []),
      ]) {
        if (build.faintedAllies === 0) delete build.faintedAllies;
      }
      return data;
    };
    const before = normalize(readFileSync(`${out}/before.json`, "utf8"));
    const after = normalize(
      await page.evaluate(() => localStorage.getItem("pmc.workspace.v1")),
    );
    assert.deepEqual(after, before);
    console.log("PASS same-signature 1.2.0 overlay preserved local records and applied only default-field migration");

    await page.reload();
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.getByText("安卓离线版 1.2.0", { exact: false }).waitFor();
    assert.match(await page.locator("body").innerText(), /1\.2\.0[\s\S]*M-C/);
    console.log("PASS Android UI advertises Champions 1.2.0 and M-C");

    await page.getByRole("button", { name: "伤害计算", exact: true }).click();
    await page.getByRole("button", { name: "单打", exact: true }).click();
    await page.getByRole("button", { name: "选择进攻宝可梦 1", exact: true }).click();
    await page.getByRole("textbox", { name: "选择进攻宝可梦 1搜索", exact: true }).fill("chaojilukaliouz");
    await page.locator(".option-list .option").filter({ hasText: "超级路卡利欧Z" }).click();
    assert.match(await page.locator(".pokemon-card").first().innerText(), /波导守护/);
    const enable = page.getByRole("button", { name: "启用社区试算", exact: true });
    if (await enable.count()) await enable.click();
    await page.locator(".damage-hero").waitFor();
    assert.match(await page.locator(".damage-hero").innerText(), /%/);
    assert.equal(
      await page.evaluate(
        () => Array.from(document.images).filter((image) => !image.complete || !image.naturalWidth).length,
      ),
      0,
    );
    console.log("PASS new M-C form, Chinese/pinyin search, image and offline calculation work");
    await page.screenshot({ path: `${out}/android-mc.png`, fullPage: true });

    const pkg = adb("shell", "dumpsys", "package", "cn.pmc.calculator");
    assert.match(pkg, /versionCode=3\b/);
    assert.match(pkg, /versionName=1\.2\.0\b/);
    console.log("PASS installed package reports versionCode 3 / versionName 1.2.0");
  } else {
    throw new Error("Use before or after");
  }
} finally {
  await browser.close();
}
