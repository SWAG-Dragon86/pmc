import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Web downloads retain their blob URL behavior", async () => {
  const { isAndroidApp, saveBlob } = await import("../src/platform.mjs");
  assert.equal(isAndroidApp, false);
  const original = globalThis.document;
  const anchor = { click() { this.clicked = true; } };
  globalThis.document = { createElement: () => anchor };
  try {
    await saveBlob(new Blob(["PMC"]), "PMC.json");
    assert.equal(anchor.clicked, true);
    assert.equal(anchor.download, "PMC.json");
    assert.match(anchor.href, /^blob:/);
  } finally { globalThis.document = original; }
});

test("Android export passes UTF-8 JSON through the native document bridge", async () => {
  const source = (await readFile(new URL("../src/platform.mjs", import.meta.url), "utf8"))
    .replace('import.meta.env?.VITE_PMC_ANDROID === "true"', "true");
  const module = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
  const originalReader = globalThis.FileReader;
  const originalBridge = globalThis.PMCAndroid;
  const calls = [];
  globalThis.FileReader = class {
    async readAsDataURL(blob) {
      this.result = "data:" + blob.type + ";base64," + Buffer.from(await blob.arrayBuffer()).toString("base64");
      this.onload();
    }
  };
  globalThis.PMCAndroid = { saveFile: (...args) => calls.push(args) };
  try {
    await module.saveBlob(new Blob(['{"name":"鬃岩狼人"}'], { type: "application/json" }), "中文备份.json");
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], "中文备份.json");
    assert.equal(calls[0][1], "application/json");
    assert.equal(Buffer.from(calls[0][2], "base64").toString("utf8"), '{"name":"鬃岩狼人"}');
    delete globalThis.PMCAndroid;
    await assert.rejects(module.saveBlob(new Blob(["data"]), "x.json"), /未就绪/);
  } finally { globalThis.FileReader = originalReader; globalThis.PMCAndroid = originalBridge; }
});
