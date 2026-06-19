from __future__ import annotations
import pygame
from shogun.core.models import GameState
from shogun.core.constants import SCREEN_W, SCREEN_H, COLOR_BG, COLOR_BORDER, COLOR_TEXT, FPS

C_WIN  = (220, 180, 40)
C_LOSS = (200, 60, 60)
C_PANEL = (30, 30, 50)


class EndScreen:
    def run(self, screen: pygame.Surface, clock: pygame.time.Clock, state: GameState) -> bool:
        """Show end screen. Returns True to play again, False to quit."""
        font_title = pygame.font.SysFont("monospace", 52, bold=True)
        font_lg    = pygame.font.SysFont("monospace", 20, bold=True)
        font_sm    = pygame.font.SysFont("monospace", 15)
        tick = 0

        won = state.game_phase == "won"
        heading = "YOU ARE SHOGUN!" if won else "YOU HAVE FALLEN..."
        color   = C_WIN if won else C_LOSS

        stats = [
            f"Followers gained : {len(state.player.follower_ids)}",
            f"Sacred items     : {', '.join(state.player.sacred_items) or 'none'}",
            f"Yen remaining    : {state.player.yen}",
            f"Time survived    : {state.elapsed_ticks // FPS}s  ({state.elapsed_ticks} ticks)",
        ]

        while True:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    return False
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_RETURN:
                        return True
                    if event.key == pygame.K_q or event.key == pygame.K_ESCAPE:
                        return False

            screen.fill(COLOR_BG)
            pygame.draw.rect(screen, COLOR_BORDER, (16, 16, SCREEN_W - 32, SCREEN_H - 32), 2)

            # heading
            h = font_title.render(heading, True, color)
            screen.blit(h, (SCREEN_W // 2 - h.get_width() // 2, 140))

            # divider
            pygame.draw.line(screen, COLOR_BORDER,
                             (SCREEN_W // 2 - 220, 220), (SCREEN_W // 2 + 220, 220), 1)

            # stats panel
            pw, ph = 500, len(stats) * 38 + 40
            px = SCREEN_W // 2 - pw // 2
            py = 250
            pygame.draw.rect(screen, C_PANEL, (px, py, pw, ph), border_radius=6)
            pygame.draw.rect(screen, COLOR_BORDER, (px, py, pw, ph), 1, border_radius=6)

            lbl = font_lg.render("Final Stats", True, COLOR_BORDER)
            screen.blit(lbl, (px + pw // 2 - lbl.get_width() // 2, py + 10))
            for i, line in enumerate(stats):
                s = font_sm.render(line, True, COLOR_TEXT)
                screen.blit(s, (px + 30, py + 40 + i * 38))

            # prompt (flashing)
            if (tick // 30) % 2 == 0:
                p1 = font_lg.render("Play Again  ( ENTER )", True, C_WIN)
                screen.blit(p1, (SCREEN_W // 2 - p1.get_width() // 2, SCREEN_H - 140))
            p2 = font_sm.render("Quit  ( Q )", True, (160, 100, 100))
            screen.blit(p2, (SCREEN_W // 2 - p2.get_width() // 2, SCREEN_H - 100))

            pygame.display.flip()
            clock.tick(FPS)
            tick += 1
