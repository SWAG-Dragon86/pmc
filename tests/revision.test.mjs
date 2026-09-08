import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeHeading,
  DEFAULT_HEADING,
  DISCUSSION_URL,
} from "../src/preferences.mjs";
import { createBuild, validateBuild } from "../src/model.mjs";
const json = (path) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const catalog = json("../src/data/catalog.json");
const roster = json("../src/data/roster-audit.json");
test("all current official M-B entries are selectable, including inherited female Meowstic", () => {
  assert.equal(roster.roster.length, 235);
  for (const entry of roster.roster) {
    const p = catalog.pokemon.find((p) => p.id === entry.id);
    assert.ok(p, entry.id);
    assert.equal(p.zh, entry.zh);
    assert.deepEqual(
      validateBuild(createBuild(catalog, entry.id), catalog),
      [],
    );
  }
  const female = catalog.pokemon.find((p) => p.id === "meowsticf");
  assert.ok(female.abilities.includes("Competitive"));
  assert.ok(female.moves.includes("extrasensory"));
  for (const id of ["meowsticfmega", "meowsticmmega"]) {
    const p = catalog.pokemon.find((p) => p.id === id);
    assert.equal(p.mega, true);
    assert.equal(createBuild(catalog, id).item, "Meowsticite");
  }
  assert.ok(
    catalog.pokemon
      .find((p) => p.id === "meowsticfmega")
      .moves.includes("extrasensory"),
  );
});
test("every catalog species has a local real PNG, no missing image placeholders", () => {
  const info = json("../src/data/sprites.json");
  assert.deepEqual(info.missing, []);
  assert.equal(info.count, catalog.pokemon.length);
  for (const p of catalog.pokemon) {
    const data = readFileSync(
      new URL(`../public/sprites/${p.id}.png`, import.meta.url),
    );
    assert.equal(data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", p.id);
    assert.ok(data.readUInt32BE(16) > 0 && data.readUInt32BE(20) > 0, p.id);
  }
});
test("item, ability and form labels have Chinese names and no duplicate item labels", () => {
  for (const entry of [
    ...catalog.items,
    ...catalog.abilities,
    ...catalog.pokemon,
  ])
    assert.match(entry.zh, /[\u3400-\u9fff]/, entry.name);
  assert.equal(
    new Set(catalog.items.map((i) => i.zh)).size,
    catalog.items.length,
  );
  assert.ok(
    !catalog.pokemon.some((p) =>
      /Mega|Blade|Sunny|Rainy|Snowy|Combat|Blaze|Aqua/.test(p.zh),
    ),
  );
});
test("custom heading defaults, size bounds and safe color/text normalization", () => {
  assert.deepEqual(normalizeHeading(), DEFAULT_HEADING);
  assert.deepEqual(
    normalizeHeading({ text: "我的计算器", size: 44, color: "#123abc" }),
    { text: "我的计算器", size: 44, color: "#123abc" },
  );
  assert.equal(normalizeHeading({ size: 999 }).size, 64);
  assert.equal(normalizeHeading({ size: -100 }).size, 18);
  assert.equal(normalizeHeading({ size: NaN }).size, 32);
  assert.equal(normalizeHeading({ text: "a".repeat(200) }).text.length, 80);
  assert.equal(
    normalizeHeading({ color: "url(javascript:alert(1))" }).color,
    "",
  );
});
test("discussion link preserves owner-supplied QQ invitation parameters", () => {
  const url = new URL(DISCUSSION_URL);
  assert.equal(url.origin, "https://qun.qq.com");
  assert.equal(url.pathname, "/universal-share/share");
  assert.equal(url.searchParams.get("tempid"), "h5_group_info");
  assert.ok(!DISCUSSION_URL.includes("\\"));
  const payload = JSON.parse(
    Buffer.from(url.searchParams.get("busi_data"), "base64").toString("utf8"),
  );
  assert.equal(payload.groupCode, "592068255");
});
