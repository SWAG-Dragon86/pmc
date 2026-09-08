import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require("sharp");
} catch {
  sharp = require("C:/Users/30912/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");
}
// Resize the supplied artwork only; keep the original logo file unchanged.
for (const size of [32, 180, 192, 512]) {
  await sharp("public/rotom-logo.webp")
    .resize(size, size, { fit: "contain" })
    .flatten({ background: "#f5f3ef" })
    .png()
    .toFile(`public/rotom-icon-${size}.png`);
}
// The full illustration fits inside the maskable icon's central safe circle.
const inset = await sharp("public/rotom-logo.webp")
  .resize(288, 288, { fit: "contain" })
  .png()
  .toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#f5f3ef" },
})
  .composite([{ input: inset, gravity: "centre" }])
  .png()
  .toFile("public/rotom-maskable-512.png");
console.log(
  "Rotom favicon, Apple touch icon and PWA icons generated from the supplied artwork.",
);
