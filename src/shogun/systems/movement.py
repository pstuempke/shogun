from __future__ import annotations
import random
import pygame
from shogun.core.models import GameState, Player, NPC, Zone
from shogun.core.constants import (
    PLAYER_SPEED, TILE_SIZE, PASSABLE_TILES, SCREEN_W, SCREEN_H, HUD_H,
    ENERGY_MAX, ENERGY_REGEN_RATE,
)

PLAYFIELD_H = SCREEN_H - HUD_H


def _is_passable(zone: Zone, px: float, py: float) -> bool:
    col = int(px // TILE_SIZE)
    row = int(py // TILE_SIZE)
    if row < 0 or col < 0 or row >= len(zone.tile_map) or col >= len(zone.tile_map[0]):
        return False
    return zone.tile_map[row][col] in PASSABLE_TILES


def move_player(state: GameState, keys: pygame.key.ScancodeWrapper) -> None:
    player = state.player
    zone = state.current_zone
    x, y = player.position
    dx = dy = 0.0

    if keys[pygame.K_LEFT] or keys[pygame.K_a]:
        dx -= PLAYER_SPEED
    if keys[pygame.K_RIGHT] or keys[pygame.K_d]:
        dx += PLAYER_SPEED
    if keys[pygame.K_UP] or keys[pygame.K_w]:
        dy -= PLAYER_SPEED
    if keys[pygame.K_DOWN] or keys[pygame.K_s]:
        dy += PLAYER_SPEED

    # normalise diagonal
    if dx != 0 and dy != 0:
        dx *= 0.707
        dy *= 0.707

    new_x = x + dx
    new_y = y + dy

    # clamp to playfield bounds (a half-tile margin)
    half = TILE_SIZE // 2
    new_x = max(half, min(new_x, len(zone.tile_map[0]) * TILE_SIZE - half))
    new_y = max(half, min(new_y, len(zone.tile_map) * TILE_SIZE - half))

    if _is_passable(zone, new_x, y):
        x = new_x
    if _is_passable(zone, x, new_y):
        y = new_y

    player.position = (x, y)

    if player.combat_target is None and player.energy < ENERGY_MAX:
        player.energy = min(ENERGY_MAX, player.energy + ENERGY_REGEN_RATE)

    # check portal overlap
    _check_portals(state)


def _check_portals(state: GameState) -> None:
    player = state.player
    zone = state.current_zone
    px, py = player.position
    player_rect = pygame.Rect(int(px) - 8, int(py) - 8, 16, 16)

    for portal in zone.portals:
        tx, ty, tw, th = portal.rect
        portal_rect = pygame.Rect(tx * TILE_SIZE, ty * TILE_SIZE, tw * TILE_SIZE, th * TILE_SIZE)
        if player_rect.colliderect(portal_rect):
            # clear combat targets in old zone
            for nid in zone.npc_ids:
                npc = state.npcs.get(nid)
                if npc:
                    npc.combat_target = None
            # transition
            player.current_zone_id = portal.target_zone_id
            player.position = portal.target_position
            state.show_message(f"Entered: {state.current_zone.name}", 90)
            break


def update_npcs(state: GameState) -> None:
    zone = state.current_zone
    for nid in zone.npc_ids:
        npc = state.npcs.get(nid)
        if npc is None or npc.is_dead:
            continue
        if npc.combat_target:
            _chase(state, npc)
        elif not npc.rival_candidate:
            _wander(state, npc)


def _wander(state: GameState, npc: NPC) -> None:
    if not hasattr(npc, "_wander_dir"):
        npc._wander_dir = (0.0, 0.0)  # type: ignore[attr-defined]
        npc._wander_timer = 0  # type: ignore[attr-defined]

    npc._wander_timer -= 1  # type: ignore[attr-defined]
    if npc._wander_timer <= 0:  # type: ignore[attr-defined]
        angle_choices = [(1, 0), (-1, 0), (0, 1), (0, -1), (0, 0)]
        dx, dy = random.choice(angle_choices)
        npc._wander_dir = (dx * npc.speed * 0.5, dy * npc.speed * 0.5)  # type: ignore[attr-defined]
        npc._wander_timer = random.randint(60, 120)  # type: ignore[attr-defined]

    zone = state.current_zone
    x, y = npc.position
    dx, dy = npc._wander_dir  # type: ignore[attr-defined]
    new_x = x + dx
    new_y = y + dy
    half = TILE_SIZE // 2
    new_x = max(half, min(new_x, len(zone.tile_map[0]) * TILE_SIZE - half))
    new_y = max(half, min(new_y, len(zone.tile_map) * TILE_SIZE - half))
    if _is_passable(zone, new_x, y):
        x = new_x
    if _is_passable(zone, x, new_y):
        y = new_y
    npc.position = (x, y)


def _chase(state: GameState, npc: NPC) -> None:
    from shogun.core.constants import FLEE_DISTANCE, FLEE_SPEED_MULT
    target_id = npc.combat_target
    if target_id == "player":
        tx, ty = state.player.position
    elif target_id in state.npcs:
        tx, ty = state.npcs[target_id].position
    else:
        npc.combat_target = None
        return

    x, y = npc.position
    dx = tx - x
    dy = ty - y
    dist = (dx * dx + dy * dy) ** 0.5
    if dist == 0:
        return

    speed = npc.speed
    if dist > FLEE_DISTANCE:
        speed *= FLEE_SPEED_MULT

    step = speed / dist
    zone = state.current_zone
    new_x = x + dx * step
    new_y = y + dy * step
    half = TILE_SIZE // 2
    new_x = max(half, min(new_x, len(zone.tile_map[0]) * TILE_SIZE - half))
    new_y = max(half, min(new_y, len(zone.tile_map) * TILE_SIZE - half))
    if _is_passable(zone, new_x, y):
        x = new_x
    if _is_passable(zone, x, new_y):
        y = new_y
    npc.position = (x, y)
