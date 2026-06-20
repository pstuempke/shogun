# Shogun

A feudal Japan strategy game written in Python with pygame. Build a following, recover three sacred items, and claim the title of Shogun.

## Gameplay

You play as a wandering warrior in 1560s Japan. Your goal is to amass **20 followers** while collecting all three **sacred items** (Mirror, Scroll, Buddha).

**Actions (when adjacent to an NPC):**
- `H` — Befriend (drain their energy below the threshold, then recruit)
- `A` — Attack (drain energy, may yield yen)
- `B` — Bribe (spend yen to instantly convert)
- `H` on a follower — Open order assignment screen

**Movement:** WASD or arrow keys. Walk through portals (glowing yellow borders) to change zones.

**Follower orders:** Each follower can be given up to 2 orders (befriend or attack a target NPC). They execute autonomously, building your follower chain.

### Win conditions

| Condition | How |
|---|---|
| Immediate win | Reach 20 followers while already holding all 3 sacred items |
| Delivery win | Reach 20 followers without all items → a 5-minute timer starts; recover all items before time expires |
| Loss (death) | Your energy reaches 0 |
| Loss (timeout) | Delivery timer expires |

### Character classes

Choose your starting class before the game begins:

| Class | Starting Yen | Energy | Bonus Followers |
|---|---|---|---|
| Ronin | 50 | 100 | 0 |
| Samurai | 80 | 100 | 1 |
| Lord | 150 | 120 | 2 |
| Geisha | 120 | 85 | 0 |

### NPC classes

NPCs reincarnate after death with a randomly rolled class.

| Class | Max Energy | Speed | Bribe Cost |
|---|---|---|---|
| Bandit | 60 | 2.5 px/tick | 20 yen |
| Peasant | 70 | 2.0 | 35 yen |
| Servant | 80 | 2.0 | 50 yen |
| Geisha | 75 | 2.2 | 70 yen |
| Samurai | 100 | 3.0 | 120 yen |
| Lord | 120 | 1.5 | 250 yen |

**Rivals:** Lord-class NPCs may be designated rival Shogun candidates — they actively recruit followers on their own.

## Setup

Requires Python 3.11+ and pygame 2.5+.

```bash
pip install -e .
python -m shogun.main
```

## Running tests

```bash
pip install pytest
pytest
```

## Project structure

```
src/shogun/
    main.py               # game loop
    core/
        constants.py      # all numeric constants
        models.py         # dataclasses (Player, NPC, Zone, …)
        game.py           # GameState factory
        events.py         # custom pygame events
    systems/
        movement.py       # player + NPC movement, zone transitions
        social.py         # befriend, follower chains
        combat.py         # energy drain, death
        orders.py         # follower order dispatch
        reincarnation.py  # death timer, class re-roll
        economy.py        # yen, bribery
        win_condition.py  # win/loss detection
        npc_ai.py         # rival AI, betrayal
    world/
        zone.py           # Zone loader
        npc_spawner.py    # per-zone NPC populations
        zones/            # bridge, gardens, village, temple
    ui/
        renderer.py       # master draw
        zone_renderer.py  # tile layer + camera + items
        sprites.py        # player + NPC drawing, Camera
        hud.py            # bottom HUD strip + news ticker
        dialogue.py       # action menu + order assignment overlay
        character_select.py
        title.py
        pause.py
        end_screen.py
GAME_SPEC.md              # authoritative design document
tests/                    # pytest test suite
```
