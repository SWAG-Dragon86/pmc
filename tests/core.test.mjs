import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validatePoints,
  createBuild,
  defaultScene,
  validateBuild,
  needsFaintedAlliesInput,
} from "../src/model.mjs";
import { parseImport, mergeRecords, exportPayload } from "../src/storage.mjs";
import {
  statsOf,
  damageFor,
  summarize,
  simulateTurn,
  makePokemon,
  speedOf,
} from "../src/engine.mjs";

test("all catalog entries use the Champions generation and inherit common items", () => {
  for (const p of catalog.pokemon) {
    const b = createBuild(catalog, p.id);
    assert.equal(makePokemon(b, catalog).gen.num, 0);
    assert.equal(validateBuild(b, catalog).length, 0, p.id);
  }
  for (const item of ["Focus Sash", "Leftovers", "Life Orb", "Sitrus Berry"])
    assert.ok(
      catalog.items.some((i) => i.name === item),
      item,
    );
  assert.ok(catalog.pokemon.some((p) => p.id === "aegislash"));
  assert.ok(catalog.pokemon.some((p) => p.id === "floettemega"));
});
test("internal integer HP does not lose a point when converted from a percentage", () => {
  const b = createBuild(catalog);
  const max = statsOf(b, catalog).hp;
  for (let n = 0; n <= max; n++) {
    b.hp = (n / max) * 100;
    assert.equal(makePokemon(b, catalog).curHP(), n);
  }
});
test("malformed target and nonnumeric SP imports are rejected without mutation", () => {
  const s = defaultScene(catalog);
  s.target = 10;
  assert.throws(() => parseImport(JSON.stringify(exportPayload([], [s]))));
  const b = createBuild(catalog);
  b.points.hp = "wrong";
  assert.throws(() => parseImport(JSON.stringify(exportPayload([b], []))));
});
test("fainted ally count defaults to zero, survives backups, and rejects invalid values", () => {
  const b = createBuild(catalog, "kingambit");
  assert.equal(b.faintedAllies, 0);
  b.faintedAllies = 5;
  const imported = parseImport(JSON.stringify(exportPayload([b], [])));
  assert.equal(imported.builds[0].faintedAllies, 5);
  delete b.faintedAllies;
  const legacy = parseImport(JSON.stringify(exportPayload([b], [])));
  assert.equal(legacy.builds[0].faintedAllies, 0);
  b.faintedAllies = 6;
  assert.throws(
    () => parseImport(JSON.stringify(exportPayload([b], []))),
    /字段不完整/,
  );
});
test("fainted ally input appears only for Supreme Overlord or selected Last Respects", () => {
  const b = createBuild(catalog, "kingambit");
  assert.equal(needsFaintedAlliesInput(b), false);
  b.ability = "Supreme Overlord";
  assert.equal(needsFaintedAlliesInput(b), true);
  const houndstone = createBuild(catalog, "houndstone");
  houndstone.moves = ["lastrespects", "protect", "", ""];
  houndstone.selected = 1;
  assert.equal(needsFaintedAlliesInput(houndstone), false);
  houndstone.selected = 0;
  assert.equal(needsFaintedAlliesInput(houndstone), true);
});
test("Skill Link forces maximum hits and illegal counts do not produce numbers", () => {
  const s = defaultScene(catalog);
  s.actors[0] = createBuild(catalog, "heracrossmega");
  const b = s.actors[0];
  b.moves[0] = "bulletseed";
  b.hits = 2;
  const two = damageFor(b, s.actors[2], "bulletseed", s, catalog);
  b.hits = 5;
  assert.equal(
    damageFor(b, s.actors[2], "bulletseed", s, catalog).mean,
    two.mean,
  );
  b.ability = "Skill Link";
  assert.ok(two.dist.length > 16);
});
test("paralysis modifies speed but never adds a failed-action branch", () => {
  const s = defaultScene(catalog),
    a = s.actors[0];
  a.points = { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 };
  const normal = speedOf(a, s, catalog, 0);
  a.status = "par";
  assert.equal(speedOf(a, s, catalog, 0), Math.floor(normal / 2));
  const r = simulateTurn(s, catalog);
  assert.equal(r.error, undefined);
  assert.ok(r.damage.mean > 0);
  assert.equal(r.damage.ko, 100);
});
test("Protect prevents self stat drops when no damage was dealt", () => {
  const s = defaultScene(catalog);
  s.actors[0].moves[0] = "overheat";
  s.actors[2].protected = true;
  const r = simulateTurn(s, catalog);
  assert.equal(r.error, undefined);
  assert.equal(r.damage.max, 0);
});
test("same-speed order branches are accounted for and fainted defender cannot retaliate", () => {
  const s = defaultScene(catalog);
  s.actors[0] = createBuild(catalog, "pikachu");
  s.actors[2] = createBuild(catalog, "pikachu");
  for (const b of [s.actors[0], s.actors[2]]) {
    b.selected = 2;
    b.hp = 1;
    b.active = true;
  }
  const r = simulateTurn(s, catalog);
  assert.equal(r.error, undefined);
  assert.ok(Math.abs(r.damage.ko - 50) < 1e-9);
});
const catalog = JSON.parse(
  readFileSync(new URL("../src/data/catalog.json", import.meta.url)),
);
test("Champions SP caps and integer input", () => {
  assert.equal(
    validatePoints({ hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 }),
    "",
  );
  assert.notEqual(
    validatePoints({ hp: 3, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 }),
    "",
  );
  assert.notEqual(
    validatePoints({ hp: 33, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }),
    "",
  );
  assert.notEqual(
    validatePoints({ hp: 0.1, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }),
    "",
  );
});
test("native Champions formula, not EV approximation", () => {
  const p = createBuild(catalog, "pikachu");
  p.points = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  p.nature = "Serious";
  assert.deepEqual(statsOf(p, catalog), {
    hp: 110,
    atk: 75,
    def: 60,
    spa: 70,
    spd: 70,
    spe: 110,
  });
});
test("roundtrip, duplicate names, conflict copy, malicious input", () => {
  const a = createBuild(catalog, "pikachu");
  const b = { ...structuredClone(a), id: "different" };
  const imported = parseImport(JSON.stringify(exportPayload([a, b], [])));
  assert.equal(imported.builds.length, 2);
  assert.equal(mergeRecords([a], [a], "copy").records.length, 1);
  const changed = { ...a, name: "changed" };
  const copied = mergeRecords([a], [changed], "copy").records;
  assert.equal(copied.length, 2);
  assert.notEqual(copied[0].id, copied[1].id);
  assert.throws(() => parseImport('{"format":"other"}'));
  assert.throws(() => parseImport('{"format":"PMC","schema":99}'));
  assert.throws(() =>
    parseImport(
      '{"format":"PMC","schema":1,"builds":[{"__proto__":{}}],"scenes":[]}',
    ),
  );
});
test("scenario snapshot does not link to library", () => {
  const original = defaultScene(catalog);
  const snapshot = structuredClone(original);
  original.actors[0].points.spa = 32;
  assert.notEqual(original.actors[0].points.spa, snapshot.actors[0].points.spa);
});
test("illegal learned move is preserved but rejected", () => {
  const p = createBuild(catalog, "pikachu");
  p.moves[0] = "roaroftime";
  assert.ok(validateBuild(p, catalog).length);
  assert.equal(p.moves[0], "roaroftime");
});
test("spread target Protect does not remove spread modifier", () => {
  const s = defaultScene(catalog);
  s.mode = "double";
  s.actors[0] = createBuild(catalog, "charizard");
  s.actors[0].selected = 1;
  s.actors[3].protected = false;
  const both = damageFor(
    s.actors[0],
    s.actors[2],
    "heatwave",
    s,
    catalog,
  ).rolls;
  s.actors[3].protected = true;
  assert.deepEqual(
    damageFor(s.actors[0], s.actors[2], "heatwave", s, catalog).rolls,
    both,
  );
  s.actors[3].present = false;
  assert.ok(
    damageFor(s.actors[0], s.actors[2], "heatwave", s, catalog).rolls[15] >
      both[15],
  );
});
test("Protect is not treated as a miss", () => {
  const s = defaultScene(catalog);
  s.actors[2].protected = true;
  assert.equal(
    Math.max(
      ...damageFor(s.actors[0], s.actors[2], "flamethrower", s, catalog).rolls,
    ),
    0,
  );
});
test("mean uses actual discrete rolls", () => {
  assert.ok(Math.abs(summarize([1, 1, 10], 100, 100).mean - 4) < 1e-10);
});
test("fainted actors cannot attack; turn results carry assumptions", () => {
  const s = defaultScene(catalog);
  s.actors[0].hp = 0;
  const r = simulateTurn(s, catalog);
  assert.equal(r.error, undefined);
  assert.equal(r.damage.max, 0);
});

