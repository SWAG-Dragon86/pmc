import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { build, transform } from "esbuild";

const root = resolve(".");
const lockPath = resolve("src/data/sources.json");
let previous;
try {
  previous = JSON.parse(await readFile(lockPath, "utf8"));
} catch {}
const headers = { "User-Agent": "PMC-local-builder" };
async function get(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.text();
}
async function save(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}
async function commit(repo, key) {
  if (previous?.[key]?.commit) return previous[key].commit;
  const meta = JSON.parse(await get(`https://api.github.com/repos/${repo}`));
  return JSON.parse(
    await get(
      `https://api.github.com/repos/${repo}/commits/${meta.default_branch}`,
    ),
  ).sha;
}
const repos = {
  calc: "smogon/damage-calc",
  showdown: "smogon/pokemon-showdown",
  chinese: "professorsidon/VGC-Damage-Calculator-Chinese",
};
const versions = {};
for (const [key, repo] of Object.entries(repos))
  versions[key] = { repo, commit: await commit(repo, key) };
console.log("Pinned sources:", versions);
await save(lockPath, JSON.stringify(versions, null, 2));
async function source(key, path) {
  const location = resolve("vendor", key, path);
  try {
    return await readFile(location, "utf8");
  } catch {}
  const s = await get(
    `https://raw.githubusercontent.com/${repos[key]}/${versions[key].commit}/${path}`,
  );
  await save(location, s);
  return s;
}
const tree = JSON.parse(
  await get(
    `https://api.github.com/repos/${repos.calc}/git/trees/${versions.calc.commit}?recursive=1`,
  ),
).tree;
const calcFiles = tree.filter(
  (x) =>
    x.path.startsWith("calc/src/") &&
    x.path.endsWith(".ts") &&
    !/test|benchmark/.test(x.path),
);
for (let i = 0; i < calcFiles.length; i += 8)
  await Promise.all(
    calcFiles.slice(i, i + 8).map((x) => source("calc", x.path)),
  );
