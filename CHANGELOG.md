# Changelog

Dates below follow the existing repository's commit dates (Asia/Seoul). They establish source history, not a claim that a package reached an app store or that a GitHub Release exists.

## 1.4.0 source maintenance · 2026-10-23

- Apply grounded Grassy Terrain priority to Grassy Glide in turn ordering and damage previews.
- Retain flinch metadata, skip a flinched actor's move, respect supported immunities and reject Fake Out for an explicitly recorded prior action. Existing entry-turn scenes keep their meaning.
- Share grounding checks across hazards, terrain effects and end-turn healing. Keep an intact Air Balloon airborne; pop it after damaging hits.
- Prepare all local OCR resources before Android builds and add isolated unsigned build verification.
- Patch Vite to 7.3.7, source-map-js to 1.2.2 and fflate to 0.8.3 without changing the sharing protocol.
- Add English/Chinese project documentation, GPL-3.0-or-later for maintainer-owned code, third-party notices, issue forms and a pull-request test/build workflow.
- Replace 350 Pokémon form images, 18 type icons, 37 Poké Ball images and the mascot/icon family with contributor-licensed artwork, retaining component credits and separate license terms. Keep the maintainer-created default background unchanged. Contributor permissions do not establish complete official character or trademark clearance; old artwork is removed from the rewritten branch history. Platform caches and external clones may remain.
- Include component artwork credits in exported PNG metadata and refresh the repository screenshots. Remove the unverified Strange Ball image and export theme at the maintainer's request; saved selections fall back to the default Poké Ball.

This maintenance update retains app version 1.4.0. It includes source/Pages changes and no new signed APK release. The existing 18 source commits retain their non-image trees with new commit IDs after artwork-history cleanup.

## 1.4.0 · 2026-10-14 source commits

- `a0de880`: sharing images and PMC QR configuration import; battle move cards; Poké Ball export themes.
- `3c7421c`: soften team-image type badges and group build details.
- `f07f60d`: hide generated player-name suffixes in shared images.
- `0d459d7`: first-camera-permission fix and Android release verification. Local Android package uses versionCode 8.

## 1.3.2 · 2026-10-04 source commits

- `4ca3b93`, `cba4fb7`: game screenshot layouts, compressed-image OCR and form/gender handling.
- `0c9e655`: retain version 1.3.2 for the web OCR fix.
- `b9a5b62`: prepare the signed Android 1.3.2 upgrade with versionCode 7.

The intermediate `cba4fb7` commit used a 1.3.3 label; the history does not establish a separate public 1.3.3 release.

## 1.3.1 · 2026-10-04 source commits

- `8316ebb`: screenshot import and search improvements.
- `72dc64e`, `d21c3ce`: Android OCR WASM policy and fallback handling.

## 1.3.0 · 2026-09-28 source commits

- `0c1720d`: team building and multilingual updates.
- `7dc2ef8`: mobile navigation reachability.
- `3b31bb5`: initial language selection based on the device.

## Earlier source history

- 2026-09-09, `d328570`: Champions 1.2.0 / regulation M-C data update. This is a game-data version, not proof of an app release called 1.2.0.
- 2026-09-08, `7a35670`, `54a00eb`, `48c9215`: initial import, existing-project Pages setup and verification retry.