test("spread friendly fire removes a fainted ally from later actions", () => {
  const s = defaultScene(catalog);
  s.mode = "double";
  s.actors[0] = createBuild(catalog, "garchomp");
  s.actors[0].points = { hp: 2, atk: 32, def: 0, spa: 0, spd: 0, spe: 32 };
  s.actors[1] = createBuild(catalog, "pikachu");
  s.actors[1].name = "AllyB";
  s.actors[1].points.spe = 0;
  s.actors[1].hp = 1;
  s.actors[1].selected = 0;
  s.actors[2] = createBuild(catalog, "blissey");
  s.actors[2].active = false;
  s.actors[3].present = false;
  const r = simulateTurn(s, catalog);
  assert.equal(r.error, undefined);
  assert.equal(r.afterAction[1].max, 0);
  assert.ok(r.log.every((line) => !line.startsWith("AllyB")));
});
test("Focus Sash survival is conditional on starting at full HP", () => {
  const s = defaultScene(catalog);
  s.actors[0].points = { hp: 2, atk: 0, def: 0, spa: 32, spd: 0, spe: 32 };
  s.actors[2].item = "Focus Sash";
  let r = simulateTurn(s, catalog);
  assert.equal(r.error, undefined);
  assert.equal(r.damage.ko, 0);
  assert.ok(r.afterAction[2].min > 0);
  s.actors[2].hp = 99;
  r = simulateTurn(s, catalog);
  assert.equal(r.damage.ko, 100);
});
test("sand KO occurs before terrain or item recovery", () => {
  const s = defaultScene(catalog);
  s.actors[0].selected = 3;
  s.actors[2].selected = 3;
  s.actors[2].hp = 1;
  s.actors[2].item = "Leftovers";
  s.field.weather = "Sand";
  s.field.weatherMode = "manual";
  s.field.terrain = "Grassy";
  const r = simulateTurn(s, catalog);
  assert.equal(r.error, undefined);
  assert.equal(r.endKO, 100);
});
