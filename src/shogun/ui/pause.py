from __future__ import annotations
import pygame
from shogun.core.constants import SCREEN_W, SCREEN_H, COLOR_BG, COLOR_BORDER, COLOR_TEXT

C_PANEL = (35, 35, 55)
C_HIGHLIGHT = (220, 180, 40)


class PauseMenu:
    def draw(self, surface: pygame.Surface, font_lg: pygame.font.Font, font_sm: pygame.font.Font) -> None:
        overlay = pygame.Surface((SCREEN_W, SCREEN_H), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 140))
        surface.blit(overlay, (0, 0))

        pw, ph = 360, 180
        px = SCREEN_W // 2 - pw // 2
        py = SCREEN_H // 2 - ph // 2
        pygame.draw.rect(surface, C_PANEL, (px, py, pw, ph), border_radius=8)
        pygame.draw.rect(surface, COLOR_BORDER, (px, py, pw, ph), 2, border_radius=8)

        heading = font_lg.render("PAUSED", True, C_HIGHLIGHT)
        surface.blit(heading, (px + pw // 2 - heading.get_width() // 2, py + 24))

        pygame.draw.line(surface, COLOR_BORDER, (px + 20, py + 60), (px + pw - 20, py + 60), 1)

        for i, line in enumerate(["Resume  ( ESC or ENTER )", "Quit    ( Q )"]):
            color = COLOR_TEXT if i == 0 else (180, 100, 100)
            s = font_sm.render(line, True, color)
            surface.blit(s, (px + pw // 2 - s.get_width() // 2, py + 80 + i * 36))
