import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const runtime =
  "C:/Users/30912/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const { chromium } = require(`${runtime}/playwright`);
const sharp = require(`${runtime}/sharp`);
const manifest = JSON.parse(
  await readFile("public/manifest.webmanifest", "utf8"),
);
const checks = [],
  errors = [];
const check = async (name, fn) => {
  await fn();
  checks.push(name);
  console.log("PASS", name);
};
await mkdir("output/playwright", { recursive: true });
await check(
  "All platform icons use Rotom, with valid dimensions and opaque launch backgrounds",
  async () => {
    for (const size of [32, 180, 192, 512]) {
      const meta = await sharp(`public/rotom-icon-${size}.png`).metadata();
      assert.equal(meta.width, size);
      assert.equal(meta.height, size);
      assert.equal(meta.hasAlpha, false);
    }
    assert.equal(manifest.icons.length, 3);
    assert(manifest.icons.every((icon) => icon.src.startsWith("rotom-")));
    assert(manifest.icons.some((icon) => icon.purpose === "maskable"));
    const { data, info } = await sharp("public/rotom-maskable-512.png")
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let y = 0; y < 512; y++)
      for (let x = 0; x < 512; x++) {
        if (Math.hypot(x - 255.5, y - 255.5) > 204.8) {
          const i = (y * 512 + x) * info.channels;
          assert.deepEqual(
            [...data.subarray(i, i + 3)],
            [245, 243, 239],
            "No artwork outside maskable safe circle",
          );
        }
      }
  },
);
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
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (response.status() >= 400)
    errors.push(`${response.status()} ${response.url()}`);
});
try {
  await page.goto("http://127.0.0.1:4173/");
  await page.getByTestId("workspace-heading").waitFor();
  await check(
    "Favicon and Apple home-screen icon are linked and available",
    async () => {
      for (const [rel, file] of [
        ["icon", "rotom-icon-32.png"],
        ["apple-touch-icon", "rotom-icon-180.png"],
      ]) {
        const href = await page
          .locator(`link[rel="${rel}"]`)
          .getAttribute("href");
        assert.equal(href, `./${file}`);
        assert.equal(
          (await context.request.get(new URL(href, page.url()).href)).status(),
          200,
        );
      }
    },
  );
  for (const theme of ["light", "dark"]) {
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page
      .getByRole("button", {
        name: theme === "light" ? "浅色" : "深色",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "伤害计算", exact: true }).click();
    for (const [device, viewport] of [
      ["desktop", { width: 1440, height: 1050 }],
      ["tablet", { width: 768, height: 1024 }],
      ["mobile", { width: 375, height: 812 }],
    ]) {
      await page.setViewportSize(viewport);
      await check(
        `${theme} ${device}: translucent shell and cards, full Rotom logo, no horizontal overflow`,
        async () => {
          await page
            .locator(".brand-mark img")
            .evaluate((image) => image.decode());
          const state = await page.evaluate(() => {
            const shell = getComputedStyle(
              document.querySelector(".app-shell"),
            );
            const panel = getComputedStyle(
              document.querySelector(".pokemon-card"),
            );
            const logo = document.querySelector(".brand-mark img");
            return {
              shell: shell.backgroundColor,
              blur: shell.backdropFilter,
              panel: panel.backgroundColor,
              logo: logo.getAttribute("src"),
              width: logo.naturalWidth,
              fit: getComputedStyle(logo).objectFit,
              overflow: document.documentElement.scrollWidth > innerWidth,
              fixed: getComputedStyle(
                document.querySelector(".fixed-background"),
              ).position,
            };
          });
          assert.match(state.shell, /0\.48\)/);
          assert.match(state.panel, theme === "light" ? /0\.52\)/ : /0\.58\)/);
          assert.match(state.blur, /blur\(10px\)/);
          assert.equal(state.width, 516);
          assert.equal(state.logo, "./rotom-logo.webp");
          assert.equal(state.fit, "contain");
          assert.equal(state.overflow, false);
          assert.equal(state.fixed, "fixed");
          await page.screenshot({
            path: `output/playwright/glass-${theme}-${device}.png`,
            animations: "disabled",
          });
        },
      );
    }
  }
  await check(
    "Reduced transparency uses an opaque accessible fallback",
    async () => {
      const session = await context.newCDPSession(page);
      await session.send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
      });
      const style = await page.locator(".app-shell").evaluate((el) => ({
        color: getComputedStyle(el).backgroundColor,
        blur: getComputedStyle(el).backdropFilter,
      }));
      assert.equal(style.color, "rgb(35, 35, 43)");
      assert.equal(style.blur, "none");
      await session.send("Emulation.setEmulatedMedia", { features: [] });
    },
  );
  await check("No browser exceptions or failed resources", async () =>
    assert.deepEqual(errors, []),
  );
  await check(
    "System light and dark themes retain their glass materials",
    async () => {
      await page.getByRole("button", { name: "设置", exact: true }).click();
      await page.getByRole("button", { name: "跟随系统", exact: true }).click();
      for (const colorScheme of ["light", "dark"]) {
        await page.emulateMedia({ colorScheme });
        const panel = await page
          .locator(".panel")
          .first()
          .evaluate((el) => getComputedStyle(el).backgroundColor);
        assert.equal(
          panel,
          colorScheme === "light"
            ? "rgba(255, 255, 255, 0.52)"
            : "rgba(35, 35, 43, 0.58)",
        );
      }
    },
  );
  await check(
    "Rotom logo and platform icons remain available offline",
    async () => {
      await page.waitForFunction(() =>
        Boolean(navigator.serviceWorker.controller),
      );
      await context.setOffline(true);
      await page.reload();
      await page.locator(".brand-mark img").evaluate((image) => image.decode());
      const statuses = await page.evaluate(async () => {
        const files = [
          "rotom-logo.webp",
          "rotom-icon-32.png",
          "rotom-icon-180.png",
          "rotom-icon-192.png",
          "rotom-icon-512.png",
          "rotom-maskable-512.png",
        ];
        return Promise.all(
          files.map(async (file) => (await fetch(`./${file}`)).status),
        );
      });
      assert(statuses.every((status) => status === 200));
      await context.setOffline(false);
    },
  );
  await writeFile(
    "output/playwright/glass-logo-report.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  await browser.close();
}
