import { readFile, writeFile } from "node:fs/promises";
import {
  BALL_CANVAS,
  BALL_COMMIT,
  BALL_MODIFICATION,
  BALL_REPOSITORY,
  BALL_SCALE,
  ballCreditRow,
  ballPage,
  ballUrl,
  fitBallSprite,
  loadShareBalls,
  sha256,
} from "./ball-sprites.mjs";
import { readJson } from "./home-sprites.mjs";

const data = await loadShareBalls();
const provenance = {};
const failures = [];

for (let index = 0; index < data.balls.length; index += 8) {
  await Promise.all(data.balls.slice(index, index + 8).map(async (ball) => {
    const url = ballUrl(ball.name);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const sourceBytes = Buffer.from(await response.arrayBuffer());
      if (sourceBytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
        throw new Error("response is not a PNG");
      }
      const fitted = fitBallSprite(sourceBytes);
      const bytes = Buffer.from(fitted.bytes);
      if (bytes.readUInt32BE(16) !== BALL_CANVAS || bytes.readUInt32BE(20) !== BALL_CANVAS) {
        throw new Error("normalized canvas is not 144×144");
      }
      await writeFile(`public/share-balls/${ball.name}.png`, bytes);
      provenance[ball.name] = {
        url,
        page: ballPage(ball.name),
        repository: BALL_REPOSITORY,
        commit: BALL_COMMIT,
        licenses: ["Copyright-The-Pokemon-Company"],
        authors: [{ name: "The Pokémon Company" }],
        modification: BALL_MODIFICATION,
        sourceSha256: sha256(sourceBytes),
        sha256: sha256(bytes),
        width: BALL_CANVAS,
        height: BALL_CANVAS,
        contentWidth: fitted.contentWidth,
        contentHeight: fitted.contentHeight,
      };
    } catch (error) {
      failures.push(`${ball.name} ${url}: ${error.message}`);
    }
  }));
}

if (failures.length || Object.keys(provenance).length !== data.balls.length) {
  console.error(failures.join("\n"));
  throw new Error(`${failures.length} ball icons failed`);
}

data.source = {
  repository: BALL_REPOSITORY,
  commit: BALL_COMMIT,
  path: "sprites/items",
  canvas: BALL_CANVAS,
  scale: BALL_SCALE,
  note: "All 37 selectable balls use PokeAPI/sprites item icons from GitHub. Image contents are copyright The Pokémon Company; the repository CC0 statement does not license them. The maintainer removed the unverified Strange Ball.",
};
data.provenance = provenance;
await writeFile("src/data/share-balls.json", JSON.stringify(data) + "\n");

const attribution = await readJson("src/data/artwork-attribution.json");
const keptAttribution = attribution.filter((entry) => !entry.path.startsWith("public/share-balls/"));
const ballAttribution = data.balls.map((ball) => ({
  path: `public/share-balls/${ball.name}.png`,
  authors: ["The Pokémon Company"],
  licenses: ["Copyright-The-Pokemon-Company"],
  source: provenance[ball.name].page,
  modification: BALL_MODIFICATION,
}));
await writeFile(
  "src/data/artwork-attribution.json",
  JSON.stringify([...keptAttribution, ...ballAttribution]) + "\n",
);

const artwork = await readJson("public/licenses/artwork.json");
const keptEntries = artwork.entries.filter((entry) => !String(entry.path).startsWith("public/share-balls/"));
artwork.reviewDate = "2026-11-26";
artwork.scope = "350 form images are Pokémon HOME renders and 37 Poké Ball icons are item sprites, both redistributed by PokeAPI/sprites. Image contents are copyright The Pokémon Company; repository CC0 does not license them and no official character or trademark clearance is claimed. Other component credits remain on their own entries.";
artwork.entries = [
  ...keptEntries,
  ...data.balls.map((ball) => ({
    id: ball.name,
    name: ball.names.en,
    path: `public/share-balls/${ball.name}.png`,
    repository: BALL_REPOSITORY,
    commit: BALL_COMMIT,
    upstreamPath: `sprites/items/${ball.name}.png`,
    url: provenance[ball.name].url,
    sourcePage: provenance[ball.name].page,
    authors: [{ name: "The Pokémon Company" }],
    licenses: ["Copyright-The-Pokemon-Company"],
    modification: BALL_MODIFICATION,
    sourceSha256: provenance[ball.name].sourceSha256,
    sha256: provenance[ball.name].sha256,
    width: BALL_CANVAS,
    height: BALL_CANVAS,
  })),
];
await writeFile("public/licenses/artwork.json", JSON.stringify(artwork, null, 2) + "\n");

const intro = "18 type icons retain James Watkins / partywhale MIT terms. 37 Poké Ball icons use PokeAPI/sprites `sprites/items` at the same commit, enlarged 6× with nearest-neighbor sampling onto a 144×144 canvas. Those image contents are copyright The Pokémon Company; repository CC0 does not license them. The mascot and icon family still uses Emmuffin's SpriteCollab Rotom Dex portrait. The default background is maintainer-confirmed original and retained unchanged; a standalone reuse license has not been selected.";
const history = "The 2026-10-23 publication used SpriteCollab frames and portraits plus The Artificial icons for these 350 files. Those form files have been replaced. The 37 Poké Ball icons later moved from Cobblemon Assets to PokeAPI/sprites item icons. Type icons, the Rotom portrait and the background are unchanged. Repository screenshots still show the previous form images until they are recaptured.";
const creditRows = data.balls.map((ball) => ballCreditRow(ball)).join("\n");
for (const path of ["docs/ASSET_CREDITS.md", "public/licenses/artwork-credits.txt"]) {
  let text = await readFile(path, "utf8");
  text = text.replace(/^18 type icons retain James Watkins \/ partywhale MIT terms\..*$/m, intro);
  text = text.replace(/^The 2026-10-23 publication used SpriteCollab frames and portraits plus The Artificial icons for these 350 files\..*$/m, history);
  const replaced = text.replace(
    /\| `public\/share-balls\/master-ball\.png` \|[\s\S]*?\| `public\/share-balls\/love-ball\.png` \|.*\n/,
    `${creditRows}\n`,
  );
  if (replaced === text || !replaced.includes("`public/share-balls/poke-ball.png`")) {
    throw new Error(`${path} is missing the Poké Ball credit rows`);
  }
  await writeFile(path, replaced);
}

console.log({ commit: BALL_COMMIT, count: data.balls.length, missing: failures.length });
