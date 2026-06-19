from __future__ import annotations
from shogun.core.models import GameState, NPC
from shogun.core.constants import CONTACT_DISTANCE, NPC_CLASS_DATA


def _dist(ax: float, ay: float, bx: float, by: float) -> float:
    return ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5


def nearest_npc(state: GameState) -> NPC | None:
    """Return the closest living NPC to the player within CONTACT_DISTANCE, or None."""
    px, py = state.player.position
    best: NPC | None = None
    best_d = float("inf")
    for nid in state.current_zone.npc_ids:
        npc = state.npcs.get(nid)
        if npc is None or npc.is_dead:
            continue
        d = _dist(px, py, npc.position[0], npc.position[1])
        if d <= CONTACT_DISTANCE and d < best_d:
            best = npc
            best_d = d
    return best


def can_befriend(state: GameState, npc: NPC) -> bool:
    if npc.is_dead or npc.is_follower:
        return False
    bribed = npc.bribed_until_tick >= state.elapsed_ticks
    threshold = NPC_CLASS_DATA[npc.npc_class]["befriend_pct"]
    return bribed or npc.energy_pct <= threshold


def player_befriend(state: GameState, npc: NPC) -> str:
    """Attempt to befriend an NPC. Returns a status message."""
    if npc.is_dead:
        return f"{npc.name} is dead."
    if npc.is_follower:
        return f"{npc.name} already follows you."
    if not can_befriend(state, npc):
        threshold = NPC_CLASS_DATA[npc.npc_class]["befriend_pct"]
        return f"{npc.name} is not yet willing. (need energy ≤{threshold}%)"
    _make_follower(state, npc, "player")
    state.show_message(f"{npc.name} joins you! Assign orders.", 120)
    return f"{npc.name} now follows you!"


def _make_follower(state: GameState, npc: NPC, allegiance: str) -> None:
    npc.is_follower = True
    npc.allegiance = allegiance
    npc.combat_target = None
    if allegiance == "player" and npc.id not in state.player.follower_ids:
        state.player.follower_ids.append(npc.id)
    state.show_message(f"{npc.name} is now a follower!", 90)
    zone_name = state.zones[npc.zone_id].name
    state.log_event(f"{npc.name} joins your cause in {zone_name}.")


def follower_befriend(state: GameState, follower: NPC, target: NPC) -> bool:
    """A follower attempts to befriend a target NPC. Returns True on success."""
    if not can_befriend(state, target):
        return False
    zone_name = state.zones[target.zone_id].name
    state.log_event(f"{follower.name} befriends {target.name} in {zone_name}.")
    _make_follower(state, target, "player")
    return True
