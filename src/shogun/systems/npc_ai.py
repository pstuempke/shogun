from __future__ import annotations
import random
from shogun.core.models import GameState, NPC
from shogun.core.constants import (
    CONTACT_DISTANCE, NPC_CLASS_DATA,
    RIVAL_BEFRIEND_INTERVAL, RIVAL_WIN_COUNT,
    BETRAYAL_CHANCE_BANDIT, BETRAYAL_CHANCE_UNRELIABLE,
    NpcClass,
)


def _dist(ax: float, ay: float, bx: float, by: float) -> float:
    return ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5


def _rival_follower_count(state: GameState, rival_id: str) -> int:
    return sum(1 for n in state.npcs.values() if n.allegiance == rival_id and not n.is_dead)


def update_rival_ai(state: GameState) -> None:
    """Each tick: rivals attempt to recruit followers and their followers stay close."""
    for npc in state.npcs.values():
        if npc.is_dead or not npc.rival_candidate:
            continue
        if npc.allegiance == "player":
            continue  # rival was recruited by the player; no longer acting independently
        _rival_recruit(state, npc)
        _rival_followers_follow(state, npc)


def _rival_recruit(state: GameState, rival: NPC) -> None:
    if state.elapsed_ticks % RIVAL_BEFRIEND_INTERVAL != 0:
        return

    # find the nearest unaligned, living NPC in the same zone
    rx, ry = rival.position
    best: NPC | None = None
    best_d = float("inf")
    for npc in state.npcs.values():
        if npc.is_dead or npc.id == rival.id or npc.zone_id != rival.zone_id:
            continue
        if npc.allegiance is not None:
            continue
        d = _dist(rx, ry, npc.position[0], npc.position[1])
        if d < best_d:
            best = npc
            best_d = d

    if best is None:
        return

    if best_d <= CONTACT_DISTANCE:
        threshold = NPC_CLASS_DATA[best.npc_class]["befriend_pct"]
        if best.energy_pct <= threshold or best.bribed_until_tick >= state.elapsed_ticks:
            best.allegiance = rival.id
            best.is_follower = True  # recruited — but NOT into player.follower_ids
            count = _rival_follower_count(state, rival.id)
            zone_name = state.zones[rival.zone_id].name
            state.log_event(f"{rival.name} gains a follower ({best.name}) in {zone_name}. [{count} total]")
            if count >= RIVAL_WIN_COUNT:
                state.log_event(f"WARNING: {rival.name} is rising to power with {count} followers!")
    else:
        # move toward target
        step = rival.speed / best_d
        rival.position = (
            rx + (best.position[0] - rx) * step,
            ry + (best.position[1] - ry) * step,
        )


def _rival_followers_follow(state: GameState, rival: NPC) -> None:
    """Rival followers orbit near their rival."""
    rx, ry = rival.position
    for npc in state.npcs.values():
        if npc.is_dead or npc.allegiance != rival.id or npc.id == rival.id:
            continue
        if npc.zone_id != rival.zone_id:
            continue
        nx, ny = npc.position
        d = _dist(nx, ny, rx, ry)
        if d > 80:
            step = npc.speed * 0.6 / d
            npc.position = (nx + (rx - nx) * step, ny + (ry - ny) * step)


def update_betrayal(state: GameState) -> None:
    """Bandits and unreliable followers may betray the player each tick."""
    for npc_id in list(state.player.follower_ids):
        npc = state.npcs.get(npc_id)
        if npc is None or npc.is_dead or not npc.is_follower or npc.allegiance != "player":
            continue
        chance = 0.0
        if npc.npc_class == NpcClass.BANDIT:
            chance = BETRAYAL_CHANCE_BANDIT
        elif npc.is_unreliable:
            chance = BETRAYAL_CHANCE_UNRELIABLE
        if chance > 0 and random.random() < chance:
            betray(state, npc)


def betray(state: GameState, npc: NPC) -> None:
    """Force an NPC to betray the player immediately."""
    npc.is_follower = False
    npc.allegiance = None
    npc.orders = []
    if npc.id in state.player.follower_ids:
        state.player.follower_ids.remove(npc.id)
    npc.combat_target = "player"
    zone_name = state.zones[npc.zone_id].name
    state.log_event(f"{npc.name} has BETRAYED you in {zone_name}!")
    state.show_message(f"{npc.name} betrays you!", 180)
