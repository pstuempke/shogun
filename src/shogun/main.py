import sys
import pygame
from shogun.core.game import new_game
from shogun.core.constants import SCREEN_W, SCREEN_H, FPS
from shogun.systems.movement import move_player, update_npcs
from shogun.ui.renderer import Renderer


def main() -> None:
    pygame.init()
    screen = pygame.display.set_mode((SCREEN_W, SCREEN_H))
    pygame.display.set_caption("Shogun")
    clock = pygame.time.Clock()

    state = new_game()
    renderer = Renderer(screen)

    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False

        if state.game_phase == "playing":
            keys = pygame.key.get_pressed()
            move_player(state, keys)
            update_npcs(state)
            state.elapsed_ticks += 1

        renderer.draw(state)
        clock.tick(FPS)

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()
