import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createBuild, defaultScene, validateBuild } from "../src/model.mjs";
import { previewDamage } from "../src/engine.mjs";

const json = (path) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const catalog = json("../src/data/catalog.json");
const mc = json("../src/data/mc-manifest.json");
const dataVersion = json("../public/data-version.json");

test("M-C live metadata and all expanded selectable forms are present", () => {
  assert.equal(catalog.meta.gameVersion, "1.2.0");
  assert.equal(catalog.meta.regulation, "M-C");
  assert.equal(catalog.meta.season, "M-6");
  assert.equal(catalog.meta.status, "live-regulation");
  assert.equal(mc.pokemon.length, 35);
  assert.equal(dataVersion.version, "mc-1.2.0-111407c9");
  for (const entry of mc.pokemon) {
    const pokemon = catalog.pokemon.find((candidate) => candidate.id === entry.id);
    assert.ok(pokemon, entry.id);
    assert.equal(pokemon.zh, entry.zh, entry.id);
    assert.ok(pokemon.moves.length > 0, `${entry.id} move pool`);
    assert.deepEqual(validateBuild(createBuild(catalog, entry.id), catalog), []);
  }
});

test("M-C Mega stats, abilities and stones match the current Champions dex", () => {
  const checks = {
    absolmegaz: [[65, 154, 60, 75, 60, 151], "Sharpness", "Absolite Z"],
    salamencemega: [[95, 145, 130, 120, 90, 120], "Aerilate", "Salamencite"],
    garchompmegaz: [[108, 130, 85, 141, 85, 151], "Levitate", "Garchompite Z"],
    lucariomegaz: [[70, 100, 70, 164, 70, 151], "Aura Guard", "Lucarionite Z"],
    golisopodmega: [[75, 150, 175, 70, 120, 40], "Tough Claws", "Golisopite"],
    baxcaliburmega: [[115, 175, 117, 105, 101, 87], "Thermal Exchange", "Baxcalibrite"],
  };
  for (const [id, [stats, ability, item]] of Object.entries(checks)) {
    const pokemon = catalog.pokemon.find((entry) => entry.id === id);
    assert.deepEqual(
      [pokemon.stats.hp, pokemon.stats.atk, pokemon.stats.def, pokemon.stats.spa, pokemon.stats.spd, pokemon.stats.spe],
      stats,
      id,
    );
    assert.deepEqual(pokemon.abilities, [ability], id);
    assert.equal(pokemon.requiredItem, item, id);
  }
});

test("new M-C items and signature moves are selectable with Chinese labels", () => {
  for (const itemName of mc.items) {
    const item = catalog.items.find((candidate) => candidate.name === itemName);
    assert.ok(item, itemName);
    assert.match(item.zh, /[\u3400-\u9fff]/, itemName);
  }
  for (const moveName of [
    "Court Change", "Double Shock", "Drum Beating", "Glaive Rush", "Jaw Lock",
    "Meteor Assault", "Milk Drink", "Octolock", "Pyro Ball", "Revival Blessing",
    "Shift Gear", "Slash", "Snipe Shot", "Zing Zap",
  ]) {
    const id = moveName.toLowerCase().replace(/[^a-z0-9]/g, "");
    assert.ok(catalog.moves[id], moveName);
    assert.match(catalog.moves[id].zh, /[\u3400-\u9fff]/, moveName);
  }
});

test("Aura Guard halves contact damage and Mega Golisopod Tough Claws boosts it", () => {
  const scene = defaultScene(catalog);
  const attacker = createBuild(catalog, "charizardmegax");
  attacker.moves = ["flareblitz", "", "", ""];
  const guarded = createBuild(catalog, "lucariomegaz");
  const plain = structuredClone(guarded);
  plain.ability = "Inactive Aura Guard";
  scene.actors[0] = attacker;
  scene.actors[2] = guarded;
  const reduced = previewDamage(attacker, guarded, "flareblitz", scene, catalog);
  const plainCatalog = structuredClone(catalog);
  plainCatalog.pokemon.find((entry) => entry.id === "lucariomegaz").abilities.push("Inactive Aura Guard");
  scene.actors[2] = plain;
  const normal = previewDamage(attacker, plain, "flareblitz", scene, plainCatalog);
  assert.ok(reduced.max < normal.max * 0.55, `${reduced.max} < ${normal.max}`);

  const golisopod = createBuild(catalog, "golisopodmega");
  golisopod.moves = ["firstimpression", "", "", ""];
  const target = createBuild(catalog, "pikachu");
  scene.actors[0] = golisopod;
  scene.actors[2] = target;
  const boosted = previewDamage(golisopod, target, "firstimpression", scene, catalog);
  const noAbility = structuredClone(golisopod);
  noAbility.ability = "Inactive Tough Claws";
  const noAbilityCatalog = structuredClone(catalog);
  noAbilityCatalog.pokemon.find((entry) => entry.id === "golisopodmega").abilities.push("Inactive Tough Claws");
  scene.actors[0] = noAbility;
  const baseline = previewDamage(noAbility, target, "firstimpression", scene, noAbilityCatalog);
  assert.ok(boosted.max > baseline.max * 1.2, `${boosted.max} > ${baseline.max}`);
});
