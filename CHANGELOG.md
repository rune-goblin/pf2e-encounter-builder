# Changelog

Notable changes to **PF2E Encounter Builder**. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Releases before 0.1.4 predate this
file; see the GitHub releases for their notes.

## [0.2.1] — 2026-07-25

### Fixed

- `package.json` (and the lockfile's root entry) now carry the released version instead of
  sitting at `0.1.0` — the release workflow stamped only `module.json`, so the two drifted apart
  across every release since 0.1.0. The workflow now stamps all three from the tag and warns when
  the committed version doesn't match. No changes to the module itself.

## [0.2.0] — 2026-07-25

### Added

- **Skirmish encounters.** Allied troops the PCs bring to a fight raise the XP budget the enemy
  side is measured against (Rules 3439), instead of being counted as opposition. Add a creature
  with the **Ally** button; the budget bar shows the reinforcement.
- **Troop support.** Creatures with the `troop` trait are grouped separately from ordinary
  creatures in the encounter list, and a **Troops only** filter narrows the browse table to them.
- Allies save into the combat as party-alliance actors and deploy as friendly (blue) tokens; the
  side round-trips through save → load → Add to Scene.
- A column chooser for the creature table — toggle the size, rarity, traits, and source columns.

### Fixed

- One broken, locked, or mis-indexed bestiary pack no longer blanks the entire creature list. The
  failure is reported, that pack is skipped, and the degraded read is not cached — so reopening
  the builder retries rather than leaving the GM on world creatures only until Foundry reloads.
- Loading an encounter after **Add to Scene** collapses duplicates of the same world actor into a
  single counted row; they previously split into one row per token.
- Budget-bar threshold marks track the actual tier values rather than fixed percentages, so they
  stay aligned under a skirmish budget offset.

## [0.1.4] — 2026-06-22

### Fixed

- Hardened the release pipeline: added `scripts/check-lockfile.ts` (run before `npm ci`) to
  guard the committed lock against npm pruning the `@emnapi/*` peer nodes — which the
  rolldown/oxc wasm bindings require and whose absence breaks `npm ci` on the linux runner — and
  standardized the toolchain on Node 24 (`.nvmrc`). No changes to the encounter builder itself.
