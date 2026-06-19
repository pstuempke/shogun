import sys
import pygame
from shogun.core.game import new_game
from shogun.core.constants import SCREEN_W, SCREEN_H, FPS
from shogun.systems.movement import move_player, update_npcs
from shogun.systems.combat import player_attack, update_combat
from shogun.systems.social import player_befriend, nearest_npc
from shogun.systems.economy import player_bribe
from shogun.systems.reincarnation import update_reincarnation
from shogun.systems.orders import update_orders
from shogun.systems.win_condition import check_win_loss
from shogun.ui.renderer import Renderer
from shogun.ui.dialogue import ActionMenu, OrderScreen
from shogun.ui.title import TitleScreen


def main() -> None:
    pygame.init()
    screen = pygame.display.set_mode((SCREEN_W, SCREEN_H))
    pygame.display.set_caption("Shogun")
    clock = pygame.time.Clock()

    if not TitleScreen(screen).run(clock, FPS):
        pygame.quit()
        sys.exit()

    state = new_game()
    renderer = Renderer(screen)
    action_menu = ActionMenu()
    order_screen = OrderScreen()

    running = True
    while running:
        adjacent_npc = nearest_npc(state) if state.game_phase == "playing" else None

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

            elif event.type == pygame.KEYDOWN:
                if order_screen.active:
                    done = order_screen.handle_key(event.key, state)
                    continue

                if event.key == pygame.K_ESCAPE:
                    running = False

                elif state.game_phase == "playing" and adjacent_npc:
                    npc = adjacent_npc
                    if event.key == pygame.K_h:
                        if npc.is_follower:
                            order_screen.open(npc.id, state)
                        else:
                            msg = player_befriend(state, npc)
                            if npc.is_follower:
                                order_screen.open(npc.id, state)
                            else:
                                state.show_message(msg, 120)
                    elif event.key == pygame.K_a:
                        msg = player_attack(state, npc)
                        state.show_message(msg, 90)
                    elif event.key == pygame.K_b:
                        msg = player_bribe(state, npc)
                        state.show_message(msg, 90)

        if state.game_phase == "playing" and not order_screen.active:
            keys = pygame.key.get_pressed()
            move_player(state, keys)
            update_npcs(state)
            update_combat(state)
            update_reincarnation(state)
            update_orders(state)

            # item pickup
            px, py = state.player.position
            for item_name in list(state.current_zone.item_ids):
                item = state.items.get(item_name)
                if item and item.holder_id is None:
                    ix, iy = item.position
                    if ((px - ix) ** 2 + (py - iy) ** 2) ** 0.5 <= 32:
                        item.holder_id = "player"
                        if item_name not in state.player.sacred_items:
                            state.player.sacred_items.append(item_name)
                        state.show_message(f"You pick up the {item_name.upper()}!", 150)
                        state.log_event(f"You claim the {item_name.upper()} in {state.current_zone.name}.")

            check_win_loss(state)
            state.elapsed_ticks += 1

        renderer.draw(state, adjacent_npc, action_menu, order_screen)
        clock.tick(FPS)

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()
