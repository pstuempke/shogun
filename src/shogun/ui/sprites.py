from __future__ import annotations
import math
import pygame
from shogun.core.models import Player, NPC
from shogun.core.constants import NPC_CLASS_COLORS, NpcClass

PLAYER_COLOR = (240, 220, 160)
PLAYER_SIZE = (18, 24)
NPC_SIZE = (16, 20)
_SKIN = (225, 190, 150)


class Camera:
    def __init__(self, screen_w: int, screen_h: int) -> None:
        self.screen_w = screen_w
        self.screen_h = screen_h
        self.x = 0.0
        self.y = 0.0

    def update(self, target_x: float, target_y: float, world_w: int, world_h: int) -> None:
        self.x = target_x - self.screen_w / 2
        self.y = target_y - self.screen_h / 2
        self.x = max(0, min(self.x, world_w - self.screen_w))
        self.y = max(0, min(self.y, world_h - self.screen_h))

    def world_to_screen(self, wx: float, wy: float) -> tuple[int, int]:
        return (int(wx - self.x), int(wy - self.y))


def _shadow(surface: pygame.Surface, cx: int, cy: int, rx: int, ry: int) -> None:
    s = pygame.Surface((rx * 2 + 2, ry * 2 + 2), pygame.SRCALPHA)
    pygame.draw.ellipse(s, (0, 0, 0, 55), (0, 0, rx * 2 + 2, ry * 2 + 2))
    surface.blit(s, (cx - rx - 1, cy - ry - 1))


def _darken(color: tuple[int, int, int], amt: int) -> tuple[int, int, int]:
    return (max(0, color[0] - amt), max(0, color[1] - amt), max(0, color[2] - amt))


def _lighten(color: tuple[int, int, int], amt: int) -> tuple[int, int, int]:
    return (min(255, color[0] + amt), min(255, color[1] + amt), min(255, color[2] + amt))


def draw_player(surface: pygame.Surface, player: Player, camera: Camera) -> None:
    sx, sy = camera.world_to_screen(*player.position)

    _shadow(surface, sx, sy + 12, 13, 4)

    # Kimono body
    body = pygame.Rect(sx - 9, sy - 3, 18, 15)
    pygame.draw.rect(surface, (190, 60, 60), body, border_radius=2)
    # Collar V-shape
    pygame.draw.line(surface, (240, 200, 160), (sx - 4, body.top + 1), (sx, body.top + 6), 2)
    pygame.draw.line(surface, (240, 200, 160), (sx + 4, body.top + 1), (sx, body.top + 6), 2)
    # Obi sash
    pygame.draw.rect(surface, (55, 25, 75), (sx - 9, sy + 5, 18, 4))
    pygame.draw.rect(surface, (80, 40, 110), (sx - 4, sy + 4, 8, 6), border_radius=1)

    # Head
    head_cy = sy - 9
    pygame.draw.circle(surface, _SKIN, (sx, head_cy), 9)
    # Topknot (chonmage)
    pygame.draw.rect(surface, (45, 30, 15), (sx - 2, head_cy - 13, 4, 9), border_radius=2)
    pygame.draw.circle(surface, (45, 30, 15), (sx, head_cy - 13), 3)

    # Outline
    pygame.draw.rect(surface, (230, 200, 150), body, 1, border_radius=2)
    pygame.draw.circle(surface, (200, 160, 120), (sx, head_cy), 9, 1)


