import pygame
from shogun.core.game import GameState

SCREEN_W, SCREEN_H = 1024, 768
FPS = 30

COLORS = {
    "bg": (20, 20, 40),
    "text": (220, 220, 200),
    "panel": (40, 40, 60),
    "border": (120, 100, 60),
    "players": [
        (200, 60, 60),
        (60, 120, 200),
        (60, 180, 60),
        (200, 160, 40),
        (160, 60, 200),
    ],
    "neutral": (100, 100, 100),
}


class Renderer:
    def __init__(self, screen: pygame.Surface):
        self.screen = screen
        self.font_lg = pygame.font.SysFont("monospace", 22, bold=True)
        self.font_sm = pygame.font.SysFont("monospace", 14)

    def draw(self, state: GameState):
        self.screen.fill(COLORS["bg"])
        self._draw_header(state)
        self._draw_provinces(state)
        self._draw_status(state)
        pygame.display.flip()

    def _draw_header(self, state: GameState):
        title = self.font_lg.render(
            f"SHOGUN  —  Year {state.year}  |  Turn {state.turn + 1}  |  {state.phase.upper()}",
            True, COLORS["border"],
        )
        self.screen.blit(title, (20, 14))

    def _draw_provinces(self, state: GameState):
        cols = 5
        cell_w, cell_h = 180, 60
        start_x, start_y = 20, 60

        for i, prov in enumerate(state.provinces):
            col = i % cols
            row = i // cols
            x = start_x + col * (cell_w + 8)
            y = start_y + row * (cell_h + 8)

            color = COLORS["players"][prov.owner] if prov.owner is not None else COLORS["neutral"]
            pygame.draw.rect(self.screen, COLORS["panel"], (x, y, cell_w, cell_h), border_radius=4)
            pygame.draw.rect(self.screen, color, (x, y, cell_w, cell_h), width=2, border_radius=4)

            name_surf = self.font_sm.render(prov.name, True, COLORS["text"])
            armies_surf = self.font_sm.render(f"Armies: {prov.armies}", True, color)
            self.screen.blit(name_surf, (x + 6, y + 8))
            self.screen.blit(armies_surf, (x + 6, y + 30))

    def _draw_status(self, state: GameState):
        panel_y = SCREEN_H - 90
        pygame.draw.rect(self.screen, COLORS["panel"], (0, panel_y, SCREEN_W, 90))
        pygame.draw.line(self.screen, COLORS["border"], (0, panel_y), (SCREEN_W, panel_y), 2)

        player = state.active_player
        color = COLORS["players"][player.index]
        label = "YOU" if player.is_human else "AI"
        text = self.font_lg.render(
            f"Active: {player.name} [{label}]  |  Koku: {player.koku}  |  Phase: {state.phase}",
            True, color,
        )
        self.screen.blit(text, (20, panel_y + 16))

        hint = self.font_sm.render("SPACE — next turn    ESC — quit", True, COLORS["text"])
        self.screen.blit(hint, (20, panel_y + 56))
