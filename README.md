# ⛩ SHOGUN

A modern **3D isometric remake** of the 1986 Gang of Five *Shōgun* —
rebuilt from scratch in TypeScript + Three.js, with a fully procedural
low-poly art style (no external assets).

> Japan, 1600. Rise from your station, gather twenty followers, and the
> Emperor will set you the quest that makes you Shogun.

## Play

```bash
npm install
npm run dev     # open the printed localhost URL
```

**Controls**

| Input | Action |
|---|---|
| WASD / Arrows | Move |
| Space / Q | Attack |
| Shift | Dodge roll (i-frames) |
| E / F / B / G / T / O / X | Context actions (examine, befriend, bribe, give, take, order, drop) |
| Enter | Seek audience with the Emperor |
| Mouse wheel | Zoom |
| Esc | Pause |

## The game

- **A living world**: 30 named NPCs roam a 7×7-district Japan on their own —
  travelling, brawling, and being recruited by your rival **Lord Ishido** —
  with every event reported in the news ticker.
- **The hierarchy is the difficulty slider**: start as Peasant, Merchant,
  Ronin, Samurai, or Noble. Low birth means brutal persuasion odds and a
  ×5 score multiplier if you win anyway.
- **Diplomacy first**: examine, befriend, bribe, and gift your way to
  exactly **20 followers**, then seek the Emperor.
- **Phase two**: recover the four Imperial Treasures scattered across
  Japan and bring them back — all at once — while Ishido's faction hunts you.
- **Combat, fixed**: crisp real-time duels with telegraphed strikes,
  dodge-rolls, and a yield mechanic. Death ransoms you back at the temple —
  or enable **Way of Honour** for authentic 1986 permadeath.

## Development

```bash
npm test            # 36 unit tests (pure simulation core)
npm run typecheck   # strict TypeScript
npm run build       # production bundle
```

Design doc: [`GAME_SPEC.md`](GAME_SPEC.md) · Agent workflow: [`CLAUDE.md`](CLAUDE.md)
