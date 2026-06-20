from __future__ import annotations
import random
from shogun.core.models import GameState
from shogun.core.constants import WIN_FOLLOWER_COUNT, SACRED_ITEMS, DELIVERY_TIME_LIMIT


def check_win_loss(state: GameState) -> None:
    """Update game_phase based on win/loss conditions. Call once per tick."""
    if state.game_phase != "playing":
        return

    if state.player.energy <= 0:
        state.game_phase = "lost"
        return

    # Delivery deadline: player triggered the 20-follower milestone but didn't hold items in time
    if state.delivery_phase and state.player.delivery_deadline_tick > 0:
        if state.elapsed_ticks >= state.player.delivery_deadline_tick:
            state.game_phase = "lost"
            state.log_event("Time has run out. The sacred items are lost forever.")
            return

    player = state.player
    has_all_items = SACRED_ITEMS.issubset(set(player.sacred_items))
    has_enough = len(player.follower_ids) >= WIN_FOLLOWER_COUNT

    # First time reaching 20 followers
    if has_enough and not player.shogun_milestone_reached:
        player.shogun_milestone_reached = True
        if has_all_items:
            state.game_phase = "won"
            return
        # Items not in hand: scatter them across the world and start the delivery clock
        _scramble_items(state)
        player.delivery_deadline_tick = state.elapsed_ticks + DELIVERY_TIME_LIMIT
        state.delivery_phase = True
        state.log_event("The Buddha commands: recover the sacred items before time runs out!")
        state.show_message("20 FOLLOWERS! Sacred items scattered — gather them in time!", 300)
        return

    # During delivery phase: re-collecting all items wins
    if state.delivery_phase and has_all_items:
        state.game_phase = "won"


def _scramble_items(state: GameState) -> None:
    """Remove all sacred items from the player and scatter them to random zones."""
    zone_ids = list(state.zones.keys())
    for item_name in list(SACRED_ITEMS):
        item = state.items.get(item_name)
        if item is None:
            continue
        if item_name in state.player.sacred_items:
            state.player.sacred_items.remove(item_name)
        item.holder_id = None
        # remove from whichever zone currently tracks it
        for zone in state.zones.values():
            if item_name in zone.item_ids:
                zone.item_ids.remove(item_name)
        # place in a random zone
        new_zone_id = random.choice(zone_ids)
        new_zone = state.zones[new_zone_id]
        zone_w = len(new_zone.tile_map[0]) * 32
        zone_h = len(new_zone.tile_map) * 32
        item.zone_id = new_zone_id
        item.position = (
            float(random.randint(80, zone_w - 80)),
            float(random.randint(80, zone_h - 80)),
        )
        if item_name not in new_zone.item_ids:
            new_zone.item_ids.append(item_name)
        state.log_event(f"The {item_name.upper()} vanishes to {new_zone.name}!")
