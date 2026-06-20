from __future__ import annotations
from shogun.core.models import Zone, NPC, Item, Portal
from shogun.core.constants import NpcClass, NPC_CLASS_DATA, TILE_FLOOR, TILE_WALL
import random

G, W, WA, B, PL, R = 0, 1, 2, 3, 4, 5  # grass, wall/tree, water, building, bridge plank, rock


def _flat_map(w: int, h: int, fill: int = TILE_FLOOR) -> list[list[int]]:
    return [[fill] * w for _ in range(h)]


def _make_bridge_map() -> list[list[int]]:
    m = [[G] * 40 for _ in range(30)]
    # River runs vertically through cols 14-25
    for r in range(30):
        for c in range(14, 26):
            m[r][c] = WA
    # Bridge planks cross the river at rows 12-17
    # Portal east: cols 38-39, rows 10-19 stays grass (passable)
    # Player start: col 6, row 9 stays grass (passable)
    for r in range(12, 18):
        for c in range(14, 26):
            m[r][c] = PL
    # West bank tree line along col 0 and dense growth top/bottom
    for r in range(30):
        m[r][0] = W
    for r in range(0, 9):
        for c in range(1, 4):
            m[r][c] = W
    for r in range(20, 30):
        for c in range(1, 5):
            m[r][c] = W
    # Scattered trees mid-west bank (avoid rows 9-19 for NPC wander room)
    for (r, c) in [(3, 6), (4, 8), (5, 7), (6, 5), (21, 9), (22, 7), (24, 10), (25, 6)]:
        m[r][c] = W
    # Rocks on west bank approach
    m[9][11] = R
    m[10][12] = R
    m[19][12] = R
    m[20][10] = R
    # East bank trees and rocks (portal at cols 38-39 rows 10-19 stays clear)
    for r in range(0, 9):
        for c in range(27, 31):
            m[r][c] = W
    for r in range(21, 30):
        for c in range(27, 32):
            m[r][c] = W
    for (r, c) in [(3, 33), (5, 35), (22, 33), (24, 36)]:
        m[r][c] = W
    m[8][28] = R
    m[22][28] = R
    return m


def _make_gardens_map() -> list[list[int]]:
    m = [[G] * 40 for _ in range(30)]
    # Portal west: cols 0-1, rows 10-19 must stay passable
    # Portal north: cols 15-24, rows 0-1 must stay passable
    # Scroll at tile (20,10) must stay passable
    # Pond in bottom-left corner
    for r in range(21, 28):
        for c in range(1, 9):
            m[r][c] = WA
    # Stone path: diagonal winding strip of grass kept open (already grass)
    # Tree clusters: top-left area
    for r in range(1, 9):
        for c in range(1, 12):
            if (r + c) % 3 != 0:
                m[r][c] = W
    # Tree cluster: top-right corner (avoid portal cols 15-24 rows 0-1)
    for r in range(1, 8):
        for c in range(27, 39):
            if (r * c) % 4 != 0:
                m[r][c] = W
    # Tree cluster: bottom-right
    for r in range(20, 29):
        for c in range(30, 39):
            if (r + c) % 3 != 0:
                m[r][c] = W
    # Scattered trees mid-map (leave scroll area clear)
    for (r, c) in [(10, 5), (11, 7), (12, 4), (13, 8), (15, 12), (16, 3),
                   (14, 30), (15, 33), (16, 31), (17, 29)]:
        m[r][c] = W
    # Rocks near pond shore
    for (r, c) in [(20, 3), (20, 7), (28, 2), (28, 8)]:
        m[r][c] = R
    # Ensure portal areas and scroll are clear
    for r in range(10, 20):
        m[r][0] = G; m[r][1] = G
    for c in range(15, 25):
        m[0][c] = G; m[1][c] = G
    m[10][20] = G
    return m


def _make_village_map() -> list[list[int]]:
    m = [[G] * 40 for _ in range(30)]
    # Portal south: cols 15-24, rows 28-29 must stay passable
    # Portal east: cols 38-39, rows 10-19 must stay passable
    # Mirror at tile (25,15) must stay passable
    # Buildings in settlement blocks
    _fill_rect(m, 2, 2, 9, 7, B)    # building NW
    _fill_rect(m, 14, 2, 22, 7, B)  # building N-mid
    _fill_rect(m, 28, 2, 36, 8, B)  # building NE
    _fill_rect(m, 2, 10, 9, 16, B)  # building W-mid
    _fill_rect(m, 2, 20, 9, 26, B)  # building SW
    _fill_rect(m, 14, 18, 22, 25, B)  # building S-mid
    _fill_rect(m, 28, 12, 35, 19, B)  # building E-mid (leave col 38-39 clear)
    _fill_rect(m, 28, 22, 35, 28, B)  # building SE
    # Trees as border dressing (top/bottom edges outside buildings)
    for c in range(0, 40):
        m[0][c] = W
        m[29][c] = W
    for r in range(0, 30):
        m[r][39] = G  # keep east col passable for portal
    # Ensure portal areas and mirror clear
    for c in range(15, 25):
        m[28][c] = G; m[29][c] = G
    for r in range(10, 20):
        m[r][38] = G; m[r][39] = G
    m[15][25] = G
    return m


