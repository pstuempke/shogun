# SHOGUN — Game Specification

**Authoritative design document.** A modern 3D isometric remake of the 1986
Gang of Five *Shōgun*, rebuilt from scratch in TypeScript + Three.js. Code
must not contradict this document; every tunable number lives in
`src/core/constants.ts`.

---

## 1. Vision

The original was a grand-strategy "living world" squeezed onto 8-bit
hardware: ~30 autonomous NPCs roaming a screen-flip map, a persuasion
system driven by the feudal hierarchy, and a two-phase win condition.
This remake keeps every core loop of the original and deliberately fixes
its four notorious flaws:

| 1986 original | This remake |
|---|---|
| Static screen flips, pixel-perfect exits | Seamless 3D isometric camera, wide walkable gates between districts |
| Sluggish, unresponsive combat | Crisp real-time duels: cooldown attacks, dodge-roll i-frames, telegraphed enemy strikes, yield mechanic |
| Instant permadeath | Ransom respawn by default; optional **Way of Honour** mode restores 1986 permadeath |
| Invisible state (hidden HP, hidden gold) | Full HUD: HP bar, treasury, follower count, objective, minimap, inventory |

## 2. World & Navigation

- The map is a **7×7 grid of districts** (49 districts), each 22×22 tiles
  (2 world-units per tile). Seeded procedural generation; a fresh seed per
  campaign, deterministic given the seed.
- Fixed landmarks: **Imperial Palace** at grid (3,0), **Temple** (respawn
  point) at (1,5). Other districts draw biomes from a shuffled pool:
  villages, forests, sakura groves, lakes, mountains, rice paddies, plains.
- Districts are named ("Kiso Forest", "Biwa Lake"…) and the name is shown
  on entry. The perspective is a true orthographic isometric camera that
  smoothly follows the player.
- Impassable: water, rocks, trees, buildings, the outer world border.
  Between adjacent districts a **7-tile-wide gate** is always carved open.
- Terrain edge heights blend to a shared constant so districts join
  seamlessly.

## 3. The Living World (Ticker System)

- **30 named NPCs** (from the novel + archetypes) spawn scattered across
  the map. Each has role, rank (0–5), HP, attack, and a disposition toward
  the player (−100…100).
- A global heartbeat (every `SIM_TICK_SECONDS`) drives off-screen NPCs:
  they wander between districts, slowly heal, and brawl (hostile/rival
  NPCs attack civilians; losers are wounded or occasionally die).
- **Lord Ishido** is the rival leader: every `RIVAL_RECRUIT_SECONDS` he
  recruits an unaffiliated NPC to his banner (cap: `RIVAL_MAX_FOLLOWERS`).
  Rival-aligned NPCs take a persuasion penalty to poach back.
- Every noteworthy state change is pushed to the **ticker feed** (bottom
  left): high-rank travel, attacks, deaths, recruitments, rumors.

## 4. Player Classes (Difficulty Slider)

Chosen at the title screen. Class sets rank, base persuasion, starting
gold, attack, HP, and the **final-score multiplier** — low station means
a harder game and a bigger multiplier:

| Class | Rank | Persuasion | Gold | Attack | HP | Score × |
|---|---|---|---|---|---|---|
| Peasant | 0 | 18 | 30 | 9 | 90 | 5 |
| Merchant | 1 | 26 | 260 | 10 | 95 | 3.5 |
| Ronin | 2 | 32 | 90 | 16 | 115 | 2.5 |
| Samurai | 3 | 42 | 130 | 15 | 110 | 1.5 |
| Noble | 4 | 55 | 200 | 12 | 100 | 1 |

## 5. Action System

Context-sensitive action bar (replaces the original 9-icon bar). Actions
appear when adjacent to an NPC / item / the Emperor, hotkeys always work:

- **E — Examine**: identity, allegiance, live persuasion odds.
- **F — Befriend**: persuasion roll. Chance = base persuasion
  + followers × momentum + disposition bonus − rank-gap penalty
  (− rival penalty), clamped to 2–95 %. Failure lowers disposition.
