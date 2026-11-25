// Pokémon HOME full-body renders for every catalog form.
// Image contents are copyright The Pokémon Company. The PokeAPI/sprites
// repository CC0 statement does not license those images.

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { PNG } from "pngjs";

export const CANVAS = 512;
export const PADDING_RATIO = 0.08;
export const ALPHA_THRESHOLD = 8;
export const HOME_REPOSITORY = "PokeAPI/sprites";
export const HOME_PATH = "sprites/pokemon/other/home";

export const MODIFICATION =
  "Transparent bounds trimmed, then fitted and centered on a 512×512 canvas with 8% padding on the long side. No recoloring.";

const IDENTIFIER_OVERRIDE = {
  "charizard-megax": "charizard-mega-x",
  "charizard-megay": "charizard-mega-y",
  "raichu-megax": "raichu-mega-x",
  "raichu-megay": "raichu-mega-y",
  mrmime: "mr-mime",
  mrrime: "mr-rime",
  "tauros-paldea-combat": "tauros-paldea-combat-breed",
  "tauros-paldea-blaze": "tauros-paldea-blaze-breed",
  "tauros-paldea-aqua": "tauros-paldea-aqua-breed",
  basculegion: "basculegion-male",
  "basculegion-f": "basculegion-female",
  pyroar: "pyroar-male",
  meowstic: "meowstic-male",
  "meowstic-f": "meowstic-female",
  "meowstic-m-mega": "meowstic-male-mega",
  "meowstic-f-mega": "meowstic-female-mega",
  gourgeist: "gourgeist-average",
  lycanroc: "lycanroc-midday",
  mimikyu: "mimikyu-disguised",
  toxtricity: "toxtricity-amped",
  indeedee: "indeedee-male",
  "indeedee-f": "indeedee-female",
  maushold: "maushold-family-of-four",
  squawkabilly: "squawkabilly-green-plumage",
  "squawkabilly-blue": "squawkabilly-blue-plumage",
  "squawkabilly-yellow": "squawkabilly-yellow-plumage",
  "squawkabilly-white": "squawkabilly-white-plumage",
  "absol-megaz": "absol-mega-z",
  "garchomp-megaz": "garchomp-mega-z",
  "lucario-megaz": "lucario-mega-z",
  aegislash: "aegislash-shield",
  palafin: "palafin-zero",
  morpeko: "morpeko-full-belly",
};

export function homeIdentifier(spriteSlug) {
  return IDENTIFIER_OVERRIDE[spriteSlug] || spriteSlug;
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function opaqueBounds(png, threshold = ALPHA_THRESHOLD) {
  let minX = png.width;
  let minY = png.height;
  let maxX = -1;
  let maxY = -1;
  const { data, width } = png;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= threshold) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) throw new Error("HOME render has no visible pixels");
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function sampleBox(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  const xRatio = sw / dw;
  const yRatio = sh / dh;
  for (let y = 0; y < dh; y++) {
    const y0 = y * yRatio;
    const y1 = (y + 1) * yRatio;
    const yStart = Math.floor(y0);
    const yEnd = Math.min(sh, Math.max(yStart + 1, Math.ceil(y1)));
    for (let x = 0; x < dw; x++) {
      const x0 = x * xRatio;
      const x1 = (x + 1) * xRatio;
      const xStart = Math.floor(x0);
      const xEnd = Math.min(sw, Math.max(xStart + 1, Math.ceil(x1)));
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      let weightSum = 0;
      for (let yy = yStart; yy < yEnd; yy++) {
        const yWeight = Math.min(yy + 1, y1) - Math.max(yy, y0);
        if (yWeight <= 0) continue;
        for (let xx = xStart; xx < xEnd; xx++) {
          const xWeight = Math.min(xx + 1, x1) - Math.max(xx, x0);
          if (xWeight <= 0) continue;
          const weight = xWeight * yWeight;
          const index = (yy * sw + xx) * 4;
          const pixelAlpha = src[index + 3] / 255;
          red += src[index] * pixelAlpha * weight;
          green += src[index + 1] * pixelAlpha * weight;
          blue += src[index + 2] * pixelAlpha * weight;
          alpha += src[index + 3] * weight;
          weightSum += weight;
        }
      }
      const outIndex = (y * dw + x) * 4;
      if (weightSum <= 0 || alpha <= 0) continue;
      const outAlpha = alpha / weightSum;
      out[outIndex] = Math.max(0, Math.min(255, Math.round((red * 255) / alpha)));
      out[outIndex + 1] = Math.max(0, Math.min(255, Math.round((green * 255) / alpha)));
      out[outIndex + 2] = Math.max(0, Math.min(255, Math.round((blue * 255) / alpha)));
      out[outIndex + 3] = Math.max(0, Math.min(255, Math.round(outAlpha)));
    }
  }
  return out;
}

