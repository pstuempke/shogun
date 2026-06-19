from __future__ import annotations
from shogun.core.models import GameState
from shogun.core.constants import WIN_FOLLOWER_COUNT, SACRED_ITEMS


def check_win_loss(state: GameState) -> None:
    """Update game_phase based on win/loss conditions. Call once per tick."""
    if state.game_phase != "playing":
        return
    if state.player.energy <= 0:
        state.game_phase = "lost"
        return
    if (
        len(state.player.follower_ids) >= WIN_FOLLOWER_COUNT
        and SACRED_ITEMS.issubset(set(state.player.sacred_items))
    ):
        state.game_phase = "won"
