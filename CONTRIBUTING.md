# Contributing to PMC

Start with an [issue](https://github.com/SWAG-Dragon86/pmc/issues) for a bug or substantial feature. Small, focused pull requests are easier to review. Do not redesign the interface, remove options, replace artwork, change stored-data formats or alter sharing protocols as part of an unrelated fix.

## Setup and checks

Use Node.js 24 and pnpm 11.25.0:

```sh
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm dev
```

The pull-request workflow runs the test suite and web build. Browser helper scripts under `scripts/` include historical machine-specific paths; they are not portable CI acceptance tests. Use a separate browser profile/context for manual checks and never clear a user's real records to test a change.

For Android resource verification on Windows, install the tools with `./scripts/setup-android.ps1`, then run `node scripts/build-android.mjs --unsigned` and `python scripts/verify-android.py output/android-unsigned/build-info.json`. Do not sign, publish or upload APKs as part of a routine pull request. Do not introduce a replacement signing key for an existing app.

## Damage-mechanic changes

Include a minimal scene with game/data version, species and form, moves, ability, item, nature, all six Stat Points, stages, current HP and field conditions. State expected and actual results. Add a regression that fails before the fix and passes after it, including a relevant negative case.

Prefer current Pokémon Champions official material or reproducible in-game evidence. Identify the exact game version and source revision for a community engine rule. A rule from another generation is not proof of Champions behavior. Label community-model tests, independent arithmetic and physical-game observations separately. Do not describe entry scans or a matching formula as in-game validation. If a rule remains uncertain, retain a warning rather than inventing an exact result.

Run focused tests while editing, then `pnpm test` and `pnpm build` before submitting. Check a narrow desktop/mobile flow if UI or browser behavior changes. Test JSON backup compatibility and cross-language sharing if those paths change. Keep the pinned vendor source and its generated output consistent when changing data extraction.

## Licensing and private data

PMC's original code is GPL-3.0-or-later. Contribute only material you have the right to distribute under the applicable license; preserve third-party attribution and disclose new sources in `THIRD_PARTY_NOTICES.md`. Do not submit copyrighted game images as if PMC owned them. Existing image rights remain unresolved as explained in `docs/LICENSING.md`.

Never include API keys, tokens, passwords, signing keys, `.env` secrets, user backups, private screenshots, `node_modules/`, generated `dist/`, or `output/`. Supply a sanitized scene in an issue. The application does not need an OpenAI key to run. Future maintainer automation must keep any credentials in platform secrets, not browser code.

## Pull request description

Describe the user-visible bug or behavior, the narrow change, the rule/source evidence, tests actually run, and what remains unverified. Note any changes to storage, share codes, APK resources or public assets. Do not claim a release, deployment, phone test or authorization that did not happen.
