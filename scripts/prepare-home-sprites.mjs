import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  CANVAS,
  HOME_REPOSITORY,
  MODIFICATION,
  fitHomeSprite,
  homeCommit,
  homePage,
  homeUrl,
  loadPokemonIds,
  readJson,
  resolveHomeIds,
  sha256,
  spriteCreditRow,
} from "./home-sprites.mjs";

const commit = await homeCommit();
const catalog = await readJson("src/data/catalog.json");
const forms = resolveHomeIds(catalog.pokemon, await loadPokemonIds());
await mkdir("public/sprites", { recursive: true });

const provenance = {};
const failures = [];
for (let index = 0; index < forms.length; index += 8) {
  await Promise.all(forms.slice(index, index + 8).map(async (form) => {
    const url = homeUrl(commit, form.pokeapiId);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const sourceBytes = Buffer.from(await response.arrayBuffer());
      if (sourceBytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
        throw new Error("response is not a PNG");
      }
      const fitted = fitHomeSprite(sourceBytes);
      const bytes = Buffer.from(fitted.bytes);
      if (bytes.readUInt32BE(16) !== CANVAS || bytes.readUInt32BE(20) !== CANVAS) {
        throw new Error("normalized canvas is not square");
      }
      await writeFile(`public/sprites/${form.id}.png`, bytes);
      provenance[form.id] = {
        pokeapiId: form.pokeapiId,
        identifier: form.identifier,
        url,
        page: homePage(commit, form.pokeapiId),
        repository: HOME_REPOSITORY,
        commit,
        licenses: ["Copyright-The-Pokemon-Company"],
        authors: [{ name: "The Pokémon Company" }],
        modification: MODIFICATION,
        sourceSha256: sha256(sourceBytes),
        sha256: sha256(bytes),
        width: CANVAS,
        height: CANVAS,
        contentWidth: fitted.contentWidth,
        contentHeight: fitted.contentHeight,
      };
    } catch (error) {
      failures.push(`${form.id} ${url}: ${error.message}`);
    }
  }));
}

if (failures.length || Object.keys(provenance).length !== forms.length) {
  console.error(failures.join("\n"));
  throw new Error(`${failures.length} HOME renders failed`);
}
if (provenance.meowsticmmega?.sourceSha256 === provenance.meowsticfmega?.sourceSha256) {
  const shared = " PokeAPI/sprites currently serves one HOME file for both Mega Meowstic forms; the catalog entries stay separate.";
  provenance.meowsticmmega.modification += shared;
  provenance.meowsticfmega.modification += shared;
}

const info = {
  source: "Pokémon HOME full-body renders from PokeAPI/sprites sprites/pokemon/other/home. Ordinary, regional and Mega forms share this set, normalized to one canvas and padding. Image contents are copyright The Pokémon Company; the repository CC0 statement does not license them.",
  repository: HOME_REPOSITORY,
  commit,
  canvas: CANVAS,
  paddingRatio: 0.08,
  count: forms.length,
  missing: [],
  provenance,
};
await writeFile("src/data/sprites.json", JSON.stringify(info) + "\n");

const attribution = await readJson("src/data/artwork-attribution.json");
const kept = attribution.filter((entry) => !entry.path.startsWith("public/sprites/"));
const spriteAttribution = forms.map((form) => ({
  path: `public/sprites/${form.id}.png`,
  authors: ["The Pokémon Company"],
  licenses: ["Copyright-The-Pokemon-Company"],
  source: provenance[form.id].page,
  modification: provenance[form.id].modification,
}));
await writeFile(
  "src/data/artwork-attribution.json",
  JSON.stringify([...spriteAttribution, ...kept]) + "\n",
);

const artwork = await readJson("public/licenses/artwork.json");
const keptEntries = artwork.entries.filter((entry) => !String(entry.path).startsWith("public/sprites/"));
artwork.reviewDate = "2026-11-26";
artwork.scope = "350 form images are Pokémon HOME renders redistributed by PokeAPI/sprites. Image contents are copyright The Pokémon Company; repository CC0 does not license them and no official character or trademark clearance is claimed. Other component credits remain on their own entries.";
artwork.entries = [
  ...forms.map((form) => ({
    id: form.id,
    name: form.name,
    path: `public/sprites/${form.id}.png`,
    repository: HOME_REPOSITORY,
    commit,
    upstreamPath: `sprites/pokemon/other/home/${form.pokeapiId}.png`,
    url: provenance[form.id].url,
    sourcePage: provenance[form.id].page,
    pokeapiId: form.pokeapiId,
    identifier: form.identifier,
    authors: [{ name: "The Pokémon Company" }],
    licenses: ["Copyright-The-Pokemon-Company"],
    modification: provenance[form.id].modification,
    sourceSha256: provenance[form.id].sourceSha256,
    sha256: provenance[form.id].sha256,
    width: CANVAS,
    height: CANVAS,
  })),
  ...keptEntries,
];
await writeFile("public/licenses/artwork.json", JSON.stringify(artwork, null, 2) + "\n");

const creditRows = forms.map((form) => spriteCreditRow({
  id: form.id,
  page: provenance[form.id].page,
  modification: provenance[form.id].modification,
})).join("\n");
for (const path of ["docs/ASSET_CREDITS.md", "public/licenses/artwork-credits.txt"]) {
  const text = await readFile(path, "utf8");
  const replaced = text.replace(/^\| `public\/sprites\/[^`]+` \|.*$/gm, "").replace(/\n{3,}/g, "\n\n");
  const marker = "| Local file | Artist / attribution | License / permission | Source | Modification / mapping |\n| --- | --- | --- | --- | --- |\n";
  if (!replaced.includes(marker)) throw new Error(`${path} is missing the credits table header`);
  await writeFile(path, replaced.replace(marker, marker + creditRows + "\n"));
}

console.log({ commit, count: forms.length, missing: failures.length });