def _make_temple_map() -> list[list[int]]:
    m = [[G] * 40 for _ in range(30)]
    # Portal west: cols 0-1, rows 10-19 must stay passable
    # Buddha at tile (30,20) must stay passable
    # Outer compound wall
    for c in range(3, 38):
        m[2][c] = W; m[27][c] = W
    for r in range(2, 28):
        m[r][3] = W; m[r][37] = W
    # Gate opening on west wall at rows 13-16 (approach path from portal)
    for r in range(13, 17):
        m[r][3] = G
    # Inner wall ring
    for c in range(8, 33):
        m[6][c] = W; m[23][c] = W
    for r in range(6, 24):
        m[r][8] = W; m[r][32] = W
    # Inner gate west at rows 13-16
    for r in range(13, 17):
        m[r][8] = G
    # Inner gate east at rows 13-16
    for r in range(13, 17):
        m[r][32] = G
    # Central shrine building
    _fill_rect(m, 14, 9, 28, 21, B)
    # Approach path through central building (gap for player to walk around)
    # North/south gaps to inner courtyard
    for c in range(9, 33):
        m[8][c] = G   # north inner corridor
        m[21][c] = G  # south inner corridor (rows 21-22 open)
    # Re-apply central building (rows 10-20, cols 15-27)
    _fill_rect(m, 15, 10, 27, 20, B)
    # Rocks as decoration inside compound
    for (r, c) in [(8, 12), (8, 28), (21, 12), (21, 28)]:
        m[r][c] = R
    # Ensure portal cols 0-1 rows 10-19 passable
    for r in range(10, 20):
        m[r][0] = G; m[r][1] = G
    # Ensure buddha at (30,20) is passable
    m[20][30] = G
    return m


def _fill_rect(m: list[list[int]], c1: int, r1: int, c2: int, r2: int, tile: int) -> None:
    for r in range(r1, r2 + 1):
        for c in range(c1, c2 + 1):
            m[r][c] = tile


def build_world() -> tuple[dict, dict, dict]:
    zones: dict[str, Zone] = {}
    npcs: dict[str, NPC] = {}
    items: dict[str, Item] = {}

    zones["bridge"] = Zone(
        id="bridge", name="Near the Bridge",
        tile_map=_make_bridge_map(),
        portals=[Portal(rect=(38, 10, 2, 10), target_zone_id="gardens", target_position=(64.0, 300.0))],
    )
    zones["gardens"] = Zone(
        id="gardens", name="Gardens of Life",
        tile_map=_make_gardens_map(),
        portals=[
            Portal(rect=(0, 10, 2, 10), target_zone_id="bridge",  target_position=(1184.0, 300.0)),
            Portal(rect=(15, 0, 10, 2), target_zone_id="village", target_position=(300.0, 880.0)),
        ],
        item_ids=["scroll"],
    )
    zones["village"] = Zone(
        id="village", name="The Village",
        tile_map=_make_village_map(),
        portals=[
            Portal(rect=(15, 28, 10, 2), target_zone_id="gardens", target_position=(300.0, 64.0)),
            Portal(rect=(38, 10, 2, 10), target_zone_id="temple",  target_position=(64.0, 300.0)),
        ],
        item_ids=["mirror"],
    )
    zones["temple"] = Zone(
        id="temple", name="The Temple",
        tile_map=_make_temple_map(),
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
        NpcClass.LORD:    ["Lord Ishido", "Lord Oda", "Lord Mori", "Lord Toranaga"],
    }
    counters: dict[NpcClass, int] = {}

    # Specific NPCs that will be rivals or unreliable
    # lord_0 = first lord (village) becomes rival Shogun candidate
    # bandit_0, bandit_1 = unreliable (betray risk)
    rival_ids = {"lord_0"}
    unreliable_ids = {"bandit_0", "bandit_1"}

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
                    rival_candidate=(npc_id in rival_ids),
                    is_unreliable=(npc_id in unreliable_ids),
                )
                npcs[npc_id] = npc
                zone.npc_ids.append(npc_id)
