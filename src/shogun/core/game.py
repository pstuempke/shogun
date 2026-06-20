from __future__ import annotations
from shogun.core.models import GameState, Player, NPC, Item
from shogun.core.constants import NpcClass, CHARACTER_STARTS
from shogun.world import build_world


def new_game(char_key: str = "Ronin") -> GameState:
    cfg = CHARACTER_STARTS.get(char_key, CHARACTER_STARTS["Ronin"])
    zones, npcs, items = build_world()

    player = Player(
        position=(200.0, 300.0),
        current_zone_id="bridge",
        energy=cfg["energy"],
        yen=cfg["yen"],
    )

    state = GameState(player=player, npcs=npcs, zones=zones, items=items)

    # Pre-recruit bonus followers from bridge zone for higher-class starts
    bonus = cfg["bonus_followers"]
    if bonus > 0:
        bridge_npcs = [npcs[nid] for nid in zones["bridge"].npc_ids if nid in npcs]
        for npc in bridge_npcs[:bonus]:
            npc.is_follower = True
            npc.allegiance = "player"
            player.follower_ids.append(npc.id)

    return state
