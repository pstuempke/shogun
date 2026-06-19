from __future__ import annotations
from shogun.core.models import GameState, NPC
from shogun.core.constants import (
    CONTACT_DISTANCE, PLAYER_DRAIN_RATE, NPC_DRAIN_RATE,
    YIELD_THRESHOLD, DEATH_THRESHOLD, YIELD_BEFRIEND_TICKS,
)


def _dist(ax: float, ay: float, bx: float, by: float) -> float:
    return ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5


def player_attack(state: GameState, npc: NPC) -> str:
    """Initiate combat between player and NPC. Returns a status message."""
    if npc.is_dead:
        return f"{npc.name} is already dead."
    if npc.is_follower:
        return f"{npc.name} follows you already."
    npc.combat_target = "player"
    state.player.combat_target = npc.id
    zone_name = state.zones[npc.zone_id].name
    state.log_event(f"You attack {npc.name} in {zone_name}.")
    return f"You attack {npc.name}!"


def update_combat(state: GameState) -> None:
    """Apply energy drain for all active combat contacts. Call once per tick."""
    player = state.player
    zone = state.current_zone

    for nid in zone.npc_ids:
        npc = state.npcs.get(nid)
        if npc is None or npc.is_dead or npc.combat_target is None:
            continue

        if npc.combat_target == "player":
            px, py = player.position
            nx, ny = npc.position
            if _dist(px, py, nx, ny) <= CONTACT_DISTANCE:
                npc.energy -= NPC_DRAIN_RATE
                player.energy -= PLAYER_DRAIN_RATE
                _resolve_npc(state, npc)
                if player.energy <= 0:
                    state.game_phase = "lost"
                    return
        elif npc.combat_target in state.npcs:
            _npc_vs_npc(state, npc)


def _resolve_npc(state: GameState, npc: NPC) -> None:
    if npc.energy <= DEATH_THRESHOLD:
        _kill_npc(state, npc)
    elif npc.energy <= YIELD_THRESHOLD:
        npc.combat_target = None
        if state.player.combat_target == npc.id:
            state.player.combat_target = None
        npc.bribed_until_tick = state.elapsed_ticks + YIELD_BEFRIEND_TICKS
        state.show_message(f"{npc.name} yields!", 90)
        state.log_event(f"{npc.name} yields to you in {state.zones[npc.zone_id].name}.")


def _kill_npc(state: GameState, npc: NPC) -> None:
    from shogun.systems.reincarnation import begin_death
    begin_death(state, npc)
    if state.player.combat_target == npc.id:
        state.player.combat_target = None
    # drop yen
    import random
    from shogun.core.constants import NPC_CLASS_DATA
    data = NPC_CLASS_DATA[npc.npc_class]
    drop = random.randint(data["yen_min"], data["yen_max"])
    state.player.yen += drop
    state.show_message(f"{npc.name} falls! +{drop} yen", 120)
    state.log_event(f"{npc.name} falls in {state.zones[npc.zone_id].name}. +{drop} yen.")


def _npc_vs_npc(state: GameState, attacker: NPC) -> None:
    target = state.npcs.get(attacker.combat_target)  # type: ignore[arg-type]
    if target is None or target.is_dead:
        attacker.combat_target = None
        return
    ax, ay = attacker.position
    tx, ty = target.position
    if _dist(ax, ay, tx, ty) <= CONTACT_DISTANCE:
        target.energy -= NPC_DRAIN_RATE
        attacker.energy -= PLAYER_DRAIN_RATE  # attacker takes less damage
        if target.energy <= DEATH_THRESHOLD:
            from shogun.systems.reincarnation import begin_death
            begin_death(state, target)
            attacker.combat_target = None
            state.log_event(f"{attacker.name} defeats {target.name} in {state.zones[target.zone_id].name}.")
        elif target.energy <= YIELD_THRESHOLD:
            attacker.combat_target = None
            target.bribed_until_tick = state.elapsed_ticks + YIELD_BEFRIEND_TICKS
            state.log_event(f"{attacker.name} forces {target.name} to yield.")
