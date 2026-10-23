import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";

const catalog = JSON.parse(await readFile("src/data/catalog.json", "utf8"));
const info = JSON.parse(await readFile("src/data/sprites.json", "utf8"));
await mkdir("public/sprites", { recursive: true });
let count = 0;
const missing = [];
for (let i = 0; i < catalog.pokemon.length; i += 10) {
  await Promise.all(catalog.pokemon.slice(i, i + 10).map(async (pokemon) => {
    const path = `public/sprites/${pokemon.id}.png`;
    try { await access(path); count++; return; } catch {}
    const source = info.provenance[pokemon.id];
    // Never silently restore unreviewed game rips over licensed replacements.
    if (!["PMDCollab/SpriteCollab", "TheArtificial/pokemon-icons"].includes(source?.repository)) {
      missing.push(pokemon.id);
      return;
    }
    const response = await fetch(source.url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${pokemon.id}: HTTP ${response.status}`);
    let bytes = Buffer.from(await response.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== source.sourceSha256) {
      throw new Error(`${pokemon.id}: upstream checksum differs from reviewed source`);
    }
    if (source.frame) {
      const sheet = PNG.sync.read(bytes);
      const { left, top, width, height } = source.frame;
      if (left < 0 || top < 0 || width < 1 || height < 1 || left + width > sheet.width || top + height > sheet.height) {
        throw new Error(`${pokemon.id}: invalid reviewed frame`);
      }
      const frame = new PNG({ width, height });
      PNG.bitblt(sheet, frame, left, top, width, height, 0, 0);
      bytes = PNG.sync.write(frame);
    }
    PNG.sync.read(bytes);
    await writeFile(path, bytes);
    count++;
  }));
}
info.count = count;
info.missing = missing.sort();
await writeFile("src/data/sprites.json", JSON.stringify(info) + "\n");
console.log({ count, missing });
if (missing.length) {
  throw new Error("Unreviewed artwork is missing. Restore those tracked files from the local backup/Git, or obtain a licensed replacement; automatic game-image download is disabled.");
}
