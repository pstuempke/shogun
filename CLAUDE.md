# Shogun — Claude Code Agent Workflow

## Overview

This project uses a **spec-driven agent workflow**. The file `GAME_SPEC.md` is the authoritative source of truth for all game behavior. Agents implement systems by reading the spec — they do not invent behavior.

---

## Before You Start Any Work

1. **Read `GAME_SPEC.md`** — specifically the section(s) relevant to what you're implementing.
2. **Check Section 14 (Status Tracker)**. If a system is marked `[~]` (in progress), do not touch it. Pick something marked `[ ]` (not started).
3. **Mark your system `[~]`** in the tracker before writing any code.
4. **Mark it `[x]`** when done and tests pass.

---

## Dependency Order

You must respect this sequence — systems higher in the list must exist before you implement systems that depend on them:

```
core/models.py          ← everything imports from here; implement first
core/constants.py       ← imported by all systems; implement first
core/events.py          ← custom pygame events; implement early

systems/social.py       → systems/orders.py → systems/win_condition.py
world/zone.py           → world/zones/*.py  → world/npc_spawner.py
ui/zone_renderer.py  ┐
ui/sprites.py        ├─ → ui/renderer.py → main.py (wire last)
ui/hud.py            │
ui/dialogue.py       ┘
```

**Systems that can be implemented in parallel** (no runtime dependency on each other):
- `systems/combat.py`
- `systems/reincarnation.py`
- `systems/economy.py`
- `world/zones/bridge.py`, `gardens.py`, `village.py`, `temple.py`
- `ui/hud.py`
- `ui/dialogue.py`

---

## Implementation Rules

### Spec compliance
- Never implement behavior that contradicts `GAME_SPEC.md`.
- If a spec section is ambiguous, add a `SPEC_QUESTION:` entry at the bottom of `GAME_SPEC.md` and implement the most conservative interpretation.
- All numeric constants must come from `core/constants.py`. No magic numbers in system files.

### Asset stubs
- If sprite images or tile maps are missing, use colored `pygame.Rect` fills as placeholders.
- Never block logic implementation waiting on art assets.

### Testing
- Every system in `systems/` has a paired test file in `tests/test_<system>.py`.
- Tests import only the system module and `core/models.py` — **no pygame display required**. Use `os.environ["SDL_VIDEODRIVER"] = "dummy"` and `pygame.init()` at the top of test files if pygame must be imported.
- Run `pytest` before marking a system done.

### Code style
- Python 3.11+, type hints on all function signatures.
- Dataclasses for all models (already defined in `core/models.py`).
- No comments explaining what code does — only add comments for non-obvious WHY decisions.

---

## Running the Game

```bash
# from repo root
source .venv/bin/activate
python -m shogun.main
```

Controls:
- **WASD / Arrow keys** — move
- **H** — Heart (befriend adjacent NPC)
- **A** — Attack adjacent NPC
- **B** — Bribe adjacent NPC
- **ESC** — quit

---

## Project Structure

```
src/shogun/
    main.py                 # game loop (implement last)
    core/
        constants.py        # all magic numbers
        models.py           # all dataclasses
        game.py             # GameState orchestrator
        events.py           # custom pygame event IDs
    systems/
        movement.py         # player + NPC movement, collisions, zone transitions
        social.py           # befriend, follower chain
        combat.py           # energy drain, yield, death
        orders.py           # follower order dispatch
        reincarnation.py    # death timer, class re-roll on respawn
        economy.py          # yen, bribe
        win_condition.py    # win/loss check
    world/
        zone.py             # Zone dataclass loader
        npc_spawner.py      # per-zone NPC populations
        zones/
            bridge.py
            gardens.py
            village.py
            temple.py
    ui/
        renderer.py         # master draw (wire last)
        zone_renderer.py    # tile layer + camera
        sprites.py          # PlayerSprite, NpcSprite
        hud.py              # bottom HUD strip
        dialogue.py         # action menu + order assignment overlay
    assets/
        tilemaps/           # CSV tile maps
        sprites/            # PNGs
        fonts/
GAME_SPEC.md                # authoritative design doc
CLAUDE.md                   # this file
tests/
```
