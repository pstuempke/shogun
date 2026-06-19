from __future__ import annotations
from shogun.core.models import GameState, NPC
from shogun.core.constants import BRIBE_DURATION, NPC_CLASS_DATA


def bribe_cost(npc: NPC) -> int:
    return NPC_CLASS_DATA[npc.npc_class]["bribe_cost"]


def player_bribe(state: GameState, npc: NPC) -> str:
    """Attempt to bribe an NPC. Returns a status message."""
    if npc.is_dead:
        return f"{npc.name} is dead."
    if npc.is_follower:
        return f"{npc.name} already follows you."
    cost = bribe_cost(npc)
    if state.player.yen < cost:
        return f"Not enough yen. Need {cost}, have {state.player.yen}."
    state.player.yen -= cost
    npc.bribed_until_tick = state.elapsed_ticks + BRIBE_DURATION
    state.show_message(f"You bribe {npc.name} for {cost} yen.", 90)
    state.log_event(f"You pay {cost} yen to bribe {npc.name}.")
    return f"{npc.name} is bribed for {BRIBE_DURATION} ticks."
