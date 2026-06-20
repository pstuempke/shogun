from __future__ import annotations
import math
import pygame
from shogun.core.models import Zone, GameState
from shogun.core.constants import TILE_SIZE, SCREEN_W, COLOR_BORDER, NPC_CLASS_COLORS
from shogun.ui.sprites import Camera

_MINI_TILE = 3
_MINI_W = 40 * _MINI_TILE   # 120
_MINI_H = 30 * _MINI_TILE   # 90
_MINI_X = SCREEN_W - _MINI_W - 8
_MINI_Y = 8

TILE_COLORS = {
    0: (55, 95, 45),    # grass
    1: (75, 55, 35),    # wall/tree
    2: (35, 75, 130),   # water
    3: (95, 75, 55),    # building
    4: (150, 120, 70),  # bridge plank
    5: (90, 90, 90),    # rock
}
TILE_DEFAULT = (45, 45, 45)

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

    cam_col_start = max(0, int(camera.x // TILE_SIZE))
    cam_row_start = max(0, int(camera.y // TILE_SIZE))
    cam_col_end = min(cols, cam_col_start + surface.get_width() // TILE_SIZE + 2)
    cam_row_end = min(rows, cam_row_start + surface.get_height() // TILE_SIZE + 2)

    t = pygame.time.get_ticks()

    for row in range(cam_row_start, cam_row_end):
        for col in range(cam_col_start, cam_col_end):
            tile_id = tile_map[row][col]
            color = TILE_COLORS.get(tile_id, TILE_DEFAULT)
            sx = col * TILE_SIZE - int(camera.x)
            sy = row * TILE_SIZE - int(camera.y)

            pygame.draw.rect(surface, color, (sx, sy, TILE_SIZE, TILE_SIZE))
            _draw_tile_detail(surface, tile_id, sx, sy, row, col, t)

            # subtle grid line only on passable tiles
            if tile_id in (0, 4):
                pygame.draw.rect(surface, (0, 0, 0), (sx, sy, TILE_SIZE, TILE_SIZE), 1)

    # Portal hints with animated glow
    for portal in zone.portals:
        tx, ty, tw, th = portal.rect
        sx = tx * TILE_SIZE - int(camera.x)
        sy = ty * TILE_SIZE - int(camera.y)
        pw = tw * TILE_SIZE
        ph = th * TILE_SIZE

        pulse = 0.5 + 0.5 * math.sin(t / 450.0)
        alpha = int(35 + 40 * pulse)
        overlay = pygame.Surface((pw, ph), pygame.SRCALPHA)
        overlay.fill((255, 255, 100, alpha))
        surface.blit(overlay, (sx, sy))

        brightness = int(170 + 85 * pulse)
        pygame.draw.rect(surface, (brightness, brightness, 50),
                         (sx, sy, pw, ph), 2)

        # Corner sparkles
        sparkle_r = max(1, int(2 + 2 * pulse))
        for cx2, cy2 in [(sx, sy), (sx + pw, sy), (sx, sy + ph), (sx + pw, sy + ph)]:
            pygame.draw.circle(surface, (255, 255, 160), (cx2, cy2), sparkle_r)


def _draw_tile_detail(surface: pygame.Surface, tile_id: int, sx: int, sy: int,
                      row: int, col: int, t: int) -> None:
    seed = (row * 13 + col * 7)

    if tile_id == 0:  # grass
        # Highlight top strip
        pygame.draw.rect(surface, (65, 110, 55), (sx, sy, TILE_SIZE, 4))
        # Occasional grass tufts
        if seed % 3 == 0:
            tx = sx + 4 + (seed * 3) % 20
            ty = sy + 6 + (seed * 5) % 16
            pygame.draw.line(surface, (40, 75, 30), (tx, ty + 4), (tx - 2, ty), 1)
            pygame.draw.line(surface, (40, 75, 30), (tx, ty + 4), (tx + 2, ty), 1)
        if seed % 5 == 1:
            tx2 = sx + 14 + (seed * 7) % 12
            ty2 = sy + 10 + (seed * 11) % 14
            pygame.draw.line(surface, (40, 75, 30), (tx2, ty2 + 4), (tx2 - 2, ty2), 1)
            pygame.draw.line(surface, (40, 75, 30), (tx2, ty2 + 4), (tx2 + 2, ty2), 1)

    elif tile_id == 1:  # wall/tree
        # Bark texture: vertical streaks
        pygame.draw.rect(surface, (60, 42, 24), (sx, sy + TILE_SIZE - 6, TILE_SIZE, 6))
        pygame.draw.rect(surface, (95, 72, 50), (sx, sy, TILE_SIZE, 5))
        for i in range(3):
            lx = sx + 4 + i * 10 + (seed + i) % 5
            pygame.draw.line(surface, (60, 45, 28),
                             (lx, sy + 6), (lx, sy + TILE_SIZE - 7), 1)
        # Foliage hint at top
        pygame.draw.rect(surface, (50, 80, 30), (sx + 2, sy, TILE_SIZE - 4, 8), border_radius=3)

    elif tile_id == 2:  # water
        # Animated ripple lines
        wave_phase = (t // 150 + col) % 6
        for i in range(3):
            wy = sy + 5 + i * 9 + wave_phase
            if sy <= wy < sy + TILE_SIZE:
                pygame.draw.line(surface, (50, 100, 175), (sx + 2, wy), (sx + TILE_SIZE - 4, wy), 1)
        # Sparkle
        if (t // 400 + seed) % 7 == 0:
            spx = sx + 6 + (seed * 3) % 18
            spy = sy + 4 + (seed * 7) % 20
            pygame.draw.circle(surface, (120, 180, 240), (spx, spy), 1)

    elif tile_id == 3:  # building
        # Wood grain horizontal lines
        pygame.draw.rect(surface, (115, 92, 68), (sx, sy, TILE_SIZE, 3))
        pygame.draw.rect(surface, (70, 55, 38), (sx, sy + TILE_SIZE - 4, TILE_SIZE, 4))
        for i in range(2):
            gy = sy + 9 + i * 9
            pygame.draw.line(surface, (80, 62, 44), (sx + 1, gy), (sx + TILE_SIZE - 2, gy), 1)

    elif tile_id == 4:  # bridge plank
        # Plank gaps (horizontal)
        for i in range(3):
            py2 = sy + 8 + i * 8
            pygame.draw.line(surface, (110, 85, 45), (sx + 1, py2), (sx + TILE_SIZE - 2, py2), 1)
        # Plank highlight
        pygame.draw.rect(surface, (170, 140, 85), (sx, sy, TILE_SIZE, 3))
        # Nail dots
        for nx in (sx + 5, sx + TILE_SIZE - 6):
            for i in range(3):
                ny = sy + 4 + i * 8
                pygame.draw.rect(surface, (100, 80, 50), (nx, ny, 2, 2))

    elif tile_id == 5:  # rock
        # Facet highlight top-left
        pygame.draw.rect(surface, (120, 120, 120), (sx, sy, TILE_SIZE, 4))
        pygame.draw.rect(surface, (65, 65, 65), (sx, sy + TILE_SIZE - 5, TILE_SIZE, 5))
        # Crack line
        mx = sx + 8 + (seed % 12)
        pygame.draw.line(surface, (60, 60, 60), (mx, sy + 8), (mx + 4, sy + TILE_SIZE - 8), 1)


def draw_minimap(surface: pygame.Surface, state: GameState, camera: Camera) -> None:
    zone = state.current_zone
    tile_map = zone.tile_map
    rows = len(tile_map)
    cols = len(tile_map[0]) if rows else 0

    mini = pygame.Surface((_MINI_W, _MINI_H))
    mini.fill((10, 10, 20))

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
            dot_color = (80, 15, 15)
        else:
            dot_color = NPC_CLASS_COLORS.get(npc.npc_class, (160, 160, 160))
        pygame.draw.circle(mini, dot_color, (mx, my), 2)
        if npc.is_follower:
            pygame.draw.circle(mini, (60, 210, 60), (mx, my), 3, 1)

    px, py = state.player.position
    pmx = int(px / zone_w * _MINI_W)
    pmy = int(py / zone_h * _MINI_H)
    pygame.draw.circle(mini, (255, 255, 255), (pmx, pmy), 2)

    # Minimap frame with inner vignette border
    surface.blit(mini, (_MINI_X, _MINI_Y))
    pygame.draw.rect(surface, (160, 130, 50), (_MINI_X - 2, _MINI_Y - 2, _MINI_W + 4, _MINI_H + 4), 2)
    pygame.draw.rect(surface, (80, 65, 25), (_MINI_X - 1, _MINI_Y - 1, _MINI_W + 2, _MINI_H + 2), 1)


def _draw_items(surface: pygame.Surface, state: GameState, camera: Camera) -> None:
    t = pygame.time.get_ticks()
    for item_name in state.current_zone.item_ids:
        item = state.items.get(item_name)
        if item is None or item.holder_id is not None:
            continue
        sx, sy = camera.world_to_screen(*item.position)

        # Float up/down
        float_dy = int(3 * math.sin(t / 600.0))
        iy = sy + float_dy

        # Glow pool on ground
        glow = pygame.Surface((24, 8), pygame.SRCALPHA)
        glow_col = ITEM_COLORS.get(item_name, (200, 200, 200))
        pygame.draw.ellipse(glow, (*glow_col, 60), (0, 0, 24, 8))
        surface.blit(glow, (sx - 12, sy + 9))

        _draw_item_icon(surface, item_name, sx, iy)


def _draw_item_icon(surface: pygame.Surface, name: str, sx: int, sy: int) -> None:
    if name == "mirror":
        # Octagonal mirror face
        r = 10
        pts = [(sx + int(r * math.cos(math.pi / 8 + i * math.pi / 4)),
                sy + int(r * math.sin(math.pi / 8 + i * math.pi / 4))) for i in range(8)]
        pygame.draw.polygon(surface, (160, 210, 250), pts)
        pygame.draw.polygon(surface, (210, 240, 255), pts, 2)
        # Reflection cross
        pygame.draw.line(surface, (230, 248, 255), (sx - 5, sy), (sx + 5, sy), 1)
        pygame.draw.line(surface, (230, 248, 255), (sx, sy - 5), (sx, sy + 5), 1)

    elif name == "scroll":
        # Scroll body
        pygame.draw.rect(surface, (240, 210, 130), (sx - 8, sy - 4, 16, 8))
        # End caps
        pygame.draw.circle(surface, (185, 155, 90), (sx - 8, sy), 4)
        pygame.draw.circle(surface, (185, 155, 90), (sx + 8, sy), 4)
        pygame.draw.circle(surface, (210, 180, 110), (sx - 8, sy), 3)
        pygame.draw.circle(surface, (210, 180, 110), (sx + 8, sy), 3)
        # Text lines
        for dy in (-2, 1):
            pygame.draw.line(surface, (160, 130, 75), (sx - 5, sy + dy), (sx + 5, sy + dy), 1)

    elif name == "buddha":
        # Seated body
        pygame.draw.ellipse(surface, (245, 170, 50), (sx - 7, sy - 1, 14, 10))
        # Head
        pygame.draw.circle(surface, (245, 170, 50), (sx, sy - 6), 5)
        # Halo ring
        pygame.draw.circle(surface, (255, 215, 90), (sx, sy - 6), 7, 1)
        # Ushnisha
        pygame.draw.circle(surface, (215, 145, 35), (sx, sy - 11), 2)
