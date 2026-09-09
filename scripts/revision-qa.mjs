import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { DISCUSSION_URL } from "../src/preferences.mjs";
const require = createRequire(import.meta.url);
const {
  chromium,
} = require("C:/Users/30912/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const catalog = JSON.parse(await readFile("src/data/catalog.json", "utf8"));
const sprites = JSON.parse(await readFile("src/data/sprites.json", "utf8"));
await mkdir("output/playwright", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PMC_BROWSER_PATH ||
    "C:/Users/30912/AppData/Local/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe",
  args: ["--disable-gpu"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  colorScheme: "light",
});
const page = await context.newPage();
const checks = [],
  errors = [];
page.on("pageerror", (error) => errors.push(error.message));
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS", name);
}
const settings = () =>
  page.getByRole("button", { name: "设置", exact: true }).click();
try {
  await page.goto("http://127.0.0.1:4173/");
  await page.getByTestId("workspace-heading").waitFor();
  await check(
    "Bolder body fonts and blue accessible discussion link",
    async () => {
      assert.ok(
        Number(
          await page
            .locator("body")
            .evaluate((e) => getComputedStyle(e).fontWeight),
        ) >= 600,
      );
      const a = page.getByRole("link", { name: "讨论频道" });
      assert.equal(await a.getAttribute("href"), DISCUSSION_URL);
      assert.equal(
        await a.evaluate((e) => getComputedStyle(e).color),
        "rgb(23, 101, 204)",
      );
      assert.match(await a.getAttribute("rel"), /noopener/);
      // Intercept external request: test click destination without joining or contacting QQ.
      await context.route("https://qun.qq.com/**", (route) =>
        route.fulfill({
          body: "QQ invitation destination verified",
          contentType: "text/plain",
        }),
      );
      const popupPromise = page.waitForEvent("popup");
      await a.click();
      const popup = await popupPromise;
      await popup.waitForLoadState();
      assert.equal(popup.url(), DISCUSSION_URL);
      await popup.close();
    },
  );
  await check(
    `All ${catalog.pokemon.length} choices can be browsed without the old 150-entry cutoff`,
    async () => {
      await page
        .getByRole("button", { name: "选择进攻宝可梦 1", exact: true })
        .click();
      assert.equal(
        await page.locator(".option-list .option").count(),
        catalog.pokemon.length,
      );
      await page
        .locator(".option-list .option")
        .last()
        .scrollIntoViewIfNeeded();
      await page.getByRole("button", { name: "关闭", exact: true }).click();
    },
  );
  await check(
    "Female Meowstic can be selected by Chinese and pinyin",
    async () => {
      await page
        .getByRole("button", { name: "选择进攻宝可梦 1", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "选择进攻宝可梦 1搜索", exact: true })
        .fill("cnmm");
      assert.equal(await page.locator(".option-list .option").count(), 4);
      await page
        .locator(".option-list .option")
        .filter({ hasText: "超能妙喵 (雌性的样子)" })
        .click();
      assert.match(
        await page.locator(".pokemon-card").first().innerText(),
        /雌性/,
      );
    },
  );
  await check(`All ${catalog.pokemon.length} images decode successfully in the browser`, async () => {
    const failures = await page.evaluate(
      async (ids) => {
        const out = [];
        for (let i = 0; i < ids.length; i += 20)
          await Promise.all(
            ids.slice(i, i + 20).map(async (id) => {
              const image = new Image();
              image.src = `/sprites/${id}.png`;
              try {
                await image.decode();
                if (!image.naturalWidth) out.push(id);
              } catch {
                out.push(id);
              }
            }),
          );
        return out;
      },
      catalog.pokemon.map((p) => p.id),
    );
    assert.deepEqual(failures, []);
  });
  await settings();
  await check(
    "Custom heading text, size and color persist without changing current Pokemon",
    async () => {
      await page
        .getByRole("textbox", { name: "自定义文字", exact: true })
        .fill("卡比兽侠的对战小屋");
      await page.getByRole("slider", { name: "首页文字字号" }).fill("44");
      await page.getByLabel("首页文字颜色", { exact: true }).fill("#236bd1");
      await page.waitForFunction(
        () =>
          JSON.parse(localStorage.getItem("pmc.workspace.v1")).heading
            ?.color === "#236bd1",
      );
      await page.screenshot({
        path: "output/playwright/revision-settings-light.png",
        fullPage: true,
        animations: "disabled",
      });
      await page.reload();
      await page.getByTestId("workspace-heading").waitFor();
      assert.equal(
        await page.getByTestId("workspace-heading").innerText(),
        "卡比兽侠的对战小屋",
      );
      assert.equal(
        await page
          .getByTestId("workspace-heading")
          .evaluate((e) => getComputedStyle(e).fontSize),
        "44px",
      );
      assert.equal(
        await page
          .getByTestId("workspace-heading")
          .evaluate((e) => getComputedStyle(e).color),
        "rgb(35, 107, 209)",
      );
      assert.match(
        await page.locator(".pokemon-card").first().innerText(),
        /雌性/,
      );
      await page.screenshot({
        path: "output/playwright/revision-desktop.png",
        fullPage: true,
        animations: "disabled",
      });
    },
  );
  await check("Longest heading at largest font fits mobile width", async () => {
    await settings();
    await page
      .getByRole("textbox", { name: "自定义文字", exact: true })
      .fill("PMC".repeat(26));
    await page.getByRole("slider", { name: "首页文字字号" }).fill("64");
    await page.setViewportSize({ width: 375, height: 850 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.getByRole("button", { name: "伤害计算", exact: true }).click();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  });
  await check(
    "Restore defaults and theme-aware color work on mobile and dark mode",
    async () => {
      await settings();
      await page
        .getByRole("button", { name: "恢复默认文字样式", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "自定义文字", exact: true })
        .fill("卡比兽侠的小屋");
      await page.getByRole("button", { name: "深色", exact: true }).click();
      await page.screenshot({
        path: "output/playwright/revision-settings-dark-mobile.png",
        fullPage: true,
        animations: "disabled",
      });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await page.getByRole("button", { name: "伤害计算", exact: true }).click();
      assert.equal(
        await page
          .getByTestId("workspace-heading")
          .evaluate((e) => e.style.color),
        "",
      );
      await page.screenshot({
        path: "output/playwright/revision-mobile.png",
        fullPage: true,
        animations: "disabled",
      });
    },
  );
  const sheet = await context.newPage();
  await sheet.setViewportSize({ width: 1000, height: 900 });
  await sheet.setContent(
    `<html lang="zh"><body style="font-family:Microsoft YaHei,sans-serif;background:#f0f1f3;padding:20px"><h1>本轮补齐的形态图片</h1><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px">${Object.keys(
      sprites.provenance,
    )
      .map(
        (id) =>
          `<div style="background:white;text-align:center;padding:12px;border-radius:10px"><img src="http://127.0.0.1:4173/sprites/${id}.png" style="width:112px;height:120px;object-fit:contain"><p style="font-size:12px">${catalog.pokemon.find((p) => p.id === id)?.zh}</p></div>`,
      )
      .join("")}</div></body></html>`,
  );
  await sheet.evaluate(() =>
    Promise.all([...document.images].map((i) => i.decode())),
  );
  await sheet.screenshot({
    path: "output/playwright/revision-sprites.png",
    fullPage: true,
    animations: "disabled",
  });
  assert.deepEqual(errors, []);
} finally {
  await writeFile(
    "output/playwright/revision-report.json",
    JSON.stringify({ checks, errors, at: new Date().toISOString() }, null, 2),
  );
  await browser.close();
}
