# Shogun — Agent Workflow

## Overview

3D isometric remake of the 1986 Gang of Five *Shōgun*, built with
**TypeScript + Three.js + Vite**. `GAME_SPEC.md` is the authoritative
source of truth for all game behavior — implement from the spec, don't
invent behavior. If a spec section is ambiguous, add a `SPEC_QUESTION:`
entry at the bottom of `GAME_SPEC.md` and implement the most conservative
interpretation. Planned-but-unbuilt work lives in `ROADMAP.md` as ordered
work packages (WP1–WP7); pick up the lowest unfinished WP, and update
`GAME_SPEC.md` in the same commit as the behavior you implement.

## Commands

```bash
npm install        # once
npm run dev        # dev server (Vite, hot reload)
npm run build      # production build to dist/
npm run preview    # serve the production build
npm test           # vitest — 36 sim/core unit tests
npm run typecheck  # tsc --noEmit (strict)
```

Run `npm test` and `npm run typecheck` before considering any change done.

## Architecture rules

- **`src/core/**` and `src/sim/**` must stay headless**: no DOM, no
  three.js imports. All game logic (social checks, combat math, quest
  state, world gen, living-world sim) lives here and is unit-tested in
  node. If you need the renderer to react, emit an event on `Bus`
  (`src/core/bus.ts`) instead of importing UI code.
- **All tunable numbers live in `src/core/constants.ts`.** No magic
  numbers in system or render files.
- `src/render/**` builds every mesh procedurally — no binary assets, no
  asset downloads. Shared materials come from `mat()` in
  `src/render/props.ts`; clone before mutating per-instance state.
- `src/main.ts` is the only place that wires sim ↔ render ↔ ui together.
- Seeded RNG only (`src/core/rng.ts`) inside sim/world code — never
  `Math.random()` there, so campaigns stay reproducible per seed.

## Layout

```
src/
  core/        constants, types (pure data model), rng, event bus
  sim/         classes, roster, world gen, social, combat, quest,
               simulation (living-world ticker), game (orchestrator)
  render/      scene (iso camera), palette, props, zoneView, characters,
               itemViews — all procedural
  ui/          hud (DOM), screens (title/pause/end/choosers)
  main.ts      game loop, input, per-frame NPC behavior, wiring
tests/         vitest suites for core + sim only
```

## Code style

- TypeScript strict; explicit return types on exported functions.
- Comments only for non-obvious WHY, never WHAT.
- Tests accompany any new sim/core behavior.
