from __future__ import annotations
import pygame
from shogun.core.models import Zone, GameState
from shogun.core.constants import TILE_SIZE, SCREEN_W, COLOR_BORDER, NPC_CLASS_COLORS
from shogun.ui.sprites import Camera

_MINI_TILE = 3          # px per tile on minimap
_MINI_W = 40 * _MINI_TILE   # 120
_MINI_H = 30 * _MINI_TILE   # 90
_MINI_X = SCREEN_W - _MINI_W - 8
_MINI_Y = 8

TILE_COLORS = {
    0: (60, 100, 50),    # grass/floor
    1: (80, 60, 40),     # wall/tree
    2: (40, 80, 140),    # water
    3: (100, 80, 60),    # building
    4: (160, 130, 80),   # bridge plank
    5: (100, 100, 100),  # rock
}
TILE_DEFAULT = (50, 50, 50)

ITEM_COLORS = {
    "mirror": (180, 220, 255),
    "scroll": (255, 220, 140),
    "buddha": (255, 180, 60),
}


def draw_zone(surface: pygame.Surface, state: GameState, camera: Camera) -> None:
    zone = state.current_zone
    _draw_tiles(surface, zone, camera)
    _draw_items(surface, state, camera)


def _draw_tiles(surface: pygame.Surface, zone: Zone, camera: Camera) -> None:
    tile_map = zone.tile_map
    rows = len(tile_map)
    cols = len(tile_map[0]) if rows else 0

    # only draw visible tiles
    cam_col_start = max(0, int(camera.x // TILE_SIZE))
    cam_row_start = max(0, int(camera.y // TILE_SIZE))
    cam_col_end = min(cols, cam_col_start + surface.get_width() // TILE_SIZE + 2)
    cam_row_end = min(rows, cam_row_start + surface.get_height() // TILE_SIZE + 2)

    for row in range(cam_row_start, cam_row_end):
        for col in range(cam_col_start, cam_col_end):
            tile_id = tile_map[row][col]
            color = TILE_COLORS.get(tile_id, TILE_DEFAULT)
            sx = col * TILE_SIZE - int(camera.x)
            sy = row * TILE_SIZE - int(camera.y)
            pygame.draw.rect(surface, color, (sx, sy, TILE_SIZE, TILE_SIZE))
            # subtle grid line
            pygame.draw.rect(surface, (0, 0, 0, 40), (sx, sy, TILE_SIZE, TILE_SIZE), 1)

    # draw portal hints
    for portal in zone.portals:
        tx, ty, tw, th = portal.rect
        sx = tx * TILE_SIZE - int(camera.x)
        sy = ty * TILE_SIZE - int(camera.y)
        # semi-transparent overlay hint
        overlay = pygame.Surface((tw * TILE_SIZE, th * TILE_SIZE), pygame.SRCALPHA)
        overlay.fill((255, 255, 100, 60))
        surface.blit(overlay, (sx, sy))
        pygame.draw.rect(surface, (255, 255, 100), (sx, sy, tw * TILE_SIZE, th * TILE_SIZE), 2)


def draw_minimap(surface: pygame.Surface, state: GameState, camera: Camera) -> None:
    zone = state.current_zone
    tile_map = zone.tile_map
    rows = len(tile_map)
    cols = len(tile_map[0]) if rows else 0

    mini = pygame.Surface((_MINI_W, _MINI_H))
    for r in range(rows):
        for c in range(cols):
            color = TILE_COLORS.get(tile_map[r][c], TILE_DEFAULT)
            pygame.draw.rect(mini, color, (c * _MINI_TILE, r * _MINI_TILE, _MINI_TILE, _MINI_TILE))

    zone_w = cols * TILE_SIZE
    zone_h = rows * TILE_SIZE

    for nid in zone.npc_ids:
        npc = state.npcs.get(nid)
        if npc is None:
            continue
        mx = int(npc.position[0] / zone_w * _MINI_W)
        my = int(npc.position[1] / zone_h * _MINI_H)
        if npc.is_dead:
            dot_color = (100, 20, 20)
        else:
            dot_color = NPC_CLASS_COLORS.get(npc.npc_class, (180, 180, 180))
        pygame.draw.circle(mini, dot_color, (mx, my), 2)
        if npc.is_follower:
            pygame.draw.circle(mini, (80, 220, 80), (mx, my), 3, 1)

    px, py = state.player.position
    pmx = int(px / zone_w * _MINI_W)
    pmy = int(py / zone_h * _MINI_H)
    pygame.draw.circle(mini, (255, 255, 255), (pmx, pmy), 2)

    surface.blit(mini, (_MINI_X, _MINI_Y))
    pygame.draw.rect(surface, COLOR_BORDER, (_MINI_X - 1, _MINI_Y - 1, _MINI_W + 2, _MINI_H + 2), 1)


def _draw_items(surface: pygame.Surface, state: GameState, camera: Camera) -> None:
    for item_name in state.current_zone.item_ids:
        item = state.items.get(item_name)
        if item is None or item.holder_id is not None:
            continue
        sx, sy = camera.world_to_screen(*item.position)
        color = ITEM_COLORS.get(item.name, (200, 200, 200))
        pygame.draw.rect(surface, color, (sx - 10, sy - 10, 20, 20), border_radius=4)
        pygame.draw.rect(surface, (255, 255, 255), (sx - 10, sy - 10, 20, 20), width=2, border_radius=4)
