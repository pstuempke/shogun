# ROADMAP — NPC AI 2.0: A Living, Social Japan

Design + implementation plan for the next iteration. Written to be handed
to implementing agents **one work package (WP) at a time**. Read
`CLAUDE.md` (architecture rules) and `GAME_SPEC.md` (current behavior)
first. Everything below follows the existing rules: simulation stays
headless in `src/sim`/`src/core`, tunables go in `src/core/constants.ts`,
renderer reacts via `Bus` events, seeded RNG only.

## Design goals (from the product owner)

1. **No teleporting.** NPCs physically walk everywhere, on- and off-screen.
2. **Sims-like autonomy.** NPCs have needs, personalities, and daily
   business; they decide for themselves what to do next.
3. **NPCs interact with each other.** Chats, friendships, grudges,
   fights — and interventions (a samurai who sees a bandit attack a
   peasant may step in).
4. **Memory & news.** NPCs remember what they witnessed and gossip about
   it. The ticker stops reporting every movement; instead the player
   *asks* NPCs for news.
5. **Deeper player agency.** Order followers to attack or to go befriend
   another NPC on your behalf; followers fight at your side.
6. **Health recovery.** Rest spots, food, passive regen.

---

## Mechanics design

### M1 — Continuous movement & pathing

NPCs keep `zx,zy,lx,ly` but may only change position by walking.

- **District graph**: the 7×7 grid is a graph; edges connect adjacent
  districts through their **gate midpoints** (gates are already carved at
  the center of each shared edge, see `world.ts`). BFS gives the district
  route; waypoints are: exit gate center → entry gate center → …
  → final target tile.
- **TravelPlan** on the NPC:

  ```ts
  interface Waypoint { zx: number; zy: number; lx: number; ly: number }
  interface TravelPlan { waypoints: Waypoint[]; idx: number; purpose: BehaviorKind }
  ```

