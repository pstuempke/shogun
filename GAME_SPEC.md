# Shogun — Game Design Specification

> **Agents: read the relevant section(s) below before implementing any system.
> Check Section 14 (Status Tracker) first — never work on a system marked "in progress".**

---

## 1. Overview & Win Condition

The player controls a ronin in feudal Japan (1560s). The goal is to become Shogun by amassing **20 followers** while holding all three **sacred items** (Mirror, Scroll, Buddha).

- **Win**: `len(player.follower_ids) >= 20` AND `len(player.sacred_items) == 3`
- **Loss (death)**: player energy reaches 0
- **Loss (time)**: if the player collects 20 followers but never held all 3 sacred items, Buddha kills them at the end (enforce: win check also requires sacred items)

The primary path to followers is the **social chain**: befriend an NPC → give them orders → they befriend others → those NPCs befriend more people → chain grows. Violence and bribery are secondary tools.

---

## 2. Data Models

See `src/shogun/core/models.py` for the canonical Python definitions. Field reference:

### Player
| Field | Type | Notes |
|---|---|---|
| position | tuple[float, float] | world pixel coords |
| energy | float | 0–100; 0 = death |
| yen | int | currency |
| follower_ids | list[str] | NPC ids who follow player |
| sacred_items | list[str] | ["mirror","scroll","buddha"] subsets |
| current_zone_id | str | which zone player is in |

### NPC
| Field | Type | Notes |
|---|---|---|
| id | str | unique, stable across reincarnations |
| name | str | display name |
| npc_class | NpcClass | current class (can change on reincarnation) |
| zone_id | str | current zone |
| position | tuple[float, float] | world pixel coords |
| energy | float | 0–max_energy |
| max_energy | float | from NPC class table (Section 3) |
| speed | float | pixels/tick, from NPC class table |
| is_follower | bool | True if aligned with player |
| orders | list[Order] | max 2 entries |
| yen | int | carried currency (dropped on death) |
| is_dead | bool | |
| death_tick | int | elapsed_ticks when died; -1 if alive |
| allegiance | str \| None | player id or None |
| combat_target | str \| None | id of NPC/player being chased |
| bribed_until_tick | int | ticks until bribe effect expires; -1 if none |

### Order
| Field | Type | Notes |
|---|---|---|
| action | "befriend" \| "attack" | attack-player is hard-blocked |
| target_id | str | NPC id to act on |
| completed | bool | set True after execution |

### Item
| Field | Type | Notes |
|---|---|---|
| name | "mirror" \| "scroll" \| "buddha" | |
| zone_id | str | current zone (follows holder) |
| position | tuple[float, float] | if on ground |
| holder_id | str \| None | player id or NPC id; None = on ground |

### Zone
| Field | Type | Notes |
|---|---|---|
| id | str | |
| name | str | display name |
| tile_map | list[list[int]] | 2D grid; see tile IDs in Section 13 |
| portals | list[Portal] | exit rectangles |
| npc_ids | list[str] | NPCs present in this zone |
| item_ids | list[str] | items on ground in this zone |

### Portal
| Field | Type | Notes |
|---|---|---|
| rect | tuple[int,int,int,int] | x, y, w, h in tile coords |
| target_zone_id | str | |
| target_position | tuple[float,float] | spawn point in target zone (pixels) |

### GameState
| Field | Type | Notes |
|---|---|---|
| player | Player | |
| npcs | dict[str, NPC] | keyed by NPC id |
| zones | dict[str, Zone] | keyed by zone id |
| items | dict[str, Item] | keyed by item name |
| game_phase | "playing"\|"won"\|"lost" | |
| elapsed_ticks | int | increments every game tick |

---

## 3. NPC Classes

Tier order (low → high): Bandit < Peasant < Servant < Geisha < Samurai < Lord