await source("calc", "LICENSE");
await source("showdown", "LICENSE");
await build({
  entryPoints: ["vendor/calc/calc/src/index.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  outfile: "src/vendor/calc.mjs",
  banner: {
    js: "const exports = {}; // Upstream CommonJS monkey-patch compatibility.",
  },
  legalComments: "eof",
});
const calc = await import(pathToFileURL(resolve("src/vendor/calc.mjs")));
const generation = calc.Generations.get(0);
if (new calc.Pokemon(0, "Pikachu").rawStats.hp !== 110)
  throw new Error("Champions stat formula not active");
async function table(path, key) {
  const raw = await source("showdown", path);
  const { code } = await transform(raw, { loader: "ts", format: "esm" });
  // Only trusted, pinned public data modules are loaded during the build, never user imports.
  const output = resolve("vendor/generated", path.replace(/\.ts$/, ".mjs"));
  await save(output, code);
  return (await import(pathToFileURL(output)))[key];
}
const formats = await table(
  "data/mods/champions/formats-data.ts",
  "FormatsData",
);
const learnsets = await table("data/mods/champions/learnsets.ts", "Learnsets");
const pokedex = await table("data/pokedex.ts", "Pokedex");
const moveBase = await table("data/moves.ts", "Moves");
const movePatch = await table("data/mods/champions/moves.ts", "Moves");
const itemBase = await table("data/items.ts", "Items");
const itemPatch = await table("data/mods/champions/items.ts", "Items");
const translation = await source(
  "chinese",
  "script_res/translate/translate.js",
);
await source("chinese", "script_res/translate/LICENSE");
const dictionaries = {};
for (const key of [
  "ABILITYNAMES",
  "ITEMNAMES",
  "NATURENAMES",
  "POKENAMES",
  "MOVENAMES",
]) {
  const match = translation.match(
    new RegExp(
      `(?:var|let|const) ${key}\\s*=\\s*(\\{[\\s\\S]*?\\})\\s*(?:;|\\n)`,
    ),
  );
  if (match)
    for (const pair of match[1].matchAll(
      /"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g,
    )) {
      dictionaries[JSON.parse(`"${pair[1]}"`)] = JSON.parse(`"${pair[2]}"`);
    }
}
for (const kind of ["pokemon", "moves"]) {
  const data = JSON.parse(
    await source("chinese", `script_res/translate/${kind}.json`),
  );
  if (!Array.isArray(data)) Object.assign(dictionaries, data);
}
const id = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const dictById = Object.fromEntries(
  Object.entries(dictionaries)
    .filter(([, v]) => typeof v === "string")
    .map(([k, v]) => [id(k), v]),
);
const nameOf = (name) => dictionaries[name] || dictById[id(name)] || name;
const audit = JSON.parse(await readFile("src/data/roster-audit.json", "utf8"));
const supplement = JSON.parse(
  await readFile("src/data/resource-supplement.json", "utf8"),
);
Object.assign(dictionaries, supplement.translations);
// Formats-data is a mod patch, not a complete roster: inherited entries may be absent.
for (const p of audit.roster) if (!formats[p.id]) formats[p.id] = {};
const pokemon = [];
const missing = [];
const stateNames = {
  castformsunny: "飘浮泡泡（太阳的样子）",
  castformrainy: "飘浮泡泡（雨水的样子）",
  castformsnowy: "飘浮泡泡（雪云的样子）",
  aegislashblade: "坚盾剑怪（刀剑形态）",
};
for (const [key, format] of Object.entries(formats)) {
  if (format.isNonstandard || format.tier === "Illegal") continue;
  const raw = pokedex[key];
  const species = generation.species.get(
    key === "aegislash" ? "aegislashshield" : key,
  );
  if (!raw || !species) {
    missing.push(key);
    continue;
  }
  const base = id(raw.baseSpecies || raw.name);
  let learned =
    learnsets[key]?.learnset ||
    (key === "meowsticfmega" ? learnsets.meowsticf?.learnset : undefined) ||
    learnsets[base]?.learnset ||
    (key === "floettemega" ? learnsets.floetteeternal?.learnset : undefined);
  if (!learned) {
    missing.push(key);
    continue;
  }
  const moves = Object.keys(learned).filter(
    (m) =>
      generation.moves.get(m) && moveBase[m] && !movePatch[m]?.isNonstandard,
  );
  if (!moves.length) {
    missing.push(key);
    continue;
  }
  let zh = audit.roster.find((p) => p.id === key)?.zh || nameOf(raw.name);
  const isMega = /(?:^|-)Mega(?:-|$)/.test(raw.forme || "");
  if (isMega) {
    const suffix = raw.forme.match(/Mega-([XY])/)?.[1] || "";
    const gender =
      key === "meowsticfmega"
        ? "（雌性）"
        : key === "meowsticmmega"
          ? "（雄性）"
          : "";
    zh = `超级${nameOf(raw.baseSpecies)}${suffix}${gender}`;
  }
  if (zh === raw.name && raw.baseSpecies) {
    const form = (raw.forme || "")
      .replace("Mega", "Mega ")
      .replace("Alola", "阿罗拉")
      .replace("Galar", "伽勒尔")
      .replace("Hisui", "洗翠")
      .replace("Paldea", "帕底亚");
    zh = `${nameOf(raw.baseSpecies)} ${form}`;
  }
  zh = stateNames[key] || zh;
  pokemon.push({
    id: key,
    name: species.name,
    zh,
    types: species.types,
    stats: species.baseStats,
    abilities: isMega
      ? Object.values(species.abilities)
      : Object.values(raw.abilities),
    moves,
    num: raw.num,
    base,
    mega: isMega,
    requiredItem: raw.requiredItem || "",
    sprite: raw.name
      .toLowerCase()
      .replace(/-mega-/g, "-mega")
      .replace(/[^a-z0-9-]/g, ""),
  });
}
const moveIds = new Set(pokemon.flatMap((p) => p.moves));
const moves = {};
for (const key of moveIds) {
  const m = { ...moveBase[key], ...movePatch[key] };
  moves[key] = {
    id: key,
    name: m.name,
    zh: nameOf(m.name),
    type: m.type,
    category: m.category,
    power: m.basePower,
    priority: m.priority || 0,
    target: m.target,
    flags: m.flags || {},
    multihit: m.multihit || null,
    recoil: m.recoil || null,
    drain: m.drain || null,
    heal: m.heal || null,
    boosts: m.boosts || null,
    self: m.self ? { boosts: m.self.boosts } : null,
    secondary: m.secondary
      ? {
          chance: m.secondary.chance,
          boosts: m.secondary.boosts,
          status: m.secondary.status,
          self: m.secondary.self ? { boosts: m.secondary.self.boosts } : null,
        }
      : null,
    secondaries: m.secondaries || null,
    status: m.status || null,
    weather: m.weather || null,
    terrain: m.terrain || null,
    forceSwitch: !!m.forceSwitch,
    selfSwitch: !!m.selfSwitch,
  };
}
const items = [{ id: "", name: "", zh: "不携带道具" }];
for (const [key, rawItem] of Object.entries(itemBase)) {
  if (itemPatch[key]?.isNonstandard || !generation.items.get(key)) continue;
  items.push({
    id: key,
    name: itemBase[key].name,
    zh: nameOf(itemBase[key].name),
  });
}
const abilities = [...new Set(pokemon.flatMap((p) => p.abilities))].map(
  (name) => ({ id: name, name, zh: nameOf(name) }),
);
const natures = [...generation.natures].map((n) => ({
  id: n.name,
  name: n.name,
  zh: nameOf(n.name),
  plus: n.plus,
  minus: n.minus,
}));
const catalog = {
  meta: {
    label: "Champions 社区数据预览",
    status: "community-unverified",
    gameVersion: null,
    builtAt: new Date().toISOString(),
    source: versions,
    missing,
  },
  pokemon,
  moves,
  items,
  abilities,
  natures,
};
await save("src/data/catalog.json", JSON.stringify(catalog));
await save(lockPath, JSON.stringify(versions, null, 2));
await save(
  "public/data-version.json",
  JSON.stringify({
    version: versions.showdown.commit.slice(0, 8),
    status: catalog.meta.status,
    gameVersion: null,
  }),
);
console.log(
  JSON.stringify(
    {
      pokemon: pokemon.length,
      moves: moveIds.size,
      items: items.length,
      missing,
      translations: Object.keys(dictById).length,
      sha256: createHash("sha256")
        .update(JSON.stringify(catalog))
        .digest("hex"),
    },
    null,
    2,
  ),
);