- **Off-screen advance**: each sim tick moves the NPC
  `NPC_TRAVEL_SPEED × SIM_TICK_SECONDS` world-units along the plan
  (crossing into the next district when passing a gate waypoint).
  **On-screen** (player's 3×3 neighborhood) the same plan is walked
  per-frame with the existing collision slide in `main.ts`.
- Within a district, straight-line movement with the existing axis-slide
  is acceptable; a fallback "nudge perpendicular after N blocked frames"
  prevents corner deadlocks. No full A* needed at tile level (districts
  are open terrain with wide gates).
- **Invariant (test this)**: an NPC's world position never changes by
  more than `speed × elapsed` in any single update.

### M2 — Needs, traits, and the utility brain

Every sim tick, an idle NPC (no active behavior or plan) **scores** all
candidate behaviors and picks the best (softmax-ish: pick among top 2
with seeded RNG so it isn't robotic).

- **Needs** (0..100, drift up per tick, satisfied by behaviors):
  `rest`, `social`, `purpose` (role duty), `safety` (spikes when
  threatened, decays).
- **Traits** per NPC (add to `ROSTER`, 0..1 each):
  `brave` (fight vs flee, intervention), `gregarious` (chat frequency),
  `greedy` (bribe threshold modifier, merchants trade better),
  `pious` (temple visits, likes monks).
- **Behaviors** (`BehaviorKind`):

  | Behavior | Who | What it does |
  |---|---|---|
  | `idle` | all | stand/amble briefly |
  | `work` | role-specific | peasant→paddy/village, merchant→village well ("market"), monk→temple, samurai/ronin→patrol route between 2 districts, daimyo/noble→hold court at a village, bandit→stalk a target district |
  | `socialize` | all | walk to nearest NPC with mutual affinity ≥ 0, chat 4–8 s |
  | `rest` | all | go to nearest hut/temple, restore own HP |
  | `flee` | all | run away from a threat toward a safe district |
  | `aggress` | bandits, rival faction (phase 2) | pick a victim by affinity/greed, walk to them, start a fight |
  | `intervene` | brave NPCs | join a nearby fight on the victim's side |
  | `rally` | rival-aligned | drift toward Lord Ishido's district |

- Scoring sketch: `score(behavior) = needRelief × traitWeight ×
  situational` — keep it a pure function
  `scoreBehaviors(npc, ctx): Scored[]` in a new `src/sim/brain.ts` so it
  is unit-testable. All weights are constants.

### M3 — Relationships & NPC↔NPC interaction

- **Affinity matrix** `Social.affinity: Map<int, number>` keyed
  `idA * 64 + idB` (-100..100), seeded from roles at spawn:
  bandits −60 to everyone; samurai −40 to bandits; monks +20 from
  everyone; same-role +15; plus seeded noise.
- **Chat**: two NPCs in `socialize` within `CHAT_RANGE` → chat for
  `CHAT_SECONDS`: affinity +`CHAT_AFFINITY_GAIN` both ways (halved if
  traits clash, e.g. pious × bandit), exchange 1–2 memories (M4), then
  cooldown so pairs don't loop. Renderer shows a small speech-bubble
  sprite over both (new Bus event `chatStart {aId,bId}` / `chatEnd`).
- **NPC fights are staged, not instant** (replaces
  `resolveOffscreenFight` one-shot):
  - A fight is an entity: `{attackerId, defenderId, sideA: int[],
    sideB: int[], zx, zy}` living in the sim; each tick both sides trade
    `strikeDamage`-based blows; ends on yield (`hp < 25 %` → loser flees,
    affinity −40) or death (rare — only when the loser cannot flee).
  - If the fight's district is on-screen, the renderer shows it live
    with the existing telegraph/strike visuals (NPCs target each other
    instead of the player — generalize the combat runtime in `main.ts`
    to "target: player | npcId").
  - **Intervention**: when a fight starts, every NPC within the district
    rolls `brave × affinity(victim) − affinity(aggressor)` against
    `INTERVENE_THRESHOLD`; passers walk over and join `sideB` (this is
    the "samurai saves the peasant from bandits" moment). Cowards with
    `safety` spiked choose `flee` instead. Witnesses record a memory.

### M4 — Memory & the news mechanic

- **Ticker diet**: delete the "X travels north…" lines from
  `simulation.ts`. The ticker keeps only: player-facing events
  (recruits, follower deaths, ransom), fight outcomes *in the player's
  district*, rival milestones (every 3rd Ishido recruit), quest events.
- **Memory**: ring buffer per NPC, max `MEMORY_CAPACITY = 8`:

  ```ts
  interface Memory {
    day: number;            // in-game day witnessed (see clock below)
    kind: "fight" | "death" | "recruit" | "sighting" | "treasure";
    subjectId: number;      // who did it
    objectId: number | -1;  // to whom
    zx: number; zy: number;
    secondhand: boolean;    // learned via gossip
  }
  ```

  Recorded when the event happens in the NPC's district. Gossip during
  chats copies the freshest non-duplicate memory with
  `secondhand = true`. Oldest evicted first; treasure memories are never
  evicted before others.
- **In-game clock**: `GAME_DAY_SECONDS = 120` real seconds = 1 day;
  expose `game.day`. HUD shows "Day N". Memories narrate relative time
  ("yesterday", "three days ago").
- **Ask about news** (new action `N` when near a friendly-ish NPC,
  disposition > −20): renders the NPC's 2–3 freshest memories as text
  lines: *"Two days ago I saw Bandit Gonji attack Merchant Goro in Biwa
  Lake."* — narration built by a pure `narrateMemory(m, npcs, world,
  today): string` in `src/sim/memory.ts`.
- **Phase-2 integration**: the timed rumor ticker is removed. Instead,
  when a sacred treasure spawns, 2–3 NPCs near its district get a
  `treasure` memory; gossip spreads it. Asking for news becomes the way
  to locate treasures (minimap markers appear only once the player has
  *heard* about that treasure — store `knownTreasures: Set<number>` on
  `Game`).

### M5 — Followers in combat & envoy orders

- **Assist**: followers with order `follow` auto-engage any NPC that is
  currently fighting the player (or that the player attacked): approach
  to flank, strike on the enemy cooldown system. Followers **retreat**
  (behavior `flee`, drop out of combat) below `FOLLOWER_RETREAT_HP =
  30 %` instead of fighting to the death; they return when healed.
- **Order → Attack…**: order menu gains "Attack <choose target in
  district>": target chooser lists NPCs in the current district; the
  follower engages that NPC via the fight system (M3). The player is
  responsible for the consequences (witness memories, affinity hits,
  pool-viability check unchanged).
- **Order → Befriend…**: send a follower as an **envoy** to a chosen
  NPC anywhere the player has *seen or heard of* them: follower walks
  there (M1), then rolls the existing `befriendChance` using the
  *envoy's* rank in place of player rank, +`ENVOY_MOMENTUM_SHARE` × the
  player's follower momentum. Success: target joins the player
  (ticker!). Failure: disposition penalty as usual and the envoy walks
  back. One envoy mission at a time per follower.

### M6 — Health recovery & trade

- **Passive regen**: `PLAYER_REGEN_HP_PER_S = 1.5` when out of combat
  ≥ `REGEN_COMBAT_DELAY = 6` s. NPCs already heal off-screen; make the
  same rate apply on-screen via `rest`.
- **Rest auras**: standing within 3 tiles of a temple pagoda or village
  well triples regen (renderer: faint ground glow decal).
- **Food items**: new `ItemKind "food"` (Rice Ball +25, Miso Soup +40,
  Herbal Remedy +70): consumed from inventory via action `U — Use`.
- **Trade**: near a merchant-role NPC, action `R — Trade` opens a
  chooser: buy 2–3 food/gift items (seeded per merchant, restocks
  daily) priced by `greedy` trait; sell carried gifts/weapons at 50 %.
  This finally gives gold a sink and the merchant role a purpose.

---

## Implementation plan — work packages

Do them **in order**; each WP is one agent-sized task, ends green
(`npm test`, `npm run typecheck`), updates `GAME_SPEC.md`'s relevant
section, and adds tests for every new sim/core function. Keep each WP a
single commit/PR.

### WP1 — Clock, district graph, walking travel ✅ DONE
- `src/core/constants.ts`: `GAME_DAY_SECONDS`, `NPC_TRAVEL_SPEED`,
  gate-waypoint constants.
- `src/sim/pathing.ts` (new): district BFS, `planRoute(world, from, to):
  Waypoint[]`, gate positions derived from `world.ts` carving.
- `src/sim/simulation.ts`: replace `wander()` teleport with
  plan-following advance; NPC picks a destination district and *walks*.
- `src/sim/game.ts`: `day` getter.
- `src/main.ts`: on-screen NPCs follow the same plan per-frame; HUD "Day N".
- Remove travel ticker lines (M4 ticker diet — do it here so the ticker
  isn't spammy while walking makes moves frequent).
- **Tests**: route validity (every consecutive waypoint pair is same or
  adjacent district), no-teleport invariant over 500 ticks, determinism
  per seed.

### WP2 — Relationships, memory, ask-about-news ✅ DONE
- `src/sim/social.ts`: affinity storage + seeding, `affinity(a,b)`,
  `shiftAffinity`.
- `src/sim/memory.ts` (new): ring buffer, `recordWitnessed(...)` hooks
  called from fight/recruit/death/treasure code paths, gossip transfer,
  `narrateMemory`.
- `Game`: `knownTreasures`, phase-2 rumor ticker removed, treasure
  memories seeded on `placeSacredItems()`; minimap markers gated on
  `knownTreasures`.
- `src/main.ts` + `hud.ts`: `N — Ask for news` action, multi-line toast.
- **Tests**: memory eviction & treasure retention, gossip dedup,
  narration strings, minimap gating logic (pure part).

### WP3 — Utility brain (needs, traits, behaviors) ✅ DONE
- `ROSTER`: add trait values per NPC (hand-tuned, they're characters).
- `src/sim/brain.ts` (new): needs drift, `scoreBehaviors`, behavior
  state machine (`npc.behavior: { kind, target?, until }`); `work`
  destinations resolved from world biomes; `socialize` + chat mechanics
  incl. gossip (uses WP2); `rest` heals.
- `simulation.ts` orchestrates the brain off-screen; `main.ts` runs the
  same decisions on-screen (visible walking, chat-bubble Bus events).
- `src/render`: speech-bubble sprite; nothing else.
- **Tests**: need satisfaction loops, role→work destination mapping,
  chat affinity gain + cooldown, deterministic behavior sequence per seed.

### WP4 — Staged NPC fights & intervention ✅ DONE
- `src/sim/fights.ts` (new): fight entity list on `Game`, per-tick
  exchange, yield/flee/death resolution, intervention rolls, witness
  memories; delete `resolveOffscreenFight` one-shot path.
- `main.ts`: generalize combat runtime so an NPC's attack target can be
  the player *or* another NPC; render live fights in the player's
  district.
- Bandit `aggress` + brave `intervene` behaviors wired (uses WP3).
- **Tests**: fight lifecycle, intervention threshold math, no
  simultaneous duplicate fights per NPC, pool-viability still enforced.

### WP5 — Follower combat assist & envoy orders ✅ DONE
- `main.ts`: followers auto-join fights involving the player (side
  logic via WP4 fight entities), retreat at `FOLLOWER_RETREAT_HP`.
- Order menu: "Attack…" (district target chooser), "Befriend… (envoy)"
  — envoy mission state on the follower (`travel → attempt → return`),
  using WP1 pathing + existing `befriendChance` with envoy rank.
- **Tests**: envoy mission state machine (pure sim), assist targeting,
  retreat trigger.

### WP6 — Recovery & trade ✅ DONE
- Constants + `ItemKind "food"`, `U — Use` action, passive regen with
  combat delay, rest auras (temple/well proximity check in sim,
  glow decal in render), merchant `R — Trade` chooser with daily
  restock + greedy pricing.
- **Tests**: regen gating, food consumption, trade pricing/restock.

### WP7 — Polish pass *(optional, after playtest)*
- Ticker copy pass; chat-bubble variety; day/night ambient light tint
  keyed to `game.day` fraction; sound hooks (still no binary assets —
  WebAudio synth only if attempted).

## Ground rules for implementing agents

- `GAME_SPEC.md` is updated in the same commit as the behavior it
  documents; ambiguities become `SPEC_QUESTION:` entries there.
- No DOM/three.js in `src/sim`/`src/core`. New cross-layer signals are
  Bus events, declared in `src/core/bus.ts`.
- Every number is a named constant. Seeded RNG only in sim.
- Playwright smoke-verify visually before finishing a WP that touches
  `main.ts` or `src/render` (see `npm run build` + preview; a debug
  handle `window.__game` exists for test teleports/state setup).
