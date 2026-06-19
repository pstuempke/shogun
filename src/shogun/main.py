import sys
import pygame
from shogun.core.game import new_game
from shogun.core.constants import SCREEN_W, SCREEN_H, FPS, CONTACT_DISTANCE
from shogun.systems.movement import move_player, update_npcs
from shogun.systems.combat import player_attack, update_combat
from shogun.systems.social import player_befriend, nearest_npc
from shogun.systems.economy import player_bribe
from shogun.systems.reincarnation import update_reincarnation
from shogun.ui.renderer import Renderer


def _nearest_npc_to_player(state):
    return nearest_npc(state)


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
                elif state.game_phase == "playing":
                    npc = _nearest_npc_to_player(state)
                    if event.key == pygame.K_h and npc:
                        msg = player_befriend(state, npc)
                        state.show_message(msg, 120)
                    elif event.key == pygame.K_a and npc:
                        msg = player_attack(state, npc)
                        state.show_message(msg, 90)
                    elif event.key == pygame.K_b and npc:
                        msg = player_bribe(state, npc)
                        state.show_message(msg, 90)

        if state.game_phase == "playing":
            keys = pygame.key.get_pressed()
            move_player(state, keys)
            update_npcs(state)
            update_combat(state)
            update_reincarnation(state)

            # item pickup
            px, py = state.player.position
            for item_name in list(state.current_zone.item_ids):
                item = state.items.get(item_name)
                if item and item.holder_id is None:
                    ix, iy = item.position
                    if ((px - ix) ** 2 + (py - iy) ** 2) ** 0.5 <= 32:
                        item.holder_id = "player"
                        state.player.sacred_items.append(item_name)
                        state.show_message(f"You pick up the {item_name}!", 150)

            # win check
            if state.check_win():
                state.game_phase = "won"

            state.elapsed_ticks += 1

        renderer.draw(state)
        clock.tick(FPS)

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()
