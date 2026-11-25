import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const info = JSON.parse(await readFile("src/data/sprites.json", "utf8"));
const catalog = JSON.parse(await readFile("src/data/catalog.json", "utf8"));
if (info.repository !== "PokeAPI/sprites" || info.canvas !== 512) {
  throw new Error("Form images are not the normalized Pokémon HOME set. Run: node scripts/prepare-home-sprites.mjs");
}
const missing = [];
for (const pokemon of catalog.pokemon) {
  const recorded = info.provenance[pokemon.id];
  if (!recorded?.sha256) {
    missing.push(pokemon.id);
    continue;
  }
  try {
    const bytes = await readFile(`public/sprites/${pokemon.id}.png`);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== recorded.sha256 || bytes.readUInt32BE(16) !== 512 || bytes.readUInt32BE(20) !== 512) {
      missing.push(pokemon.id);
    }
  } catch {
    missing.push(pokemon.id);
  }
}
console.log({ count: catalog.pokemon.length - missing.length, missing });
if (missing.length) {
  throw new Error("HOME form images are missing or do not match the recorded checksums. Run: node scripts/prepare-home-sprites.mjs");
}
