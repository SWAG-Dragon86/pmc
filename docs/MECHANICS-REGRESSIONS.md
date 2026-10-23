# Targeted mechanics regressions

These fixes use the retained **Champions** community implementation, not a blanket assumption that every rule matches Scarlet/Violet. The Showdown revision is `81c39fb3facd0c82bc6753295b2b079190fa3e6f`; damage-calc is `111407c919c2c886688db704ae97376e768b72e4`. The app's data pack targets Champions 1.2.0 / M-C. No new physical-game comparison was performed. Community-rule expectations below still need matching-version in-game evidence before being described as game-verified.

## Grassy Glide

`vendor/showdown/data/moves.ts` defines its priority callback: +1 only on Grassy Terrain when the user is grounded. The retained Champions move overrides do not replace it. Previously the catalog's static priority 0 reached turn ordering without this callback. The fix applies the condition to dynamic ordering, Analytic comparisons, priority-blocking abilities and the single-move preview.

The regression uses Rillaboom and Pikachu at 1% HP, Serious nature, zero Stat Points, no items. On manual Grassy Terrain, Rillaboom's Grassy Glide now moves before Thunderbolt and KOs Pikachu; previously Pikachu moved first. Without Grassy Terrain, or with Flying typing, Levitate/Eelevate or an intact Air Balloon, Grassy Glide gets no terrain priority. Gravity and Iron Ball restore grounding. Armor Tail blocks its gained priority. Psychic Terrain replaces Grassy Terrain, so it does not independently give this move priority.

## Fake Out and flinch

The pinned Showdown move has priority +3 and a guaranteed flinch secondary. Its Champions override disables selection after a prior action on the field. The old data generator omitted `secondary.volatileStatus`; the old turn scheduler never skipped a flinched actor.

The generator now preserves that metadata. Successful damaging hits can flinch a living target that has not acted. Inner Focus, Shield Dust, Sheer Force, protection, Ghost immunity and Psychic Terrain receive focused checks. Mold Breaker can bypass the relevant ability immunity, but not an item guard. Steadfast's speed raise occurs when the flinched actor loses its action.

**Covert Cloak is absent from the pinned Champions item pack.** The UI continues to reject it. A unit test checks the secondary-effect immunity boundary; it is not a claim that the current game permits that item or that a complete Covert Cloak scene was simulated.

The existing secondary-effect toggle remains conditional for moves such as Bite. With it off, a 30% flinch is not turned into a guaranteed event; with it on, the existing conditional assumption applies. This patch does not add a new exhaustive secondary-effect probability model.

All ordinary scenes already model entry effects and have no turns-on-field input. They therefore keep the first-turn assumption. For callers/imports explicitly supplying `activeMoveActions > 0`, the engine refuses Fake Out in full-turn simulation and returns zero direct damage in a standalone preview. No new saved-data schema or UI control is required, and old backups remain valid. This does not implement multi-turn tracking or switching.

## Grounding and Grassy Terrain recovery

The damage-calc grounding rule in `vendor/calc/calc/src/mechanics/util.ts` recognizes gravity or Iron Ball as grounding; otherwise Flying, Levitate/Eelevate and Air Balloon prevent it. The old end-turn code omitted the item conditions.

`src/grounding.mjs` now supplies the application-level grounding rule for entry hazards, terrain targeting and healing. It retains current battle typing and Mimicry. An intact Air Balloon prevents Grassy Terrain healing; damaging hits pop it, so a survivor can heal at turn end. Protect and zero-damage hits leave it intact. Iron Ball and gravity positive cases accompany the airborne negative cases.

The regression uses **Venusaur**, a real catalog entry: 155 max HP, 50% input means 77 current HP. With an intact Air Balloon and Protect on Grassy Terrain, it remains at 77/155 instead of incorrectly healing to 86/155. The earlier audit called this probe “Eevee,” but that requested species is absent from the current catalog and `createBuild` fell back to Venusaur. The old label was wrong; the grounding discrepancy and numeric reproduction remain valid. New fixtures assert that the requested species exists.

## Validation boundaries

`tests/oss-mechanics.test.mjs` contains 28 targeted tests. Some internal ability/type overrides isolate conditions without adding selectable game content. Tests establish this program's behavior against the documented model, not universal correctness or console/mobile game observations.

The original 126 tests remain in place. Two Android build-contract tests bring the current suite to 156. JSON schema 1, PMC1 sharing, catalog membership, existing languages, artwork and UI are preserved. Full switching/Parting Shot and exhaustive 509-move mechanics validation remain separate work; the existing unsupported-mechanism gate stays in place.
