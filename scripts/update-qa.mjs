import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const {
  chromium,
} = require("C:/Users/30912/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const template = await readFile("dist/sw.js", "utf8");
let version = 1,
  payloadFetches = 0;
const server = createServer((req, res) => {
  if (req.url === "/sw.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      template
        .replace(
          /const CACHE='[^']+';/,
          `const CACHE='pmc-fixture-${version}';`,
        )
        .replace(
          /const FILES=.*?;/,
          `const FILES=['./index.html','./payload.json'];`,
        ),
    );
  } else if (req.url === "/payload.json") {
    payloadFetches++;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ version }));
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(
      "<!doctype html><title>PMC update fixture</title><p>Update test</p>",
    );
  }
});
await new Promise((resolve) => server.listen(4174, "127.0.0.1", resolve));
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.PMC_BROWSER_PATH ||
    "C:/Users/30912/AppData/Local/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe",
  args: ["--disable-gpu"],
});
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:4174/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  assert.equal(
    (await page.evaluate(() => fetch("/payload.json").then((r) => r.json())))
      .version,
    1,
  );
  const first = payloadFetches;
  version = 2;
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    await r.update();
  });
  await page.waitForFunction(
    async () => !!(await navigator.serviceWorker.getRegistration())?.waiting,
  );
  assert.equal(
    payloadFetches,
    first,
    "Update payload must not download before approval",
  );
  assert.equal(
    (await page.evaluate(() => fetch("/payload.json").then((r) => r.json())))
      .version,
    1,
  );
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    await new Promise((resolve) => {
      navigator.serviceWorker.addEventListener("controllerchange", resolve, {
        once: true,
      });
      r.waiting.postMessage({ type: "ACTIVATE" });
    });
  });
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    return keys.includes("pmc-fixture-2") && !keys.includes("pmc-fixture-1");
  });
  assert.equal(
    (await page.evaluate(() => fetch("/payload.json").then((r) => r.json())))
      .version,
    2,
  );
  assert.ok(payloadFetches > first);
  await mkdir("output/playwright", { recursive: true });
  await writeFile(
    "output/playwright/update-report.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "Initial offline cache",
          "Update waits without downloading data",
          "Old data retained until approval",
          "Approved update downloads and activates",
          "Old cache removed",
        ],
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS: update download/activation requires approval; old cache replaced only after success.",
  );
} finally {
  await browser.close();
  server.close();
}
