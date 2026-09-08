import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const {
  chromium,
} = require("C:/Users/30912/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
await mkdir("output/playwright", { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.PMC_BROWSER_PATH ||
    "C:/Users/30912/AppData/Local/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe",
  headless: true,
  args: ["--disable-gpu"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  colorScheme: "light",
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [],
  networkErrors = [];
const results = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.status() >= 400) networkErrors.push(`${r.status()} ${r.url()}`);
});
async function check(name, fn) {
  await fn();
  results.push(name);
  console.log("PASS", name);
}
try {
  await page.goto("http://127.0.0.1:4173/");
  await page.getByRole("heading", { name: "每一击，都心中有数." }).waitFor();
  await check("Initial Chinese UI and data warning", async () => {
    assert.equal(await page.locator(".pokemon-card").count(), 2);
    assert.match(
      await page.locator(".data-notice").innerText(),
      /社区数据预览/,
    );
  });
  await page.screenshot({
    animations: "disabled",
    path: "output/playwright/desktop-initial.png",
    fullPage: true,
  });
  await check("Pinyin search and corresponding Mega forms", async () => {
    await page
      .getByRole("button", { name: "选择进攻宝可梦 1", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "选择进攻宝可梦 1搜索", exact: true })
      .fill("phl");
    assert.ok((await page.locator(".option-list .option").count()) >= 3);
    await page.getByRole("button", { name: "关闭", exact: true }).click();
  });
  await check("Enable preview and automatic damage calculation", async () => {
    await page
      .getByRole("button", { name: "启用社区试算", exact: true })
      .click();
    await page.locator(".damage-hero").waitFor({ timeout: 20000 });
    assert.match(await page.locator(".damage-hero").innerText(), /%/);
  });
  await check(
    "Save duplicate-name configurations without overwriting",
    async () => {
      for (let i = 0; i < 2; i++) {
        await page
          .getByRole("button", { name: "保存1号配置", exact: true })
          .click();
        await page
          .getByRole("textbox", { name: "保存名称", exact: true })
          .fill("测试喷火龙");
        await page.getByRole("button", { name: "保存", exact: true }).click();
      }
      await page
        .getByRole("button", { name: /配置库/ })
        .first()
        .click();
      assert.equal(await page.locator(".library-card").count(), 2);
    },
  );
  await check("Select two builds and enter double focus fire", async () => {
    for (const box of await page.locator(".library-check input").all())
      await box.check();
    await page
      .getByRole("button", { name: "用两只进行集火", exact: true })
      .click();
    assert.equal(await page.locator(".pokemon-card").count(), 4);
  });
  await check("Save scene snapshot and export full backup", async () => {
    await page.getByRole("button", { name: "保存场景", exact: true }).click();
    await page
      .getByRole("textbox", { name: "保存名称", exact: true })
      .fill("双打测试场景");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.getByRole("button", { name: "设置", exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "完整导出", exact: true }).click();
    await (await download).saveAs("output/playwright/backup.json");
  });
  await check("Dark theme", async () => {
    await page.getByRole("button", { name: "深色", exact: true }).click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    await page.screenshot({
      animations: "disabled",
      path: "output/playwright/settings-dark.png",
      fullPage: true,
    });
  });
  await check("Reload restores unsaved workspace", async () => {
    await page.getByRole("button", { name: "伤害计算", exact: true }).click();
    await page
      .getByRole("spinbutton", { name: "1号剩余血量百分比", exact: true })
      .fill("47");
    await page.waitForTimeout(600);
    await page.reload();
    await page
      .getByRole("spinbutton", { name: "1号剩余血量百分比", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("spinbutton", { name: "1号剩余血量百分比", exact: true })
        .inputValue(),
      "47",
    );
    assert.equal(await page.locator(".pokemon-card").count(), 4);
  });
  await check("Mobile layout has no horizontal overflow", async () => {
    await page.setViewportSize({ width: 375, height: 850 });
    await page.screenshot({
      animations: "disabled",
      path: "output/playwright/mobile-dark.png",
      fullPage: true,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.ok(await page.locator(".mobile-result").isVisible());
  });
  await check("Offline reload from PWA cache", async () => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, {
      timeout: 20000,
    });
    await context.setOffline(true);
    await page.reload();
    await page.getByRole("button", { name: "伤害计算", exact: true }).waitFor();
    assert.equal(await page.locator(".pokemon-card").count(), 4);
    await context.setOffline(false);
  });
  await check("Backup import detects duplicates", async () => {
    await page
      .locator('input[type=file][accept="application/json,.json"]')
      .setInputFiles("output/playwright/backup.json");
    await page
      .getByRole("heading", { name: "确认导入", exact: true })
      .waitFor();
    assert.match(await page.locator("dialog").innerText(), /跳过 3 条/);
    await page.getByRole("button", { name: "确认导入", exact: true }).click();
  });
  await check("Light mobile and tablet layout", async () => {
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.getByRole("button", { name: "浅色", exact: true }).click();
    await page.getByRole("button", { name: "伤害计算", exact: true }).click();
    await page.getByRole("button", { name: "单打", exact: true }).click();
    await page.getByRole("button", { name: "启用试算", exact: true }).click();
    await page.locator(".damage-hero").waitFor({ timeout: 20000 });
    await page.screenshot({
      animations: "disabled",
      path: "output/playwright/mobile-light.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 768, height: 1050 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      animations: "disabled",
      path: "output/playwright/tablet.png",
      fullPage: true,
    });
  });
  await check("Result image download", async () => {
    await page.setViewportSize({ width: 1440, height: 1050 });
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "保存结果图片", exact: true })
      .click();
    await (await download).saveAs("output/playwright/result.png");
    await page.screenshot({
      animations: "disabled",
      path: "output/playwright/desktop-result.png",
      fullPage: true,
    });
  });
  await check(
    "Edit original build preserves saved scene snapshot",
    async () => {
      await page
        .getByRole("button", { name: /配置库/ })
        .first()
        .click();
      await page
        .locator(".library-card")
        .first()
        .getByRole("button", { name: "载入计算", exact: true })
        .click();
      await page
        .getByRole("button", { name: "保存1号配置", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "保存名称", exact: true })
        .fill("修改后的配置");
      await page
        .getByRole("button", { name: "更新原配置", exact: true })
        .click();
      await page.waitForTimeout(500);
      const saved = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("pmc.workspace.v1")),
      );
      assert.equal(saved.builds.length, 2);
      assert.equal(saved.builds[0].name, "修改后的配置");
      assert.notEqual(saved.scenes[0].actors[0].name, "修改后的配置");
    },
  );
  await check(
    "Independent comparison keeps multiple selected builds",
    async () => {
      await page
        .getByRole("button", { name: /配置库/ })
        .first()
        .click();
      for (const box of await page.locator(".library-check input").all())
        await box.check();
      await page
        .getByRole("button", { name: "独立比较 (2)", exact: true })
        .click();
      assert.equal(await page.locator(".comparison-row").count(), 2);
    },
  );
  await check(
    "Custom background saved locally and default restored",
    async () => {
      await page.getByRole("button", { name: "设置", exact: true }).click();
      await page
        .locator('input[type=file][accept="image/png,image/jpeg,image/webp"]')
        .first()
        .setInputFiles("public/backgrounds/pmc-default-pokeball.png");
      await page.waitForFunction(() =>
        document
          .querySelector(".fixed-background")
          .style.backgroundImage.includes("blob:"),
      );
      await page.reload();
      await page.waitForFunction(() =>
        document
          .querySelector(".fixed-background")
          .style.backgroundImage.includes("blob:"),
      );
      await page.getByRole("button", { name: "设置", exact: true }).click();
      await page.getByRole("button", { name: "恢复默认", exact: true }).click();
      await page.waitForFunction(
        () =>
          !document.querySelector(".fixed-background").style.backgroundImage,
      );
    },
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(networkErrors, []);
} finally {
  await writeFile(
    "output/playwright/report.json",
    JSON.stringify(
      { checks: results, errors, networkErrors, at: new Date().toISOString() },
      null,
      2,
    ),
  );
  await browser.close();
}
