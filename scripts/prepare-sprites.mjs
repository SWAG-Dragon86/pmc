import { readFile, writeFile, mkdir, access } from "node:fs/promises";
const catalog = JSON.parse(await readFile("src/data/catalog.json", "utf8"));
const supplement = JSON.parse(
  await readFile("src/data/resource-supplement.json", "utf8"),
);
const aliases = {
  taurospaldeacombat: "tauros-paldeacombat",
  taurospaldeablaze: "tauros-paldeablaze",
  taurospaldeaaqua: "tauros-paldeaaqua",
  meowsticfmega: "meowstic-fmega",
  meowsticmmega: "meowstic-mmega",
  kommoo: "kommoo",
};
let provenance = {};
try {
  provenance =
    JSON.parse(await readFile("src/data/sprites.json", "utf8")).provenance ||
    {};
} catch {}
await mkdir("public/sprites", { recursive: true });
let count = 0;
const missing = [];
for (let i = 0; i < catalog.pokemon.length; i += 10)
  await Promise.all(
    catalog.pokemon.slice(i, i + 10).map(async (p) => {
      const path = `public/sprites/${p.id}.png`;
      try {
        await access(path);
        count++;
        return;
      } catch {}
      const urls = [
        `https://play.pokemonshowdown.com/sprites/gen5/${aliases[p.id] || p.sprite}.png`,
        supplement.images[p.id]?.url,
      ].filter(Boolean);
      for (const url of urls) {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(30000),
        });
        if (
          !response.ok ||
          !response.headers.get("content-type")?.includes("image")
        )
          continue;
        const data = Buffer.from(await response.arrayBuffer());
        if (data.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a")
          continue;
        await writeFile(path, data);
        provenance[p.id] = { url, page: supplement.images[p.id]?.page };
        count++;
        return;
      }
      missing.push(p.id);
    }),
  );
await writeFile(
  "src/data/sprites.json",
  JSON.stringify({
    source: "https://play.pokemonshowdown.com/sprites/gen5/",
    count,
    missing,
    provenance,
  }),
);
console.log({ count, missing });
