from __future__ import annotations
import pygame
from shogun.core.models import GameState, NPC
from shogun.core.constants import SCREEN_W, SCREEN_H, HUD_H, TILE_SIZE, COLOR_BG
from shogun.ui.sprites import Camera, draw_player, draw_npc
from shogun.ui.zone_renderer import draw_zone
from shogun.ui.hud import draw_hud

PLAYFIELD_H = SCREEN_H - HUD_H


class Renderer:
    def __init__(self, screen: pygame.Surface) -> None:
        self.screen = screen
        self.font_lg = pygame.font.SysFont("monospace", 20, bold=True)
        self.font_sm = pygame.font.SysFont("monospace", 13)
        self.font_npc = pygame.font.SysFont("monospace", 11)
        self.playfield = pygame.Surface((SCREEN_W, PLAYFIELD_H))
        self.camera = Camera(SCREEN_W, PLAYFIELD_H)

    def draw(self, state: GameState, adjacent_npc: NPC | None = None, action_menu=None, order_screen=None) -> None:
        zone = state.current_zone
        world_w = len(zone.tile_map[0]) * TILE_SIZE
        world_h = len(zone.tile_map) * TILE_SIZE

        self.camera.update(*state.player.position, world_w, world_h)

        self.playfield.fill(COLOR_BG)
        draw_zone(self.playfield, state, self.camera)

        for nid in zone.npc_ids:
            npc = state.npcs.get(nid)
            if npc:
                draw_npc(self.playfield, npc, self.camera, self.font_npc)

        draw_player(self.playfield, state.player, self.camera)

        # action menu popup
        if action_menu and adjacent_npc and not (order_screen and order_screen.active):
            action_menu.draw(self.playfield, adjacent_npc, state, self.camera.x, self.camera.y, self.font_sm)

        self.screen.blit(self.playfield, (0, 0))
        draw_hud(self.screen, state, self.font_lg, self.font_sm)

        # order screen overlay (drawn on top of everything)
        if order_screen and order_screen.active:
            order_screen.draw(self.screen, state, self.font_lg, self.font_sm)

        # win/loss overlay
        if state.game_phase == "won":
            self._draw_overlay("YOU ARE SHOGUN!", (220, 180, 40))
        elif state.game_phase == "lost":
            self._draw_overlay("YOU HAVE FALLEN...", (200, 60, 60))

        pygame.display.flip()

    def _draw_overlay(self, text: str, color: tuple[int, int, int]) -> None:
        overlay = pygame.Surface((SCREEN_W, SCREEN_H), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 160))
        self.screen.blit(overlay, (0, 0))
        font_big = pygame.font.SysFont("monospace", 48, bold=True)
        surf = font_big.render(text, True, color)
        self.screen.blit(surf, (SCREEN_W // 2 - surf.get_width() // 2, SCREEN_H // 2 - 30))
        sub = self.font_lg.render("Press ESC to quit", True, (200, 200, 200))
        self.screen.blit(sub, (SCREEN_W // 2 - sub.get_width() // 2, SCREEN_H // 2 + 30))
