from __future__ import annotations
import pygame
from shogun.core.models import GameState
from shogun.core.constants import (
    SCREEN_W, SCREEN_H, HUD_H,
    COLOR_HUD, COLOR_BORDER, COLOR_TEXT, COLOR_ENERGY_HIGH, COLOR_ENERGY_LOW,
    COLOR_ITEM_EMPTY, COLOR_ITEM_HELD, WIN_FOLLOWER_COUNT,
)

HUD_Y = SCREEN_H - HUD_H


def draw_hud(surface: pygame.Surface, state: GameState, font_lg: pygame.font.Font, font_sm: pygame.font.Font) -> None:
    pygame.draw.rect(surface, COLOR_HUD, (0, HUD_Y, SCREEN_W, HUD_H))
    pygame.draw.line(surface, COLOR_BORDER, (0, HUD_Y), (SCREEN_W, HUD_Y), 2)

    player = state.player

    # Followers
    f_text = font_lg.render(f"Followers: {len(player.follower_ids)} / {WIN_FOLLOWER_COUNT}", True, COLOR_TEXT)
    surface.blit(f_text, (20, HUD_Y + 10))

    # Yen
    y_text = font_lg.render(f"Yen: {player.yen}", True, COLOR_TEXT)
    surface.blit(y_text, (280, HUD_Y + 10))

    # Energy bar
    bar_x, bar_y, bar_w, bar_h = 480, HUD_Y + 14, 200, 20
    pygame.draw.rect(surface, (40, 40, 40), (bar_x, bar_y, bar_w, bar_h))
    fill = max(0, int(bar_w * player.energy / 100))
    bar_color = COLOR_ENERGY_HIGH if player.energy > 40 else COLOR_ENERGY_LOW
    if fill > 0:
        pygame.draw.rect(surface, bar_color, (bar_x, bar_y, fill, bar_h))
    pygame.draw.rect(surface, COLOR_BORDER, (bar_x, bar_y, bar_w, bar_h), 2)
    e_label = font_sm.render("ENERGY", True, COLOR_TEXT)
    surface.blit(e_label, (bar_x + bar_w // 2 - e_label.get_width() // 2, bar_y + 2))

    # Sacred item slots
    item_names = ["mirror", "scroll", "buddha"]
    slot_x = 720
    for item_name in item_names:
        held = item_name in player.sacred_items
        color = COLOR_ITEM_HELD if held else COLOR_ITEM_EMPTY
        pygame.draw.rect(surface, color, (slot_x, HUD_Y + 10, 36, 36), border_radius=4)
        label = font_sm.render(item_name[0].upper(), True, (20, 20, 20) if held else (160, 160, 160))
        surface.blit(label, (slot_x + 12, HUD_Y + 18))
        slot_x += 48

    # Zone name (right-aligned)
    zone_text = font_sm.render(state.current_zone.name, True, COLOR_BORDER)
    surface.blit(zone_text, (SCREEN_W - zone_text.get_width() - 20, HUD_Y + 10))

    # Controls hint
    hint = font_sm.render("H=Befriend  A=Attack  B=Bribe  ESC=Quit", True, (140, 140, 140))
    surface.blit(hint, (20, HUD_Y + 52))

    # Timed message
    if state.elapsed_ticks < state.message_until_tick:
        msg_surf = font_lg.render(state.message, True, (255, 220, 80))
        surface.blit(msg_surf, (SCREEN_W // 2 - msg_surf.get_width() // 2, HUD_Y - 40))
