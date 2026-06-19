from __future__ import annotations
from shogun.core.models import Zone, NPC, Item, Portal
from shogun.core.constants import NpcClass, NPC_CLASS_DATA, TILE_FLOOR, TILE_WALL
import random


def _flat_map(w: int, h: int, fill: int = TILE_FLOOR) -> list[list[int]]:
    return [[fill] * w for _ in range(h)]


def build_world() -> tuple[dict, dict, dict]:
    zones: dict[str, Zone] = {}
    npcs: dict[str, NPC] = {}
    items: dict[str, Item] = {}

    bridge_map = _flat_map(40, 30)
    for row in range(30):
        bridge_map[row][0] = bridge_map[row][39] = TILE_WALL
    for col in range(40):
        bridge_map[0][col] = bridge_map[29][col] = TILE_WALL

    zones["bridge"] = Zone(
        id="bridge", name="Near the Bridge",
        tile_map=bridge_map,
        portals=[Portal(rect=(38, 10, 2, 10), target_zone_id="gardens", target_position=(64.0, 300.0))],
    )
    zones["gardens"] = Zone(
        id="gardens", name="Gardens of Life",
        tile_map=_flat_map(40, 30),
        portals=[
            Portal(rect=(0, 10, 2, 10), target_zone_id="bridge",  target_position=(1184.0, 300.0)),
            Portal(rect=(15, 0, 10, 2), target_zone_id="village", target_position=(300.0, 880.0)),
        ],
        item_ids=["scroll"],
    )
    zones["village"] = Zone(
        id="village", name="The Village",
        tile_map=_flat_map(40, 30),
        portals=[
            Portal(rect=(15, 28, 10, 2), target_zone_id="gardens", target_position=(300.0, 64.0)),
            Portal(rect=(38, 10, 2, 10), target_zone_id="temple",  target_position=(64.0, 300.0)),
        ],
        item_ids=["mirror"],
    )
    zones["temple"] = Zone(
        id="temple", name="The Temple",
        tile_map=_flat_map(40, 30),
        portals=[Portal(rect=(0, 10, 2, 10), target_zone_id="village", target_position=(1184.0, 300.0))],
        item_ids=["buddha"],
    )

    _spawn_npcs(zones, npcs)

    items["scroll"] = Item(name="scroll", zone_id="gardens", position=(640.0, 320.0))
    items["mirror"] = Item(name="mirror", zone_id="village",  position=(800.0, 480.0))
    items["buddha"] = Item(name="buddha", zone_id="temple",   position=(960.0, 640.0))

    return zones, npcs, items


def _spawn_npcs(zones: dict, npcs: dict) -> None:
    spawn_config = [
        ("bridge",  [(NpcClass.BANDIT, 2), (NpcClass.PEASANT, 2)]),
        ("gardens", [(NpcClass.SERVANT, 2), (NpcClass.GEISHA, 2)]),
        ("village", [(NpcClass.PEASANT, 2), (NpcClass.SAMURAI, 1), (NpcClass.LORD, 1)]),
        ("temple",  [(NpcClass.SAMURAI, 2)]),
    ]
    npc_names = {
        NpcClass.BANDIT:  ["Taro", "Kenji", "Ryu", "Jin"],
        NpcClass.PEASANT: ["Hana", "Sora", "Yuki", "Masa"],
        NpcClass.SERVANT: ["Miko", "Suki", "Nao", "Kei"],
        NpcClass.GEISHA:  ["Yoko", "Haru", "Midori", "Ume"],
        NpcClass.SAMURAI: ["Hawk", "Blade", "Ren", "Kuro"],
        NpcClass.LORD:    ["Daimyo", "Shogun-san", "Lord Oda", "Lord Mori"],
    }
    counters: dict[NpcClass, int] = {}

    for zone_id, config in spawn_config:
        zone = zones[zone_id]
        zone_w = len(zone.tile_map[0]) * 32
        zone_h = len(zone.tile_map) * 32
        margin = 100

        for npc_class, count in config:
            names = npc_names[npc_class]
            for _ in range(count):
                idx = counters.get(npc_class, 0)
                counters[npc_class] = idx + 1
                name = names[idx % len(names)]
                npc_id = f"{npc_class.name.lower()}_{idx}"
                npc = NPC(
                    id=npc_id, name=name, npc_class=npc_class, zone_id=zone_id,
                    position=(
                        float(random.randint(margin, zone_w - margin)),
                        float(random.randint(margin, zone_h - margin)),
                    ),
                    yen=random.randint(
                        NPC_CLASS_DATA[npc_class]["yen_min"],
                        NPC_CLASS_DATA[npc_class]["yen_max"],
                    ),
                )
                npcs[npc_id] = npc
                zone.npc_ids.append(npc_id)
