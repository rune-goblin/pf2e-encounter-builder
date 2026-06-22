# Changelog

Notable changes to **PF2E Encounter Builder**. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Releases before 0.1.4 predate this
file; see the GitHub releases for their notes.

## [0.1.4] — 2026-06-22

### Fixed

- Hardened the release pipeline: added `scripts/check-lockfile.ts` (run before `npm ci`) to
  guard the committed lock against npm pruning the `@emnapi/*` peer nodes — which the
  rolldown/oxc wasm bindings require and whose absence breaks `npm ci` on the linux runner — and
  standardized the toolchain on Node 24 (`.nvmrc`). No changes to the encounter builder itself.
