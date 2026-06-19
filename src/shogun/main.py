import sys
import pygame
from shogun.core.game import new_game
from shogun.core.constants import SCREEN_W, SCREEN_H, FPS


def main() -> None:
    pygame.init()
    screen = pygame.display.set_mode((SCREEN_W, SCREEN_H))
    pygame.display.set_caption("Shogun")
    clock = pygame.time.Clock()
    font = pygame.font.SysFont("monospace", 24, bold=True)

    state = new_game()

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                running = False

        screen.fill((20, 20, 40))
        lines = [
            f"SHOGUN  —  stub main (Phase 0)",
            f"Zone: {state.current_zone.name}",
            f"NPCs loaded: {len(state.npcs)}",
            f"Items: {list(state.items.keys())}",
            f"Player yen: {state.player.yen}",
            "",
            "Phase 1 (world + movement) not yet implemented.",
            "ESC to quit.",
        ]
        for i, line in enumerate(lines):
            surf = font.render(line, True, (220, 220, 200))
            screen.blit(surf, (40, 40 + i * 36))

        pygame.display.flip()
        clock.tick(FPS)

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()
