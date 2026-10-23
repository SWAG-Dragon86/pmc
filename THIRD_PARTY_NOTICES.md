# Third-party notices

PMC is an unofficial Pokémon Champions fan project. Pokémon names, characters and related marks belong to their respective owners. The project has no official endorsement.

The maintainer licenses PMC's original program code under **GPL-3.0-or-later**. This does not replace any license below or grant rights to game images. See [LICENSE](LICENSE) and [licensing scope / unresolved assets](docs/LICENSING.md).

## Pinned source incorporated into the build

| Component | Pinned revision | License and location |
| --- | --- | --- |
| [Smogon damage-calc](https://github.com/smogon/damage-calc) | `111407c919c2c886688db704ae97376e768b72e4` | MIT; `vendor/calc/LICENSE`, `public/licenses/smogon-calc.txt` |
| [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) | `81c39fb3facd0c82bc6753295b2b079190fa3e6f` | MIT; `vendor/showdown/LICENSE`, `public/licenses/pokemon-showdown.txt` |
| [VGC Damage Calculator Chinese](https://github.com/professorsidon/VGC-Damage-Calculator-Chinese) translation directory | `fcc5c72ccebd44fdb826509f0379760a7ccbe899` | GPL version 3; `vendor/chinese/script_res/translate/LICENSE`, `public/licenses/chinese-translations.txt` |

`src/data/sources.json` records these revisions. `scripts/prepare-data.mjs` generates `src/vendor/calc.mjs` from the retained engine source and `src/data/catalog.json` from the retained data and Chinese dictionaries. Keep the upstream copyright notices in the vendor files. PMC does not relicense those MIT components as its own work, nor claim that dictionary extraction removes GPL obligations.

## Package dependencies

The dependency lockfile and [package license inventory](docs/dependency-licenses.csv) record 152 resolved package versions, including platform-specific build packages. A package metadata declaration is evidence of the publisher's stated license, not independent proof of every bundled asset's rights. Original package license/copyright files accompany installed packages and remain authoritative. A snapshot of 65 installed dependency license/notice texts ships in public/licenses/npm-third-party.txt; update this snapshot with dependency changes.

| Direct component | Purpose | Publisher's declared license |
| --- | --- | --- |
| `@smogon/calc` | Dependency; runtime engine comes from the pinned vendor build above | MIT |
| React / React DOM | Interface | MIT |
| lucide-react | UI icons | ISC |
| pinyin-pro | Chinese search aliases | MIT |
| opencc-js | Traditional Chinese conversion | MIT AND Apache-2.0 |
| qrcode | QR generation | MIT (`public/licenses/qrcode.txt`) |
| jsqr | QR reading | Apache-2.0 (`public/licenses/jsqr.txt`) |
| fflate 0.8.3 | Share-code compression | MIT (`public/licenses/fflate.txt`) |
| tesseract.js / tesseract.js-core | Local OCR worker and WASM | Apache-2.0; core text copied to `public/ocr/LICENSE-core.txt` at build |
| `@tesseract.js-data/{chi_sim,chi_tra,eng,jpn,kor}` 1.0.0 | Local OCR models | npm packages declare MIT; underlying training-data provenance is not independently cleared by that metadata |
| Vite 7.3.7, esbuild, pngjs, Prettier | Build and development | MIT |
| source-map-js 1.2.2 | Transitive build dependency | BSD-3-Clause |

The app uses system fonts; it does not bundle Google Fonts or a separate commercial font. Build tools and optional OS packages have their own notices in the inventory. Installing dependencies does not transfer their copyrights to PMC.

## Data and images

The Champions pack identifies game **1.2.0**, regulation **M-C**, season **M-6**. See `src/data/mc-manifest.json`, the catalog metadata and [official regulation announcement](https://champions-news.pokemon-home.com/en/page/816.html). Serebii and GameWith material supports data maintenance; citing a page does not grant a new blanket reuse license.

**Artwork replacement (2026-10-23):** 350 Pokémon form image files now have contributor permission records: 277 use SpriteCollab artwork and 73 use The Artificial’s CC-BY author statement, all 18 type icons use James Watkins / partywhale’s MIT-licensed redrawings, 37 balls use Cobblemon Assets art under CC BY-NC 3.0, and the mascot/icon family uses Emmuffin’s SpriteCollab Rotom Dex portrait. Historical SpriteCollab attribution / not-for-profit permissions and CC BY-NC 4.0 are recorded per selected frame. SpriteCollab supplies 198 full-body frames and 79 portraits; The Artificial supplies 73 vector-style icons. Paths and layout are retained. See [artwork credits](docs/ASSET_CREDITS.md) and [remaining gaps](docs/ASSET_RIGHTS_REMAINING.md). **The maintainer removed the unverified Strange Ball; 37 ball themes remain. The eight repository screenshots have been recaptured with component credits. The default background is maintainer-confirmed original, retained unchanged; no standalone reuse license has been selected. Contributor permissions are not complete official IP clearance.**

Before this replacement, form images came from Showdown with GameWith/Serebii overrides; all type/ball icons came from PokeAPI/sprites at `0dc105d5b12416932f29b594078282ab4be045f5`. Retained original sources remain documented in `src/data/sprites.json` and the remaining-gaps list. The old PokeAPI notice does not grant the underlying Pokémon owners’ rights.

`scripts/build-locale-names.mjs` uses PokeAPI CSV name data (BSD-3-Clause), alongside existing translations. Preserve the upstream notices; do not apply the sprite repository's CC0 declaration to unrelated CSV data. `docs/多语言资源说明.md` records the name-source workflow.

The original mascot and all its packaged icon variants have been replaced. The default background is maintainer-confirmed original and retained unchanged; a standalone reuse license has not been selected. The eight repository screenshots have been recaptured with current artwork and embedded component credits; the old artwork paths were removed from the rewritten branch history. Platform caches and external clones remain outside that guarantee. Artwork is separate from PMC’s original-code GPL grant.

## Final-preparation clarification (2026-10-23)

PMC's maintainer describes the product as free and noncommercial. This does not add a license to the bundled game art. See [the updated licensing analysis](docs/LICENSING.md) and actual per-file credits. SpriteCollab contributor images have now been incorporated locally; official CHUNSOFT frames and Altcolor/shiny recolors were excluded.

Independent artwork can retain a different license from the GPL program where applicable. In particular, a CC BY-NC candidate must retain its own attribution/noncommercial terms; do not impose those terms on GPL code or describe the whole repository as GPL-licensed artwork. The rights of underlying character owners remain separate.
