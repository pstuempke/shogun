from __future__ import annotations
import pygame
from shogun.core.constants import SCREEN_W, SCREEN_H, COLOR_BG, COLOR_BORDER, COLOR_TEXT


class TitleScreen:
    def __init__(self, screen: pygame.Surface) -> None:
        self.screen = screen
        self.font_title = pygame.font.SysFont("monospace", 72, bold=True)
        self.font_sub   = pygame.font.SysFont("monospace", 24, bold=True)
        self.font_body  = pygame.font.SysFont("monospace", 16)
        self.font_flash = pygame.font.SysFont("monospace", 20, bold=True)
        self._tick = 0

    def run(self, clock: pygame.time.Clock, fps: int) -> bool:
        """Block until player presses ENTER (returns True) or quits (returns False)."""
        while True:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    return False
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        return False
                    if event.key == pygame.K_RETURN:
                        return True

            self._draw()
            self._tick += 1
            clock.tick(fps)

    def _draw(self) -> None:
        self.screen.fill(COLOR_BG)

        # outer border
        pygame.draw.rect(self.screen, COLOR_BORDER, (16, 16, SCREEN_W - 32, SCREEN_H - 32), 3)
        pygame.draw.rect(self.screen, COLOR_BORDER, (24, 24, SCREEN_W - 48, SCREEN_H - 48), 1)

        # title
        title = self.font_title.render("SHOGUN", True, (220, 180, 40))
        self.screen.blit(title, (SCREEN_W // 2 - title.get_width() // 2, 120))

        # subtitle
        sub = self.font_sub.render("Become the Shogun of Japan", True, (180, 160, 100))
        self.screen.blit(sub, (SCREEN_W // 2 - sub.get_width() // 2, 220))

        # divider
        pygame.draw.line(self.screen, COLOR_BORDER,
                         (SCREEN_W // 2 - 200, 270), (SCREEN_W // 2 + 200, 270), 1)

        # how-to-play
        lines = [
            "Your goal: gain 20 followers and hold the Mirror, Scroll & Buddha.",
            "",
            "H  — Befriend an adjacent NPC (they must be weakened or bribed)",
            "A  — Attack an adjacent NPC; flee to let their energy drain faster",
            "B  — Bribe an NPC with yen to make them willing",
            "",
            "After befriending, assign orders: followers will befriend others",
            "on your behalf, growing your chain while you move to the next zone.",
            "",
            "Dead warriors reincarnate — sometimes at a higher class.",
            "Collect all three sacred items before claiming the throne.",
        ]
        y = 300
        for line in lines:
            color = (140, 140, 160) if line.startswith(" ") or line == "" else COLOR_TEXT
            surf = self.font_body.render(line, True, color)
            self.screen.blit(surf, (SCREEN_W // 2 - surf.get_width() // 2, y))
            y += 22

        # flashing prompt
        if (self._tick // 30) % 2 == 0:
            prompt = self.font_flash.render("Press ENTER to begin", True, (220, 180, 40))
            self.screen.blit(prompt, (SCREEN_W // 2 - prompt.get_width() // 2, SCREEN_H - 80))

        pygame.display.flip()
