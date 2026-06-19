from __future__ import annotations
from shogun.core.models import GameState, Player, NPC, Item
from shogun.core.constants import NpcClass
from shogun.world import build_world


def new_game() -> GameState:
    zones, npcs, items = build_world()
    player = Player(position=(200.0, 300.0), current_zone_id="bridge")
    return GameState(
        player=player,
        npcs=npcs,
        zones=zones,
        items=items,
    )
