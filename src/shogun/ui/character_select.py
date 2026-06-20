from __future__ import annotations
import pygame
from shogun.core.constants import (
    SCREEN_W, SCREEN_H, COLOR_BG, COLOR_BORDER, COLOR_TEXT, FPS,
    CHARACTER_STARTS,
)

C_PANEL = (30, 30, 55)
C_SELECTED = (60, 100, 180)
C_GOLD = (220, 180, 40)
C_DIM = (100, 100, 120)
C_STAT = (160, 220, 160)


class CharacterSelectScreen:
    """Screen shown after title where the player picks their starting character."""

    def __init__(self, screen: pygame.Surface) -> None:
        self.screen = screen
        self.font_title = pygame.font.SysFont("monospace", 48, bold=True)
        self.font_name  = pygame.font.SysFont("monospace", 26, bold=True)
        self.font_stat  = pygame.font.SysFont("monospace", 15)
        self.font_hint  = pygame.font.SysFont("monospace", 16)
        self._chars = list(CHARACTER_STARTS.keys())
        self._idx = 0
        self._tick = 0

    def run(self, clock: pygame.time.Clock) -> str | None:
        """Block until player selects a character. Returns character key or None on quit."""
        while True:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    return None
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        return None
                    if event.key in (pygame.K_LEFT, pygame.K_a):
                        self._idx = (self._idx - 1) % len(self._chars)
                    if event.key in (pygame.K_RIGHT, pygame.K_d):
                        self._idx = (self._idx + 1) % len(self._chars)
                    if event.key == pygame.K_RETURN:
                        return self._chars[self._idx]

            self._draw()
            self._tick += 1
            clock.tick(FPS)

    def _draw(self) -> None:
        self.screen.fill(COLOR_BG)
        pygame.draw.rect(self.screen, COLOR_BORDER, (16, 16, SCREEN_W - 32, SCREEN_H - 32), 2)

        # Title
        title = self.font_title.render("CHOOSE YOUR PATH", True, C_GOLD)
        self.screen.blit(title, (SCREEN_W // 2 - title.get_width() // 2, 60))
        pygame.draw.line(self.screen, COLOR_BORDER,
                         (SCREEN_W // 2 - 280, 130), (SCREEN_W // 2 + 280, 130), 1)

        card_w = 240
        card_h = 420
        gap = 40
        total_w = len(self._chars) * card_w + (len(self._chars) - 1) * gap
        start_x = SCREEN_W // 2 - total_w // 2

        for i, key in enumerate(self._chars):
            cfg = CHARACTER_STARTS[key]
            x = start_x + i * (card_w + gap)
            y = 160
            selected = i == self._idx

            # card background
            border_col = C_SELECTED if selected else COLOR_BORDER
            bg_col = (45, 55, 90) if selected else C_PANEL
            pygame.draw.rect(self.screen, bg_col, (x, y, card_w, card_h), border_radius=8)
            pygame.draw.rect(self.screen, border_col, (x, y, card_w, card_h), 3 if selected else 1,
                             border_radius=8)

            # class name
            name_col = C_GOLD if selected else COLOR_TEXT
            name_surf = self.font_name.render(key.upper(), True, name_col)
            self.screen.blit(name_surf, (x + card_w // 2 - name_surf.get_width() // 2, y + 18))

            # divider
            pygame.draw.line(self.screen, border_col, (x + 16, y + 56), (x + card_w - 16, y + 56), 1)

            # stats
            stats = [
                ("Yen",        f"{cfg['yen']}"),
                ("Energy",     f"{int(cfg['energy'])}"),
                ("Followers",  f"{cfg['bonus_followers']}"),
            ]
            sy = y + 72
            for label, val in stats:
                l_surf = self.font_stat.render(f"{label}:", True, C_DIM)
                v_surf = self.font_stat.render(val, True, C_STAT)
                self.screen.blit(l_surf, (x + 20, sy))
                self.screen.blit(v_surf, (x + card_w - v_surf.get_width() - 20, sy))
                sy += 26

            # divider
            pygame.draw.line(self.screen, border_col, (x + 16, sy + 4), (x + card_w - 16, sy + 4), 1)
            sy += 16

            # description (word-wrap to fit card_w - 40)
            desc: str = cfg["desc"]
            words = desc.split()
            lines: list[str] = []
            line = ""
            for word in words:
                test = (line + " " + word).strip()
                if self.font_stat.size(test)[0] <= card_w - 40:
                    line = test
                else:
                    if line:
                        lines.append(line)
                    line = word
            if line:
                lines.append(line)

            for dl in lines:
                ds = self.font_stat.render(dl, True, COLOR_TEXT if selected else C_DIM)
                self.screen.blit(ds, (x + 20, sy))
                sy += 20

            # selection arrow
            if selected and (self._tick // 20) % 2 == 0:
                arrow = self.font_name.render("▼", True, C_GOLD)
                self.screen.blit(arrow, (x + card_w // 2 - arrow.get_width() // 2, y + card_h + 8))

        # Hint
        hint = self.font_hint.render("← →  Navigate      ENTER  Confirm      ESC  Back", True, C_DIM)
        self.screen.blit(hint, (SCREEN_W // 2 - hint.get_width() // 2, SCREEN_H - 60))

        pygame.display.flip()
