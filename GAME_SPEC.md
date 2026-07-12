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
- **NPCs walk, never teleport.** An idle NPC periodically plans a trip to
  a district within `WANDER_RADIUS` (never the palace): BFS over the
  district graph produces gate-to-gate waypoints, walked at
  `NPC_TRAVEL_SPEED`. Off-screen NPCs advance along the same waypoints
  each sim tick; visible NPCs walk them per-frame with collision. Plans
  time out after `PLAN_TIMEOUT_TICKS` if stuck.
- **In-game clock**: `GAME_DAY_SECONDS` real seconds = 1 day, shown in
  the HUD ("Day N").
- **Staged fights**: predators (bandits, hostile NPCs) with high purpose
  stalk (`aggress`) the nearest civilian and start a **fight entity**
  resolved over sim ticks — each round both sides trade softened blows
  (`FIGHT_DAMAGE_SCALE`) until one side yields (`YIELD_THRESHOLD`).
  Bandits/rivals sometimes finish a yielded victim (`FIGHT_DEATH_CHANCE`);
  stalemates disband after `FIGHT_MAX_TICKS`. Fights the player can see
  are rendered live (combatants square up, blows flash); fights involving
  a follower are always reported on the ticker.
- **Intervention**: when a fight starts, each bystander in the district
  scores `brave×50 + affinity(victim)/2 − affinity(aggressor)/2`; those
  above `INTERVENE_THRESHOLD` join the defenders — a samurai who sees a
  bandit attack a peasant steps in. The timid get spiked `safety` and
  flee instead.
- A global heartbeat (every `SIM_TICK_SECONDS`) also heals wounded
  off-screen NPCs. Routine travel is **not** reported on the ticker.
- **Lord Ishido** is the rival leader: every `RIVAL_RECRUIT_SECONDS` he
  recruits an unaffiliated NPC to his banner (cap: `RIVAL_MAX_FOLLOWERS`).
  Rival-aligned NPCs take a persuasion penalty to poach back.
- **Utility brain**: every non-follower NPC has four needs (rest, social,
  purpose, safety) that drift each tick, and personality traits (brave,
  gregarious, greedy, pious — role defaults in `ROLE_TRAITS`, tuned per
  character). Idle NPCs score candidate behaviors (`idle`, `work`, `rest`,
  `socialize`, `flee`) and act: peasants tend paddies, merchants hold
  market in villages, monks pray at the temple, nobles hold court, and
  samurai/ronin/bandits patrol. Wounded NPCs favor rest (extra healing);
  witnessed violence spikes `safety`, and the un-brave flee the district.
- **Chats**: a socializing NPC walks to a partner with affinity ≥
  `SOCIAL_MIN_AFFINITY`; within `CHAT_RANGE` both chat for `CHAT_TICKS`
  (visible speech bubble), gaining affinity and exchanging gossip, then
  cool down for `CHAT_COOLDOWN_TICKS`.
- **Relationships**: every NPC pair has a symmetric affinity (−100…100),
  seeded by role (bandits despised, monks liked, same-role kinship, plus
  seeded noise) and shifted by chats and events.
- **Memory**: each NPC keeps up to `MEMORY_CAPACITY` memories of events
  witnessed in their district (fights, deaths, recruitments, treasure
  sightings — treasure memories are never evicted first). NPCs sharing a
  district **gossip** each tick with `GOSSIP_CHANCE`, passing fresh news
  marked as secondhand.
- **The ticker is curated**: player-facing events (recruits, deaths,
  ransom), rival milestones (every `RIVAL_TICKER_MILESTONE`th Ishido
  recruit), and quest beats. Routine travel and off-screen scuffles are
  *not* reported — ask NPCs for news instead (`N`).

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
- **N — Ask for news**: the NPC narrates their freshest memories
  ("I saw…", "I heard that…", with relative days). Refused below
  `NEWS_MIN_DISPOSITION`. Hearing a treasure memory marks that treasure
  on the minimap.
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
- **Followers fight beside you**: retainers with order `follow` engage
  any enemy pressing the player (within `FOLLOWER_ASSIST_RANGE`),
  striking on their own cooldown, and retreat below
  `FOLLOWER_RETREAT_HP`. Enemy strikes land on whoever is closest —
  the player or a follower.
- **Order → Attack**: sic a follower on any NPC in the district; this
  opens a staged fight (bystanders may defend the victim) and costs
  `ORDER_ATTACK_DISPOSITION_HIT` disposition with the target.
- **Order → Envoy**: dispatch a follower to walk to any NPC in Japan and
  attempt persuasion using the *envoy's* rank and a
  `ENVOY_PERSUASION_SHARE` share of your persuasion (plus your follower
  momentum). Success sends the recruit walking to you; either way the
  envoy walks home. One errand per follower at a time.
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
  dropping or selling it recomputes the bonus.
- **Food** (Rice Ball…Herbal Remedy, +25…+75 HP): eaten from the satchel
  via `U — Eat`; found in the world or bought from merchants.
- **Sacred treasures** (4, phase 2 only): quest items; cannot be given
  away or sold.
- **Trade** (`R` near a merchant): each merchant offers
  `TRADE_STOCK_SIZE` wares per day (seeded by merchant + day, priced by
  their `greedy` trait; stock depletes when bought, restocks daily), and
  buys the player's goods at `TRADE_SELL_FRACTION` of value.

### Health recovery

- **Passive regen**: `PLAYER_REGEN_HP_PER_S` once the player has been out
  of combat for `REGEN_COMBAT_DELAY` seconds.
- **Rest auras**: standing within `REST_AURA_RANGE` of a temple pagoda or
  village well multiplies regen by `REST_AURA_MULT`.
- **Food**: instant healing from the satchel.

## 8. Two-Phase Win Condition

1. **The Gathering** — recruit exactly `FOLLOWERS_TO_WIN = 20` followers
   (befriend or bribe), then seek the Emperor at the Imperial Palace.
   Without 20 followers the guards turn you away.
2. **The Shogun's Quest** — the Emperor scatters the four Imperial
   Treasures (Kusanagi sword, Yata mirror, Yasakani jewel, war fan) into
   four distinct districts ≥ 4 Manhattan-steps from the palace. The
   `TREASURE_WITNESSES` NPCs nearest each treasure witness its arrival;
   the news spreads by gossip, and the player finds treasures by asking
   NPCs for news — a treasure appears on the minimap only once heard
   about. All four must be carried **simultaneously** back to the
   Emperor. During phase 2, Ishido's faction turns openly hostile.

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
| Walking NPC travel + in-game clock (WP1) | [x] |
| Relationships, memory, gossip, ask-for-news (WP2) | [x] |
| Utility brain: needs, traits, behaviors, chats (WP3) | [x] |
| Staged NPC fights & bystander intervention (WP4) | [x] |
| Follower combat assist & envoy orders (WP5) | [x] |
| Health recovery & merchant trade (WP6) | [x] |
| Unit tests (90) | [x] |

Planned next iteration (NPC AI 2.0 — walking travel, utility-AI
behaviors, NPC↔NPC social life, memory/news, follower combat, recovery
& trade) is specified in `ROADMAP.md`.

`SPEC_QUESTION:` entries go below this line when a section is ambiguous.