| Class | Tier | Max Energy | Speed (px/tick) | Yen Drop | Befriend Cost (energy%) | Bribe Cost (yen) |
|---|---|---|---|---|---|---|
| BANDIT | 0 | 60 | 2.5 | 5–15 | 60% or less | 20 |
| PEASANT | 1 | 70 | 2.0 | 10–25 | 60% or less | 35 |
| SERVANT | 2 | 80 | 2.0 | 15–35 | 50% or less | 50 |
| GEISHA | 3 | 75 | 2.2 | 20–50 | 50% or less | 70 |
| SAMURAI | 4 | 100 | 3.0 | 30–80 | 40% or less | 120 |
| LORD | 5 | 120 | 1.5 | 50–150 | 30% or less | 250 |

"Befriend Cost (energy%)" = NPC must be at or below this energy percentage for the player's Heart action to succeed without a bribe.

---

## 4. Zones

| Zone ID | Display Name | Portals To | NPC Populations | Item Spawns |
|---|---|---|---|---|
| bridge | Near the Bridge | gardens (east edge) | 2 bandits, 2 peasants | — |
| gardens | Gardens of Life | bridge (west edge), village (north edge) | 2 servants, 2 geisha | scroll |
| village | The Village | gardens (south edge), temple (east edge) | 2 peasants, 1 samurai, 1 lord | mirror |
| temple | The Temple | village (west edge) | 2 samurai | buddha |

Player starts at bridge, position (200, 300).

Zone dimensions: 40 tiles wide × 30 tiles tall. Tile size: 32px. Screen: 1280 × 960.

---

## 5. Movement Rules

- **Player speed**: 3.0 px/tick (WASD or arrow keys)
- **Tile collision**: tile IDs 0 (floor/grass) and 4 (bridge plank) are passable; all others block movement
- **NPC idle wander**: random direction change every 60–120 ticks, speed = class speed × 0.5
- **NPC chase**: when `combat_target` is set, move toward target at full class speed
- **Zone transition**: when player rect overlaps a portal rect (tile coords × 32), teleport to `target_position` in `target_zone_id`, clear `combat_target` on all NPCs in old zone

---

## 6. Social System

### Befriend Action (player → NPC)
1. Player presses **H** (Heart) while within 48px of NPC
2. Check willingness:
   - NPC `is_follower == False`
   - NPC `is_dead == False`
   - NPC energy ≤ befriend threshold (Section 3) OR `bribed_until_tick > elapsed_ticks`
3. On success: `npc.is_follower = True`, `npc.allegiance = "player"`, open Order Assignment UI
4. On failure: display "Not yet willing" message for 90 ticks

### Order Assignment UI
- Shows list of all living NPCs in current zone
- Player picks up to 2 orders (action + target NPC)
- `action == "attack"` with `target_id == "player"` is **hard-blocked** (UI hides this option)

### Follower Chain (autonomous)
- Each tick, `orders.py` moves followers toward their assigned targets
- On contact (within 48px): execute order action using same logic as player action
- Newly befriended NPCs gain `is_follower = True`; their orders are empty until player next interacts

---

## 7. Combat System

### Initiating Combat
- Player presses **A** (Attack) within 48px of NPC
- Sets `npc.combat_target = "player"` and `player.combat_target = npc.id`

### Energy Drain (per tick, while within contact distance ≤ 48px)
| Who takes damage | Rate (per tick) |
|---|---|
| NPC | 1.5 |
| Player | 0.4 |

This asymmetry makes attack-and-flee viable: player loses 0.4/tick on contact, NPC loses 1.5/tick.

### Combat Resolution
- NPC energy ≤ 0: NPC **yields** — sets `combat_target = None`, becomes befriendable at half normal threshold for 300 ticks
- NPC energy ≤ −20 (continued combat after yield): NPC **dies** → trigger reincarnation
- Player energy ≤ 0: `game_phase = "lost"`

### Flee Mechanic
- If player moves > 96px from NPC during combat, NPC continues chasing but at 0.8× speed
- No energy drain while not in contact range

---

## 8. Orders System

Each tick, for every follower with uncompleted orders:

1. If follower and target are in different zones: skip (followers don't cross zones autonomously)
2. Move follower toward target at full class speed
3. On contact (≤ 48px):
   - `action == "befriend"`: apply Social System befriend logic (Section 6) between follower and target
   - `action == "attack"`: apply Combat System (Section 7) between follower and target — **guard: target_id must never equal "player"**
4. Mark order `completed = True`

---

## 9. Reincarnation

On NPC death:
- `npc.is_dead = True`
- `npc.death_tick = elapsed_ticks`
- `npc.is_follower = False`
- `npc.allegiance = None`
- `npc.orders = []`
- Any items held by NPC drop to ground at NPC's last position

Respawn trigger: `elapsed_ticks - npc.death_tick >= RESPAWN_DELAY` (default: 1800 ticks = 60s at 30 FPS)

On respawn:
- Roll new class using weighted table:

| Class | Weight |
|---|---|
| BANDIT | 30 |
| PEASANT | 25 |
| SERVANT | 20 |
| GEISHA | 12 |
| SAMURAI | 10 |
| LORD | 3 |

- Reset `energy = max_energy` for new class
- Reset position to zone's NPC spawn point
- `is_dead = False`, `death_tick = -1`

---

## 10. Economy

### Bribe Action
1. Player presses **B** (Bribe) within 48px of NPC
2. UI shows bribe cost (Section 3 table) and player's current yen
3. On confirm: deduct yen, set `npc.bribed_until_tick = elapsed_ticks + 600`
4. While bribed: NPC passes willingness check in Social System regardless of energy

### Yen Income
- NPC death: player receives NPC's yen drop (random range from Section 3 table) if player was the combat initiator
- Item pickup: no yen income (items are kept, not sold)

---

## 11. Sacred Items

Three items must be held by the player simultaneously to win:

| Item | Starting Zone | Starting Position (tile) |
|---|---|---|
| mirror | village | (25, 15) |
| scroll | gardens | (20, 10) |
| buddha | temple | (30, 20) |

### Pickup
- Player walks over item (within 32px) → auto-pickup → item added to `player.sacred_items`
- Item removed from zone's ground

### Win Check (applied every tick)
```
if len(player.follower_ids) >= 20 and set(player.sacred_items) == {"mirror","scroll","buddha"}:
    game_phase = "won"
```

---

## 12. UI / HUD Layout

Screen: 1280 × 960px. HUD strip at bottom: y=880–960, full width.

| Element | Position | Notes |
|---|---|---|
| Follower count | x=20, y=888 | "Followers: N / 20" |
| Yen | x=200, y=888 | "Yen: N" |
| Energy bar | x=400, y=888, w=200, h=20 | green→red as energy drops |
| Item slots (3) | x=650, y=888 | grey rect until collected, gold when held |
| Action hint | x=20, y=920 | "H=Befriend  A=Attack  B=Bribe  ESC=Quit" |
| Zone name | x=1100, y=888 | right-aligned |

**Action Menu** (shown when adjacent to NPC):
- Rendered as a small panel (200×120px) near the player
- Buttons: Heart (H), Sword (A), Coin (B)
- Grayed-out if action not available (e.g., already a follower → no befriend)

**Order Assignment Screen** (full-screen overlay):
- List of NPCs in zone with name + class
- Two order slots; each slot: action dropdown + target dropdown
- Confirm / Cancel buttons

---

## 13. Constants Reference

All magic numbers live in `src/shogun/core/constants.py`. Never hardcode these values in system files.

| Constant | Value | Used In |
|---|---|---|
| SCREEN_W | 1280 | ui/ |
| SCREEN_H | 960 | ui/ |
| HUD_H | 80 | ui/hud.py |
| TILE_SIZE | 32 | world/, systems/movement.py |
| FPS | 30 | main.py |
| PLAYER_SPEED | 3.0 | systems/movement.py |
| CONTACT_DISTANCE | 48 | systems/social.py, combat.py, orders.py |
| PLAYER_DRAIN_RATE | 0.4 | systems/combat.py |
| NPC_DRAIN_RATE | 1.5 | systems/combat.py |
| YIELD_THRESHOLD | 0 | systems/combat.py |
| DEATH_THRESHOLD | -20 | systems/combat.py |
| YIELD_BEFRIEND_TICKS | 300 | systems/combat.py |
| FLEE_DISTANCE | 96 | systems/combat.py |
| FLEE_SPEED_MULT | 0.8 | systems/combat.py |
| RESPAWN_DELAY | 1800 | systems/reincarnation.py |
| BRIBE_DURATION | 600 | systems/economy.py |
| ORDER_CONTACT_DISTANCE | 48 | systems/orders.py |
| WIN_FOLLOWER_COUNT | 20 | systems/win_condition.py |
| PASSABLE_TILES | {0, 4} | systems/movement.py |

**Tile IDs:**
| ID | Tile Type |
|---|---|
| 0 | floor / grass (passable) |
| 1 | wall / tree |
| 2 | water |
| 3 | building |
| 4 | bridge plank (passable) |
| 5 | rock |

**NPC Class Lookup** (dict in constants.py keyed by NpcClass enum):
```python
NPC_CLASS_DATA = {
    NpcClass.BANDIT:  dict(max_energy=60,  speed=2.5, yen_min=5,  yen_max=15,  befriend_pct=60, bribe_cost=20),
    NpcClass.PEASANT: dict(max_energy=70,  speed=2.0, yen_min=10, yen_max=25,  befriend_pct=60, bribe_cost=35),
    NpcClass.SERVANT: dict(max_energy=80,  speed=2.0, yen_min=15, yen_max=35,  befriend_pct=50, bribe_cost=50),
    NpcClass.GEISHA:  dict(max_energy=75,  speed=2.2, yen_min=20, yen_max=50,  befriend_pct=50, bribe_cost=70),
    NpcClass.SAMURAI: dict(max_energy=100, speed=3.0, yen_min=30, yen_max=80,  befriend_pct=40, bribe_cost=120),
    NpcClass.LORD:    dict(max_energy=120, speed=1.5, yen_min=50, yen_max=150, befriend_pct=30, bribe_cost=250),
}

REINCARNATION_WEIGHTS = [
    (NpcClass.BANDIT, 30), (NpcClass.PEASANT, 25), (NpcClass.SERVANT, 20),
    (NpcClass.GEISHA, 12), (NpcClass.SAMURAI, 10), (NpcClass.LORD, 3),
]
```

---

## 14. Implementation Status Tracker

> **Agents: update the status field for your system when you start and when you finish.**
> Format: `[ ]` not started · `[~]` in progress · `[x]` done

### Phase 0 — Foundation
- [x] `core/constants.py`
- [x] `core/models.py`
- [x] `core/events.py`
- [x] `main.py` (stub)
- [x] `GAME_SPEC.md` (this file)
- [x] `CLAUDE.md`

### Phase 1 — World & Movement
- [x] `world/__init__.py` (build_world — zones, NPC spawn, items)
- [x] `systems/movement.py`
- [x] `ui/zone_renderer.py`
- [x] `ui/sprites.py`
- [x] `ui/hud.py`
- [x] Wire player movement in `main.py`

### Phase 2 — Core Systems (parallel)
- [x] `systems/combat.py` + `tests/test_combat.py`
- [x] `systems/social.py` + `tests/test_social.py`
- [x] `systems/reincarnation.py` + `tests/test_reincarnation.py`
- [x] `systems/economy.py` + `tests/test_economy.py`

### Phase 3 — Orders & Win/Loss
- [x] `systems/orders.py` + `tests/test_orders.py`
- [x] `systems/win_condition.py` + `tests/test_win_condition.py`

### Phase 4 — UI Polish
- [x] `ui/hud.py`
- [x] `ui/dialogue.py` (ActionMenu + OrderScreen)
- [x] `ui/renderer.py` (final wiring)
- [x] Energy regeneration
- [x] Minimap
- [x] Title screen

### Phase 5 — Integration
- [ ] Real sprite sheets
- [x] Real tile maps
- [~] End-to-end playthrough test

---

## SPEC_QUESTIONS

> Add unresolved spec questions here rather than guessing in code.

*(none yet)*
