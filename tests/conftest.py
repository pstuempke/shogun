import os
os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
os.environ.setdefault("SDL_AUDIODRIVER", "dummy")

import pygame
pygame.init()

import pytest
from shogun.core.models import GameState, Player, NPC, Zone, Item
from shogun.core.constants import NpcClass


def make_zone(zone_id: str = "bridge") -> Zone:
    tile_map = [[0] * 40 for _ in range(30)]
    return Zone(id=zone_id, name="Test Zone", tile_map=tile_map, portals=[])


def make_npc(npc_id: str = "npc_0", npc_class: NpcClass = NpcClass.BANDIT, zone_id: str = "bridge") -> NPC:
    return NPC(id=npc_id, name="TestNPC", npc_class=npc_class, zone_id=zone_id, position=(400.0, 300.0), yen=10)


def make_state(npc: NPC | None = None, zone_id: str = "bridge") -> GameState:
    zone = make_zone(zone_id)
    npcs: dict = {}
    if npc:
        npcs[npc.id] = npc
        zone.npc_ids.append(npc.id)
    player = Player(position=(400.0, 300.0), current_zone_id=zone_id)
    return GameState(
        player=player,
        npcs=npcs,
        zones={zone_id: zone},
        items={},
    )
