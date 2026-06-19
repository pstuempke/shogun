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
from shogun.ui.pause import PauseMenu
from shogun.ui.end_screen import EndScreen


def run_game(screen: pygame.Surface, clock: pygame.time.Clock) -> bool:
    """Run one full game session. Returns True to play again, False to quit."""
    state = new_game()
    renderer = Renderer(screen)
    action_menu = ActionMenu()
    order_screen = OrderScreen()
    pause_menu = PauseMenu()
    font_lg = pygame.font.SysFont("monospace", 20, bold=True)
    font_sm = pygame.font.SysFont("monospace", 13)

    paused = False

    while True:
        adjacent_npc = nearest_npc(state) if state.game_phase == "playing" else None

        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False

            elif event.type == pygame.KEYDOWN:
                if order_screen.active:
                    order_screen.handle_key(event.key, state)
                    continue

                if event.key == pygame.K_ESCAPE:
                    if state.game_phase == "playing":
                        paused = not paused
                    continue

                if paused:
                    if event.key == pygame.K_RETURN:
                        paused = False
                    elif event.key == pygame.K_q:
                        return False
                    continue

                if state.game_phase == "playing" and adjacent_npc:
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

        if not paused and state.game_phase == "playing" and not order_screen.active:
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

        if paused:
            pause_menu.draw(screen, font_lg, font_sm)
            pygame.display.flip()

        # hand off to end screen when game is decided
        if state.game_phase in ("won", "lost"):
            return EndScreen().run(screen, clock, state)

        clock.tick(FPS)


def main() -> None:
    pygame.init()
    screen = pygame.display.set_mode((SCREEN_W, SCREEN_H))
    pygame.display.set_caption("Shogun")
    clock = pygame.time.Clock()

    if not TitleScreen(screen).run(clock, FPS):
        pygame.quit()
        sys.exit()

    while run_game(screen, clock):
        pass  # play again loop

    pygame.quit()
    sys.exit()


if __name__ == "__main__":
    main()
