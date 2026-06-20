from __future__ import annotations
import random
from shogun.core.models import GameState, NPC
from shogun.core.constants import RESPAWN_DELAY, REINCARNATION_WEIGHTS, NPC_CLASS_DATA


def begin_death(state: GameState, npc: NPC) -> None:
    npc.is_dead = True
    npc.death_tick = state.elapsed_ticks
    npc.is_follower = False
    npc.allegiance = None
    npc.orders = []
    npc.combat_target = None
    if npc.id in state.player.follower_ids:
        # Post-milestone rule: once you've held 20 followers, killing anyone doesn't
        # reduce your count — your status as Shogun-candidate is already locked in.
        if not state.player.shogun_milestone_reached:
            state.player.follower_ids.remove(npc.id)
    # drop held items
    for item in state.items.values():
        if item.holder_id == npc.id:
            item.holder_id = None
            item.zone_id = npc.zone_id
            item.position = npc.position


def update_reincarnation(state: GameState) -> None:
    for npc in state.npcs.values():
        if not npc.is_dead:
            continue
        if state.elapsed_ticks - npc.death_tick >= RESPAWN_DELAY:
            _respawn(state, npc)


def _respawn(state: GameState, npc: NPC) -> None:
    old_class_name = npc.npc_class.name
    classes, weights = zip(*REINCARNATION_WEIGHTS)
    new_class = random.choices(classes, weights=weights, k=1)[0]
    npc.apply_class(new_class)
    npc.is_dead = False
    npc.death_tick = -1
    npc.orders = []
    npc.combat_target = None
    npc.bribed_until_tick = -1

    zone = state.zones.get(npc.zone_id)
    if zone:
        zone_w = len(zone.tile_map[0]) * 32
        zone_h = len(zone.tile_map) * 32
        npc.position = (
            float(random.randint(80, zone_w - 80)),
            float(random.randint(80, zone_h - 80)),
        )
        zone_name = zone.name
    else:
        zone_name = npc.zone_id

    npc.yen = random.randint(
        NPC_CLASS_DATA[new_class]["yen_min"],
        NPC_CLASS_DATA[new_class]["yen_max"],
    )
    new_class_name = new_class.name
    if old_class_name != new_class_name:
        state.log_event(f"{npc.name} is reborn as a {new_class_name} in {zone_name}.")
    else:
        state.log_event(f"{npc.name} is reborn in {zone_name}.")
