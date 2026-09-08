import { readFile, writeFile } from "node:fs/promises";
const catalog = JSON.parse(await readFile("src/data/catalog.json", "utf8"));
const base =
  "https://web-view.app.pokemonchampions.jp/battle/pages/events/rs178402365238qpefxb/";
async function html(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status}: ${url}`);
  return r.text();
}
const [en, zh] = await Promise.all(
  ["en", "sc"].map(async (lang) => {
    const t = await html(`${base}${lang}/pokemon.html`);
    return JSON.parse(t.match(/const pokemons = (\[.*?\]);/s)[1]);
  }),
);
const id = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const forms = {
  "0670-005": "floetteeternal",
  "0678-001": "meowsticf",
  "0902-001": "basculegionf",
  "0128-001": "taurospaldeacombat",
  "0128-002": "taurospaldeablaze",
  "0128-003": "taurospaldeaaqua",
  "0479-001": "rotomheat",
  "0479-002": "rotomwash",
  "0479-003": "rotomfrost",
  "0479-004": "rotomfan",
  "0479-005": "rotommow",
  "0711-001": "gourgeistsmall",
  "0711-002": "gourgeistlarge",
  "0711-003": "gourgeistsuper",
  "0745-001": "lycanrocmidnight",
  "0745-002": "lycanrocdusk",
};
const roster = en.map(([code, , name]) => {
  let key = forms[code] || id(name.split(" (")[0]);
  if (!forms[code]) {
    if (name.includes("Alolan")) key += "alola";
    if (name.includes("Hisuian")) key += "hisui";
    if (name.includes("Galarian")) key += "galar";
  }
  return { code, id: key, name, zh: zh.find((r) => r[0] === code)?.[2] };
});
const missing = roster.filter(
  (r) => !catalog.pokemon.some((p) => p.id === r.id),
);
await writeFile(
  "src/data/roster-audit.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      regulation: "M-B",
      season: "M-5",
      announcement: "https://champions-news.pokemon-home.com/ja/page/803.html",
      source: `${base}sc/pokemon.html`,
      scope:
        "Current ranked eligibility, not a claim that all game mechanics or Mega forms are officially verified",
      roster,
      missing,
    },
    null,
    2,
  ),
);

function links(t, kind) {
  const rows = {};
  const re = new RegExp(
    `<a[^>]+href="[^\"]*/${kind}/([0-9]+)"[^>]*>([\\s\\S]*?)</a>`,
    "g",
  );
  for (const [, key, body] of t.matchAll(re)) {
    rows[key] ||= {};
    const img = body.match(/<img[^>]+src="([^\"]+)"/);
    const text = body.replace(/<[^>]+>/g, "").trim();
    if (img) rows[key].image = img[1].replaceAll("&amp;", "&");
    if (text)
      rows[key].name = text.replaceAll("&#x27;", "'").replaceAll("&amp;", "&");
  }
  return rows;
}
const supplement = {
  checkedAt: new Date().toISOString(),
  sources: [],
  translations: {},
  images: {},
};
function pageProps(t) {
  const payload = [
    ...t.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/gs),
  ]
    .map((m) => JSON.parse(m[1])[1])
    .filter((v) => typeof v === "string")
    .join("");
  const row = payload.split("\n").find((line) => line.includes("allPokemons"));
  if (!row) throw new Error("Pokemon resource schema changed");
  const tree = JSON.parse(row.slice(row.indexOf(":") + 1));
  function walk(v) {
    if (!v || typeof v !== "object") return;
    if (v.allPokemons) return v;
    for (const x of Object.values(v)) {
      const found = walk(x);
      if (found) return found;
    }
  }
  return walk(tree);
}
for (const kind of ["items", "pokemon"]) {
  const urls = ["en", "zh-hans"].map(
    (lang) => `https://gamewith.ai/pokemon-champions/${lang}/${kind}`,
  );
  supplement.sources.push(...urls);
  const pages = await Promise.all(urls.map(html));
  const [a, b] = pages.map((t) => links(t, kind));
  for (const [key, row] of Object.entries(a)) {
    if (!row.name || !b[key]?.name) continue;
    if (kind === "items") supplement.translations[row.name] = b[key].name;
    else {
      let speciesId = id(row.name);
      if (speciesId.startsWith("mega")) speciesId = speciesId.slice(4) + "mega";
      speciesId = speciesId.replace(/([xy])mega$/, "mega$1");
      if (row.image)
        supplement.images[speciesId] = {
          url: row.image,
          name: row.name,
          page: `${urls[0]}/${key}`,
        };
    }
  }
  if (kind === "pokemon") {
    const props = pages.map(pageProps);
    console.log(
      "Translation categories",
      Object.keys(props[0].translationMaps),
    );
    // Match only already-present species; external database flags never authorize adding a species.
    for (const p of catalog.pokemon.filter((p) => p.mega)) {
      const candidates = props[0].allPokemons.filter(
        (r) => r["全国図鑑"] === p.num && r["メガシンカ"] === "TRUE",
      );
      let row = candidates.length === 1 ? candidates[0] : undefined;
      if (p.id === "raichumegax")
        row = candidates.find((r) => r["画像No"] === "026_2");
      if (p.id === "raichumegay")
        row = candidates.find((r) => r["画像No"] === "026_3");
      if (p.id === "pyroarmega")
        row = candidates.find((r) => r["画像No"] === "668_2");
      if (row && /^[0-9_]+$/.test(row["画像No"]))
        supplement.images[p.id] = {
          name: p.name,
          page: `${urls[0]}/${row.ID}`,
          url: `https://img.gamewith.jp/article_tools/pokemon-champions/gacha/${row["画像No"]}.png`,
        };
    }
    for (const [kind, table] of Object.entries(props[0].translationMaps)) {
      if (kind !== "ability") continue;
      const chinese = props[1].translationMaps[kind] || {};
      for (const [jp, english] of Object.entries(table))
        if (typeof english === "string" && typeof chinese[jp] === "string")
          supplement.translations[english] = chinese[jp];
    }
  }
}
await writeFile(
  "src/data/resource-supplement.json",
  JSON.stringify(supplement, null, 2),
);
console.log({
  officialRoster: roster.length,
  missing,
  itemTranslations: Object.keys(supplement.translations).length,
  missingTranslations: catalog.items
    .filter((i) => i.name === i.zh && !supplement.translations[i.name])
    .map((i) => i.name),
  imageCandidates: Object.keys(supplement.images).length,
  stillMissingImages: JSON.parse(
    await readFile("src/data/sprites.json", "utf8"),
  ).missing.filter((id) => !supplement.images[id]),
});
