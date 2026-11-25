// Item icons for the 37 selectable Poké Ball themes.
// Image contents are copyright The Pokémon Company. The PokeAPI/sprites
// repository CC0 statement does not license those images.

import { PNG } from "pngjs";
import { opaqueBounds, readJson, sha256 } from "./home-sprites.mjs";

export const BALL_CANVAS = 144;
export const BALL_SCALE = 6;
export const BALL_COMMIT = "c0542f7c51215d9672439012838c99f520596cbd";
export const BALL_REPOSITORY = "PokeAPI/sprites";
export const BALL_PATH = "sprites/items";
export const BALL_MODIFICATION =
  "Transparent bounds trimmed, then enlarged 6× with nearest-neighbor sampling and centered on a 144×144 canvas. No recoloring.";

export function ballUrl(name) {
  return `https://raw.githubusercontent.com/${BALL_REPOSITORY}/${BALL_COMMIT}/${BALL_PATH}/${name}.png`;
}

export function ballPage(name) {
  return `https://github.com/${BALL_REPOSITORY}/blob/${BALL_COMMIT}/${BALL_PATH}/${name}.png`;
}

function enlarge(source, width, height, scale) {
  const out = Buffer.alloc(width * scale * height * scale * 4);
  const destinationWidth = width * scale;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixel = source.subarray((y * width + x) * 4, (y * width + x) * 4 + 4);
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const ox = x * scale + dx;
          const oy = y * scale + dy;
          pixel.copy(out, (oy * destinationWidth + ox) * 4);
        }
      }
    }
  }
  return out;
}

export function fitBallSprite(sourceBytes) {
  const source = PNG.sync.read(sourceBytes);
  const bounds = opaqueBounds(source);
  const crop = new PNG({ width: bounds.width, height: bounds.height });
  PNG.bitblt(source, crop, bounds.left, bounds.top, bounds.width, bounds.height, 0, 0);
  const targetWidth = bounds.width * BALL_SCALE;
  const targetHeight = bounds.height * BALL_SCALE;
  if (targetWidth > BALL_CANVAS || targetHeight > BALL_CANVAS) {
    throw new Error(`ball content ${targetWidth}×${targetHeight} exceeds ${BALL_CANVAS}`);
  }
  const scaled = enlarge(crop.data, bounds.width, bounds.height, BALL_SCALE);
  const canvas = new PNG({ width: BALL_CANVAS, height: BALL_CANVAS });
  const originX = Math.floor((BALL_CANVAS - targetWidth) / 2);
  const originY = Math.floor((BALL_CANVAS - targetHeight) / 2);
  for (let y = 0; y < targetHeight; y++) {
    scaled.copy(
      canvas.data,
      ((originY + y) * BALL_CANVAS + originX) * 4,
      y * targetWidth * 4,
      (y + 1) * targetWidth * 4,
    );
  }
  return {
    bytes: PNG.sync.write(canvas, { deflateLevel: 9 }),
    contentWidth: targetWidth,
    contentHeight: targetHeight,
  };
}

export function ballCreditRow(ball) {
  return `| \`public/share-balls/${ball.name}.png\` | The Pokémon Company | Copyright The Pokémon Company; PokeAPI/sprites redistribution. Repository CC0 does not license the image. | [source](${ballPage(ball.name)}) | ${BALL_MODIFICATION} |`;
}

export async function loadShareBalls() {
  const data = await readJson("src/data/share-balls.json");
  if (!Array.isArray(data.balls) || data.balls.length !== 37) {
    throw new Error("expected 37 selectable balls");
  }
  if (data.balls.some((ball) => ball.name === "strange-ball" || ball.name === "lastrange-ball")) {
    throw new Error("the removed Strange Ball must stay out of the selectable set");
  }
  return data;
}

export { sha256 };