def draw_npc(surface: pygame.Surface, npc: NPC, camera: Camera, font: pygame.font.Font) -> None:
    if npc.is_dead:
        _draw_skull(surface, npc, camera)
        return

    sx, sy = camera.world_to_screen(*npc.position)
    color = NPC_CLASS_COLORS[npc.npc_class]
    t = pygame.time.get_ticks()

    _shadow(surface, sx, sy + 11, 11, 4)
    _draw_npc_body(surface, npc, sx, sy, color, t)

    w, h = NPC_SIZE
    body_rect = pygame.Rect(sx - w // 2, sy - h // 4, w, h // 2 + 4)

    if npc.is_follower:
        pulse = 0.5 + 0.5 * math.sin(t / 250.0)
        g = int(160 + 95 * pulse)
        # Soft glow rings
        for i in range(3, 0, -1):
            gs = pygame.Surface((body_rect.w + i * 6, body_rect.h + i * 6), pygame.SRCALPHA)
            pygame.draw.rect(gs, (40, g, 40, int(18 * pulse)),
                             (0, 0, gs.get_width(), gs.get_height()), 2, border_radius=4)
            surface.blit(gs, (body_rect.x - i * 3, body_rect.y - i * 3))
        pygame.draw.rect(surface, (60, g, 60), body_rect, 2, border_radius=3)
    elif npc.combat_target:
        pygame.draw.rect(surface, (220, 50, 50), body_rect, 2, border_radius=3)
    else:
        pygame.draw.rect(surface, (140, 140, 140), body_rect, 1, border_radius=2)

    # Segmented energy bar
    bar_w, bar_h = 28, 4
    bx = sx - bar_w // 2
    by = sy - h // 2 - 10
    pygame.draw.rect(surface, (15, 15, 15), (bx - 1, by - 1, bar_w + 2, bar_h + 2))
    n_segs = 5
    seg_w = (bar_w - (n_segs - 1)) // n_segs
    filled = max(0, round(npc.energy_pct / 100 * n_segs))
    bar_color = (50, 200, 50) if npc.energy_pct > 40 else (200, 50, 50)
    shine = _lighten(bar_color, 70)
    for i in range(filled):
        x = bx + i * (seg_w + 1)
        pygame.draw.rect(surface, bar_color, (x, by, seg_w, bar_h))
        pygame.draw.line(surface, shine, (x, by), (x + seg_w - 1, by), 1)

    # Name tag with subtle backing
    name_surf = font.render(npc.name, True, (230, 225, 200))
    nw = name_surf.get_width()
    nb = pygame.Surface((nw + 4, 13), pygame.SRCALPHA)
    nb.fill((0, 0, 0, 80))
    surface.blit(nb, (sx - nw // 2 - 2, by - 13))
    surface.blit(name_surf, (sx - nw // 2, by - 12))


def _draw_npc_body(surface: pygame.Surface, npc: NPC, sx: int, sy: int,
                   color: tuple[int, int, int], t: int) -> None:
    w, h = NPC_SIZE
    cls = npc.npc_class

    body_rect = pygame.Rect(sx - w // 2, sy - h // 4, w, h // 2 + 4)
    pygame.draw.rect(surface, color, body_rect, border_radius=2)
    # Body highlight
    pygame.draw.line(surface, _lighten(color, 40), (body_rect.x + 2, body_rect.y + 2),
                     (body_rect.x + 2, body_rect.bottom - 3), 1)

    head_r = 7
    head_cy = sy - h // 4 - head_r + 1
    pygame.draw.circle(surface, color, (sx, head_cy), head_r)
    pygame.draw.circle(surface, _SKIN, (sx, head_cy), 5)

    if cls == NpcClass.BANDIT:
        # Red headband
        pygame.draw.line(surface, (180, 20, 20),
                         (sx - head_r, head_cy - 1), (sx + head_r, head_cy - 1), 3)
        # Scar
        pygame.draw.line(surface, (200, 90, 90),
                         (sx - 3, head_cy - 3), (sx + 1, head_cy + 3), 1)
        # Dark stubble hint
        pygame.draw.circle(surface, (80, 55, 40), (sx, head_cy + 2), 2)

    elif cls == NpcClass.PEASANT:
        # Straw hat triangle
        hat_pts = [
            (sx, head_cy - head_r - 9),
            (sx - 12, head_cy - head_r + 2),
            (sx + 12, head_cy - head_r + 2),
        ]
        pygame.draw.polygon(surface, (155, 135, 55), hat_pts)
        pygame.draw.polygon(surface, (110, 90, 35), hat_pts, 1)
        # Brim highlight
        pygame.draw.line(surface, (175, 155, 75), hat_pts[1], hat_pts[2], 1)

    elif cls == NpcClass.SERVANT:
        # White collar V
        pygame.draw.line(surface, (210, 210, 210),
                         (sx - 3, body_rect.top + 2), (sx, body_rect.top + 7), 2)
        pygame.draw.line(surface, (210, 210, 210),
                         (sx + 3, body_rect.top + 2), (sx, body_rect.top + 7), 2)
        # Center seam
        pygame.draw.line(surface, _lighten(color, 30),
                         (sx, body_rect.top + 3), (sx, body_rect.bottom - 2), 1)

    elif cls == NpcClass.GEISHA:
        # Flared kimono
        flare_pts = [
            (sx - w // 2 - 4, body_rect.bottom),
            (sx + w // 2 + 4, body_rect.bottom),
            (sx + w // 2, body_rect.top + 8),
            (sx - w // 2, body_rect.top + 8),
        ]
        pygame.draw.polygon(surface, color, flare_pts)
        # Kanzashi hairpin
        pygame.draw.line(surface, (230, 200, 220),
                         (sx, head_cy - head_r), (sx + 9, head_cy - head_r - 5), 1)
        pygame.draw.circle(surface, (255, 100, 160), (sx + 9, head_cy - head_r - 5), 2)
        # White face
        pygame.draw.circle(surface, (245, 235, 220), (sx, head_cy), 5)
        # Painted lips
        pygame.draw.line(surface, (200, 50, 80), (sx - 2, head_cy + 2), (sx + 2, head_cy + 2), 1)

    elif cls == NpcClass.SAMURAI:
        # Pauldrons
        for dx in (-w // 2 - 4, w // 2 - 1):
            pygame.draw.rect(surface, _darken(color, 20),
                             (sx + dx, body_rect.top, 5, 9), border_radius=1)
            pygame.draw.line(surface, _lighten(color, 20),
                             (sx + dx + 1, body_rect.top + 1),
                             (sx + dx + 1, body_rect.top + 7), 1)
        # Kabuto brow
        pygame.draw.rect(surface, _darken(color, 30),
                         (sx - 7, head_cy - head_r - 1, 14, 6), border_radius=2)
        # Crest
        pygame.draw.rect(surface, _lighten(color, 20),
                         (sx - 1, head_cy - head_r - 7, 3, 8), border_radius=1)

    elif cls == NpcClass.LORD:
        # Wider robe
        robe = pygame.Rect(sx - w // 2 - 3, body_rect.top + 2, w + 6, body_rect.h - 2)
        pygame.draw.rect(surface, color, robe, border_radius=2)
        pygame.draw.line(surface, _lighten(color, 50), (robe.x + 2, robe.y + 2),
                         (robe.x + 2, robe.bottom - 2), 1)
        # Crown (kanji-style points)
        crown_base_y = head_cy - head_r
        crown_pts = [
            (sx - 8, crown_base_y),
            (sx - 6, crown_base_y - 9),
            (sx - 3, crown_base_y - 5),
            (sx, crown_base_y - 12),
            (sx + 3, crown_base_y - 5),
            (sx + 6, crown_base_y - 9),
            (sx + 8, crown_base_y),
        ]
        pygame.draw.polygon(surface, (200, 170, 20), crown_pts)
        pygame.draw.polygon(surface, (240, 215, 60), crown_pts, 1)
        pygame.draw.circle(surface, (220, 60, 60), (sx, crown_base_y - 12), 2)


def _draw_skull(surface: pygame.Surface, npc: NPC, camera: Camera) -> None:
    sx, sy = camera.world_to_screen(*npc.position)

    # Blood pool beneath
    pool = pygame.Surface((20, 8), pygame.SRCALPHA)
    pygame.draw.ellipse(pool, (100, 10, 10, 90), (0, 0, 20, 8))
    surface.blit(pool, (sx - 10, sy + 5))

    # Skull dome
    pygame.draw.circle(surface, (195, 180, 155), (sx, sy - 2), 8)
    pygame.draw.circle(surface, (20, 10, 10), (sx, sy - 2), 8, 1)

    # Eye sockets
    pygame.draw.ellipse(surface, (20, 10, 10), (sx - 5, sy - 5, 4, 3))
    pygame.draw.ellipse(surface, (20, 10, 10), (sx + 1, sy - 5, 4, 3))

    # Nasal cavity
    pygame.draw.circle(surface, (30, 15, 15), (sx, sy - 1), 1)

    # Teeth
    pygame.draw.line(surface, (20, 10, 10), (sx - 4, sy + 3), (sx + 4, sy + 3), 1)
    for tx in (sx - 3, sx - 1, sx + 1, sx + 3):
        pygame.draw.line(surface, (195, 180, 155), (tx, sy + 3), (tx, sy + 5), 1)