- **B — Bribe**: pay `BRIBE_BASE_COST + rank × BRIBE_RANK_MULT` koban to
  bypass persuasion. Refused below the disposition floor (−40).
- **G — Give**: gift an inventory item; raises disposition by value/2.
- **Q / Space — Attack**: starts real-time combat.
- **O — Order** (followers): Follow / Wait / Stand guard.
- **T — Take**, **X — Drop**: inventory management.
- **Enter — Seek audience** (at the palace throne).

## 6. Combat

Real-time in the world (no separate arena):

- Player: attack on cooldown (`ATTACK_COOLDOWN`), range `ATTACK_RANGE`,
  damage = class attack + best-weapon bonus, ±20 % variance.
  **Dodge roll** (Shift): speed burst + invulnerability frames.
- Enemies: chase, then telegraph (`ENEMY_TELEGRAPH` red flash) before a
  strike lands — dodgeable.
- NPCs below 25 % HP **yield**: they kneel, stop fighting, and can be
  befriended or executed. Attacking a neutral NPC turns them hostile and
  costs 30 disposition.
- Player at 0 HP: **normal mode** — monks ransom you back at the Temple
  (lose half your gold, half your followers desert). **Way of Honour** —
  game over.
- Off-screen NPC fights resolve statistically; a follower can die out
  there. If the pool of living recruitable NPCs drops below 20 during
  phase 1, the campaign is lost.

## 7. Economy & Items

- Currency: **koban**. Starting amount by class; pouches (15–60) are
  scattered in the world and auto-collected on Take.
- **Gifts** (8 kinds, value 18–40): raise disposition when given.
- **Weapons** (4 kinds, +3…+10): best carried weapon adds to attack;
  dropping it recomputes the bonus.
- **Sacred treasures** (4, phase 2 only): quest items; cannot be given away.

## 8. Two-Phase Win Condition

1. **The Gathering** — recruit exactly `FOLLOWERS_TO_WIN = 20` followers
   (befriend or bribe), then seek the Emperor at the Imperial Palace.
   Without 20 followers the guards turn you away.
2. **The Shogun's Quest** — the Emperor scatters the four Imperial
   Treasures (Kusanagi sword, Yata mirror, Yasakani jewel, war fan) into
   four distinct districts ≥ 4 Manhattan-steps from the palace. Rumor
   ticker lines and minimap markers hint at locations. All four must be
   carried **simultaneously** back to the Emperor.
   During phase 2, Ishido's faction turns openly hostile.

**Victory score** = (followers × 100 + gold + treasures × 250 + time
bonus) × class multiplier.

## 9. Technology

- **TypeScript (strict) + Three.js + Vite**; tests with **Vitest**.
- `src/sim/**` and `src/core/**` are **pure simulation** — no DOM or
  three.js imports; fully unit-testable in node.
- `src/render/**` builds all art procedurally (low-poly flat-shaded
  meshes: pagodas, torii, sakura, banners…) — zero external assets.
- Deterministic seeded RNG (`mulberry32`) for world gen and sim.

## 10. Status

| System | State |
|---|---|
| World generation (districts, biomes, gates) | [x] |
| Living-world simulation + ticker | [x] |
| Classes / social system (befriend, bribe, gifts) | [x] |
| Real-time combat + yield + ransom/honour death | [x] |
| Economy & items | [x] |
| Two-phase quest + scoring | [x] |
| Isometric renderer, procedural assets, HUD, minimap | [x] |
| Title / pause / end screens | [x] |
| Unit tests (36) | [x] |

Planned next iteration (NPC AI 2.0 — walking travel, utility-AI
behaviors, NPC↔NPC social life, memory/news, follower combat, recovery
& trade) is specified in `ROADMAP.md`.

`SPEC_QUESTION:` entries go below this line when a section is ambiguous.
