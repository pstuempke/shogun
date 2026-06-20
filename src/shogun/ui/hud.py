from __future__ import annotations
import pygame
from shogun.core.models import GameState
from shogun.core.constants import (
    SCREEN_W, SCREEN_H, HUD_H,
    COLOR_HUD, COLOR_BORDER, COLOR_TEXT, COLOR_ENERGY_HIGH, COLOR_ENERGY_LOW,
    COLOR_ITEM_EMPTY, COLOR_ITEM_HELD, WIN_FOLLOWER_COUNT,
)

HUD_Y = SCREEN_H - HUD_H
TICKER_Y = HUD_Y - 22   # news ticker strip sits just above the HUD
TICKER_H = 22
C_TICKER_BG = (15, 15, 30)
C_TICKER_TEXT = (180, 200, 120)
C_TICKER_LABEL = (120, 100, 60)

# Ticker scroll state (module-level so it persists across frames)
_ticker_offset: float = 0.0
_ticker_speed: float = 1.2   # pixels per tick


def draw_hud(surface: pygame.Surface, state: GameState, font_lg: pygame.font.Font, font_sm: pygame.font.Font) -> None:
    global _ticker_offset

    pygame.draw.rect(surface, COLOR_HUD, (0, HUD_Y, SCREEN_W, HUD_H))
    pygame.draw.line(surface, COLOR_BORDER, (0, HUD_Y), (SCREEN_W, HUD_Y), 2)

    player = state.player

    # Followers
    f_text = font_lg.render(f"Followers: {len(player.follower_ids)} / {WIN_FOLLOWER_COUNT}", True, COLOR_TEXT)
    surface.blit(f_text, (20, HUD_Y + 8))

    # Yen
    y_text = font_lg.render(f"Yen: {player.yen}", True, COLOR_TEXT)
    surface.blit(y_text, (280, HUD_Y + 8))

    # Energy bar
    bar_x, bar_y, bar_w, bar_h = 460, HUD_Y + 12, 180, 18
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
    slot_x = 680
    for item_name in item_names:
        held = item_name in player.sacred_items
        color = COLOR_ITEM_HELD if held else COLOR_ITEM_EMPTY
        pygame.draw.rect(surface, color, (slot_x, HUD_Y + 8, 34, 34), border_radius=4)
        label = font_sm.render(item_name[0].upper(), True, (20, 20, 20) if held else (160, 160, 160))
        surface.blit(label, (slot_x + 11, HUD_Y + 16))
        slot_x += 44

    # Delivery countdown (right side, replaces zone name area when active)
    if state.delivery_phase and state.player.delivery_deadline_tick > 0:
        ticks_left = max(0, state.player.delivery_deadline_tick - state.elapsed_ticks)
        secs_left = ticks_left // 30
        mins = secs_left // 60
        secs = secs_left % 60
        urgent = ticks_left < 900  # last 30 seconds
        timer_col = (220, 60, 60) if urgent else (220, 180, 40)
        timer_text = font_lg.render(f"DELIVER ITEMS: {mins}:{secs:02d}", True, timer_col)
        surface.blit(timer_text, (SCREEN_W - timer_text.get_width() - 16, HUD_Y + 8))
    else:
        zone_text = font_sm.render(f"[ {state.current_zone.name} ]", True, COLOR_BORDER)
        surface.blit(zone_text, (SCREEN_W - zone_text.get_width() - 16, HUD_Y + 8))

    # Controls hint (bottom row of HUD)
    hint = font_sm.render("H=Befriend  A=Attack  B=Bribe  ESC=Quit", True, (100, 100, 120))
    surface.blit(hint, (20, HUD_Y + 52))

    # Timed message (floats above ticker)
    if state.elapsed_ticks < state.message_until_tick:
        msg_surf = font_lg.render(state.message, True, (255, 220, 80))
        mx = SCREEN_W // 2 - msg_surf.get_width() // 2
        # dark backing
        pygame.draw.rect(surface, (20, 20, 30), (mx - 8, TICKER_Y - 28, msg_surf.get_width() + 16, 26), border_radius=4)
        surface.blit(msg_surf, (mx, TICKER_Y - 26))

    # --- News ticker ---
    _draw_ticker(surface, state, font_sm)


def _draw_ticker(surface: pygame.Surface, state: GameState, font: pygame.font.Font) -> None:
    global _ticker_offset

    pygame.draw.rect(surface, C_TICKER_BG, (0, TICKER_Y, SCREEN_W, TICKER_H))
    pygame.draw.line(surface, COLOR_BORDER, (0, TICKER_Y), (SCREEN_W, TICKER_Y), 1)

    # "NEWS" label
    label = font.render("NEWS »", True, C_TICKER_LABEL)
    surface.blit(label, (6, TICKER_Y + 3))
    clip_x = label.get_width() + 14

    if not state.event_log:
        return

    # build the full ticker string from the log (newest first, separated by dots)
    ticker_text = "  ·  ".join(state.event_log)
    text_surf = font.render(ticker_text, True, C_TICKER_TEXT)
    total_w = text_surf.get_width()

    # scroll left; wrap when fully scrolled off
    _ticker_offset += _ticker_speed
    if _ticker_offset > total_w + SCREEN_W:
        _ticker_offset = 0.0

    draw_x = clip_x + SCREEN_W - int(_ticker_offset)

    # clip to the area right of the label
    old_clip = surface.get_clip()
    surface.set_clip(pygame.Rect(clip_x, TICKER_Y, SCREEN_W - clip_x, TICKER_H))
    surface.blit(text_surf, (draw_x, TICKER_Y + 3))
    surface.set_clip(old_clip)
