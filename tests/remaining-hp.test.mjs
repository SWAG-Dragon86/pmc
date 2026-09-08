import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createBuild,
  defaultScene,
  withMandatoryActions,
} from "../src/model.mjs";
import { simulateTurn, statsOf } from "../src/engine.mjs";
const catalog = JSON.parse(
  readFileSync(new URL("../src/data/catalog.json", import.meta.url)),
);
function screenshotScene() {
  const s = defaultScene(catalog);
  s.actors[0] = createBuild(catalog, "charizardmegay");
  s.actors[0].points.spa = 0;
  s.actors[0].moves = ["flamethrower", "", "", ""];
  s.actors[2] = createBuild(catalog, "lycanrocdusk");
  s.actors[2].ability = "Tough Claws";
  s.actors[2].moves = ["accelerock", "", "", ""];
  s.actors[2].active = false;
  return s;
}
test("legacy inactive Lycanroc still uses Accelerock first and finishes with 100% HP", () => {
  const s = screenshotScene();
  const r = simulateTurn(s, catalog);
  assert.equal(r.error, undefined);
  assert.deepEqual(r.remaining, { min: 100, max: 100, mean: 100 });
  assert.equal(r.afterAction[0].max, 0);
  assert.equal(r.damage.max, 0);
  assert.equal(r.log.length, 1);
  assert.match(r.log[0], /冲岩/);
  assert.equal(
    s.actors[2].active,
    false,
    "calculator must not mutate a saved snapshot",
  );
});
test("mandatory actions apply to every actionable slot and retain passive doubles slot", () => {
  const s = screenshotScene();
  s.actors.forEach((b) => (b.active = false));
  const normalized = withMandatoryActions(s);
  assert.deepEqual(
    normalized.actors.map((b) => b.active),
    [true, true, true, false],
  );
  assert.deepEqual(
    s.actors.map((b) => b.active),
    [false, false, false, false],
  );
  assert.equal(defaultScene(catalog).actors[2].active, true);
});
test("remaining HP accounts for initial HP and end-turn healing, not 100 minus damage", () => {
  const s = defaultScene(catalog);
  s.actors[0].selected = 3;
  s.actors[2].selected = 3;
  s.actors[2].hp = 50;
  s.actors[2].item = "Leftovers";
  const r = simulateTurn(s, catalog);
  assert.equal(r.error, undefined);
  const max = statsOf(s.actors[2], catalog).hp;
  const expected = ((Math.floor(max * 0.5) + Math.floor(max / 16)) / max) * 100;
  assert.equal(r.afterAction[2].mean, 50);
  assert.equal(r.remaining.mean, expected);
  assert.equal(r.remaining.min, expected);
  assert.equal(r.remaining.max, expected);
  assert.notEqual(r.remaining.mean, 100 - r.damage.mean);
});
test("remaining mean uses branch probability and includes end-turn recovery", () => {
  const s = defaultScene(catalog);
  s.actors[2] = createBuild(catalog, "milotic");
  assert.equal(s.actors[2].species, "milotic", "test species must exist in Champions");
  s.actors[2].moves = ["icebeam", "", "", ""];
  s.actors[2].hp = 50;
  s.actors[2].item = "Leftovers";
  const r = simulateTurn(s, catalog);
  assert.equal(r.error, undefined);
  assert.ok(r.remaining.min < r.remaining.max);
  const hp = statsOf(s.actors[2], catalog).hp;
  assert.ok(
    Math.abs(
      r.remaining.mean -
        (r.afterAction[2].mean + (Math.floor(hp / 16) / hp) * 100),
    ) < 1e-9,
  );
  assert.deepEqual(r.remaining, r.afterEnd[2]);
});
