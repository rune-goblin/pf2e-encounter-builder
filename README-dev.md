# Developing PF2E Encounter Builder

Contributor notes for the module. For what it does and how to install it, see the
[README](README.md).

## Setup

Set up once — needs Node ≥ 22.12 and a local Foundry install. The
[`fvtt`](https://github.com/foundryvtt/foundryvtt-cli) CLI (used to build the packs) ships as a
dev dependency, so `npm install` brings it:

```bash
npm install
npm run setup      # scaffold this module into your Foundry data dir (symlinked back to the repo)
npm run build      # build dist/ and packs/, then enable the module in a world
```

Day to day:

```bash
npm run dev        # HMR dev server (Vite reverse-proxies a running Foundry on :30001)
npm run watch      # vite build --watch (rebuild dist/ on save, no HMR)
npm run check      # svelte-check + tsc --noEmit
npm test           # vitest unit specs (zero-setup; the CI tier)
npm run test:e2e   # Playwright vs. a real headless Foundry (opt-in — see src/tests/e2e/README.md)
npm run deploy     # build + copy a clean, self-contained module into Foundry
```

**HMR** runs Vite on `:30001` as a reverse proxy in front of a running Foundry — the esmodule
only loads inside an active world, so launch a world with the module enabled first, then browse
**http://localhost:30001/game** (not `:30000`). Editing a `.svelte` component hot-swaps in
place; editing `src/index.ts` triggers a full reload. Vite does *not* type-check — run
`npm run check`.

## Layout

```
module.json              manifest (esmodules, styles, packs, pf2e relationship)
src/
  index.ts               renders the sidebar buttons, registers settings, exposes module.api
  constants.ts           MODULE_ID (used to build modules/<id>/… asset paths)
  data/creatures.ts      loads + indexes creatures from the installed PF2e compendia
  encounter/math.ts      pure budget/XP math + Creature/EncounterEntry types (unit-tested)
  encounter/save.ts      save the encounter as a Combat; add-to-scene; load-from-combat
  ui/EncounterBuilderApp.ts        ApplicationV2 shell that mounts the Svelte UI
  ui/components/*.svelte           the builder UI (Svelte 5, runes)
  styles.css             global styles → dist/pf2e-encounter-builder.css
assets/                  module art — served at modules/<id>/assets/…
lang/en.json             localization (all UI strings live here)
packs/_source/macros/    JSON source for the "open builder" macro (built to LevelDB by build)
dist/                    build output (gitignored) — what module.json loads
```

The UI is a Svelte 5 app mounted in an ApplicationV2 shell (`mount`/`unmount`, runes), targeting
Foundry v14 APIs only — ApplicationV2, DialogV2, and DataModel, never the v1 namespace.

## Release

Push a tag `vX.Y.Z`; `release.yml` stamps the version, type-checks, builds, and publishes a
GitHub release with `module.json` + `pf2e-encounter-builder.zip` (the zip ships `dist`, `lang`,
`packs`, and `assets`).
</content>