export function fitHomeSprite(sourceBytes) {
  const source = PNG.sync.read(sourceBytes);
  const bounds = opaqueBounds(source);
  const crop = new PNG({ width: bounds.width, height: bounds.height });
  PNG.bitblt(source, crop, bounds.left, bounds.top, bounds.width, bounds.height, 0, 0);
  const inner = Math.round(CANVAS * (1 - PADDING_RATIO * 2));
  const scale = inner / Math.max(bounds.width, bounds.height);
  let targetWidth = Math.max(1, Math.round(bounds.width * scale));
  let targetHeight = Math.max(1, Math.round(bounds.height * scale));
  if (targetWidth > inner || targetHeight > inner) {
    const fitted = inner / Math.max(targetWidth, targetHeight);
    targetWidth = Math.max(1, Math.floor(targetWidth * fitted));
    targetHeight = Math.max(1, Math.floor(targetHeight * fitted));
  }
  const scaled = sampleBox(crop.data, bounds.width, bounds.height, targetWidth, targetHeight);
  const canvas = new PNG({ width: CANVAS, height: CANVAS });
  const originX = Math.floor((CANVAS - targetWidth) / 2);
  const originY = Math.floor((CANVAS - targetHeight) / 2);
  for (let y = 0; y < targetHeight; y++) {
    scaled.copy(canvas.data, ((originY + y) * CANVAS + originX) * 4, y * targetWidth * 4, (y + 1) * targetWidth * 4);
  }
  return {
    bytes: PNG.sync.write(canvas, { deflateLevel: 9 }),
    bounds,
    contentWidth: targetWidth,
    contentHeight: targetHeight,
  };
}

export async function loadPokemonIds() {
  const response = await fetch(
    "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon.csv",
    { signal: AbortSignal.timeout(30000) },
  );
  if (!response.ok) throw new Error(`pokemon.csv HTTP ${response.status}`);
  const text = await response.text();
  const ids = new Map();
  for (const line of text.trim().split(/\n/).slice(1)) {
    const [id, identifier] = line.split(",");
    if (identifier) ids.set(identifier, Number(id));
  }
  return ids;
}

export function resolveHomeIds(pokemon, ids) {
  const resolved = [];
  const missing = [];
  const seen = new Map();
  for (const entry of pokemon) {
    const identifier = homeIdentifier(entry.sprite);
    const pokeapiId = ids.get(identifier);
    if (!pokeapiId) {
      missing.push(`${entry.id} (${identifier})`);
      continue;
    }
    if (seen.has(pokeapiId)) missing.push(`${entry.id} duplicates ${seen.get(pokeapiId)} as ${pokeapiId}`);
    seen.set(pokeapiId, entry.id);
    resolved.push({ ...entry, identifier, pokeapiId });
  }
  if (missing.length) throw new Error(`Unmapped HOME forms:\n${missing.join("\n")}`);
  return resolved;
}

export async function homeCommit() {
  const response = await fetch("https://api.github.com/repos/PokeAPI/sprites/commits/master", {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "pmc-home-sprites" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`sprites commit HTTP ${response.status}`);
  const body = await response.json();
  if (!/^[0-9a-f]{40}$/.test(body.sha || "")) throw new Error("sprites commit SHA missing");
  return body.sha;
}

export function homeUrl(commit, pokeapiId) {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/${commit}/${HOME_PATH}/${pokeapiId}.png`;
}

export function homePage(commit, pokeapiId) {
  return `https://github.com/PokeAPI/sprites/blob/${commit}/${HOME_PATH}/${pokeapiId}.png`;
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function spriteCreditRow(entry) {
  return `| \`public/sprites/${entry.id}.png\` | The Pokémon Company | Copyright The Pokémon Company; PokeAPI/sprites redistribution. Repository CC0 does not license the image. | [source](${entry.page}) | ${entry.modification || MODIFICATION} |`;
}
