from __future__ import annotations
import pygame
from shogun.core.models import Player, NPC
from shogun.core.constants import NPC_CLASS_COLORS, NpcClass

PLAYER_COLOR = (240, 220, 160)
PLAYER_SIZE = (18, 24)
NPC_SIZE = (16, 20)


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


def draw_player(surface: pygame.Surface, player: Player, camera: Camera) -> None:
    sx, sy = camera.world_to_screen(*player.position)
    w, h = PLAYER_SIZE
    rect = pygame.Rect(sx - w // 2, sy - h // 2, w, h)
    pygame.draw.rect(surface, PLAYER_COLOR, rect, border_radius=3)
    # outline
    pygame.draw.rect(surface, (255, 255, 255), rect, width=2, border_radius=3)


def draw_npc(surface: pygame.Surface, npc: NPC, camera: Camera, font: pygame.font.Font) -> None:
    if npc.is_dead:
        _draw_skull(surface, npc, camera)
        return

    sx, sy = camera.world_to_screen(*npc.position)
    color = NPC_CLASS_COLORS[npc.npc_class]
    w, h = NPC_SIZE
    rect = pygame.Rect(sx - w // 2, sy - h // 2, w, h)
    pygame.draw.rect(surface, color, rect, border_radius=2)

    if npc.is_follower:
        pygame.draw.rect(surface, (60, 220, 60), rect, width=2, border_radius=2)
    elif npc.combat_target:
        pygame.draw.rect(surface, (220, 60, 60), rect, width=2, border_radius=2)
    else:
        pygame.draw.rect(surface, (180, 180, 180), rect, width=1, border_radius=2)

    # energy bar above NPC
    bar_w = 24
    bar_h = 4
    bar_x = sx - bar_w // 2
    bar_y = sy - h // 2 - 8
    pygame.draw.rect(surface, (60, 60, 60), (bar_x, bar_y, bar_w, bar_h))
    fill = max(0, int(bar_w * npc.energy_pct / 100))
    bar_color = (60, 200, 60) if npc.energy_pct > 40 else (200, 60, 60)
    if fill > 0:
        pygame.draw.rect(surface, bar_color, (bar_x, bar_y, fill, bar_h))

    # name tag
    name_surf = font.render(npc.name, True, (220, 220, 200))
    surface.blit(name_surf, (sx - name_surf.get_width() // 2, bar_y - 14))


def _draw_skull(surface: pygame.Surface, npc: NPC, camera: Camera) -> None:
    sx, sy = camera.world_to_screen(*npc.position)
    pygame.draw.circle(surface, (180, 40, 40), (sx, sy), 8)
    pygame.draw.line(surface, (220, 220, 220), (sx - 4, sy - 2), (sx + 4, sy - 2), 2)
    pygame.draw.line(surface, (220, 220, 220), (sx, sy - 6), (sx, sy + 2), 2)
