from __future__ import annotations
import math
import pygame
from shogun.core.models import GameState
from shogun.core.constants import (
    SCREEN_W, SCREEN_H, HUD_H,
    COLOR_HUD, COLOR_BORDER, COLOR_TEXT, COLOR_ENERGY_HIGH, COLOR_ENERGY_LOW,
    COLOR_ITEM_EMPTY, COLOR_ITEM_HELD, WIN_FOLLOWER_COUNT,
)

HUD_Y = SCREEN_H - HUD_H
TICKER_Y = HUD_Y - 22
TICKER_H = 22
C_TICKER_BG = (12, 12, 25)
C_TICKER_TEXT = (170, 195, 110)
C_TICKER_LABEL = (130, 110, 55)

_ticker_offset: float = 0.0
_ticker_speed: float = 1.2


def draw_hud(surface: pygame.Surface, state: GameState,
             font_lg: pygame.font.Font, font_sm: pygame.font.Font) -> None:
    global _ticker_offset

    t = pygame.time.get_ticks()

    # HUD background — two-tone: darker top strip for depth
    pygame.draw.rect(surface, COLOR_HUD, (0, HUD_Y, SCREEN_W, HUD_H))
    pygame.draw.rect(surface, (22, 22, 38), (0, HUD_Y, SCREEN_W, 8))

    # Gold separator line (double rule)
    pygame.draw.line(surface, (160, 130, 50), (0, HUD_Y), (SCREEN_W, HUD_Y), 2)
    pygame.draw.line(surface, (80, 65, 25), (0, HUD_Y + 2), (SCREEN_W, HUD_Y + 2), 1)

    # Vertical dividers between HUD sections
    for div_x in (260, 440, 660, 830):
        pygame.draw.line(surface, (60, 50, 30), (div_x, HUD_Y + 8), (div_x, HUD_Y + 60), 1)

    player = state.player

    # --- Followers ---
    f_count = len(player.follower_ids)
    f_pct = f_count / WIN_FOLLOWER_COUNT
    f_color = (80, 210, 80) if f_pct >= 0.75 else (220, 220, 180) if f_pct >= 0.4 else COLOR_TEXT
    f_text = font_lg.render(f"Followers: {f_count} / {WIN_FOLLOWER_COUNT}", True, f_color)
    surface.blit(f_text, (20, HUD_Y + 10))
    # Small dots showing follower progress
    for i in range(WIN_FOLLOWER_COUNT):
        dot_x = 22 + i * 11
        dot_y = HUD_Y + 52
        if dot_x + 8 > 250:
            break
        filled = i < f_count
        pygame.draw.rect(surface, (60, 200, 60) if filled else (35, 35, 50),
                         (dot_x, dot_y, 9, 5), border_radius=2)

    # --- Yen ---
    y_text = font_lg.render(f"Yen: {player.yen}", True, (220, 190, 70))
    surface.blit(y_text, (275, HUD_Y + 10))
    yen_hint = font_sm.render("(B=Bribe)", True, (100, 95, 60))
    surface.blit(yen_hint, (275, HUD_Y + 52))

    # --- Energy bar (segmented) ---
    bar_x, bar_y = 455, HUD_Y + 14
    bar_w, bar_h = 190, 16
    n_segs = 20
    seg_gap = 2
    seg_w = (bar_w - (n_segs - 1) * seg_gap) // n_segs

    # Dark background tray
    pygame.draw.rect(surface, (20, 20, 28), (bar_x - 2, bar_y - 2, bar_w + 4, bar_h + 4), border_radius=3)
    pygame.draw.rect(surface, COLOR_BORDER, (bar_x - 2, bar_y - 2, bar_w + 4, bar_h + 4), 1, border_radius=3)

    filled_segs = max(0, int(player.energy / 100 * n_segs))
    bar_color = COLOR_ENERGY_HIGH if player.energy > 40 else COLOR_ENERGY_LOW

    # Pulse warning when low
    if player.energy <= 25:
        pulse = 0.5 + 0.5 * math.sin(t / 180.0)
        bar_color = (int(200 + 55 * pulse), int(30 + 30 * pulse), int(30 + 30 * pulse))

    shine = (min(255, bar_color[0] + 70), min(255, bar_color[1] + 70), min(255, bar_color[2] + 70))

    for i in range(n_segs):
        bx = bar_x + i * (seg_w + seg_gap)
        if i < filled_segs:
            pygame.draw.rect(surface, bar_color, (bx, bar_y, seg_w, bar_h), border_radius=1)
            pygame.draw.line(surface, shine, (bx, bar_y + 1), (bx + seg_w - 1, bar_y + 1), 1)
        else:
            pygame.draw.rect(surface, (25, 25, 35), (bx, bar_y, seg_w, bar_h), border_radius=1)

    e_label = font_sm.render("ENERGY", True, COLOR_TEXT)
    surface.blit(e_label, (bar_x + bar_w // 2 - e_label.get_width() // 2, bar_y + 2))

    # Energy percentage
    pct_text = font_sm.render(f"{int(player.energy)}%", True, (140, 140, 150))
    surface.blit(pct_text, (bar_x + bar_w + 6, bar_y + 2))

    # --- Sacred item slots ---
    item_names = ["mirror", "scroll", "buddha"]
    slot_x = 670
    for item_name in item_names:
        held = item_name in player.sacred_items
        _draw_item_slot(surface, slot_x, HUD_Y + 8, item_name, held, font_sm)
        slot_x += 52

    # Delivery countdown (right side, replaces zone name when active)
    if state.delivery_phase and state.player.delivery_deadline_tick > 0:
        ticks_left = max(0, state.player.delivery_deadline_tick - state.elapsed_ticks)
        secs_left = ticks_left // 30
        mins = secs_left // 60
        secs = secs_left % 60
        urgent = ticks_left < 900  # last 30 seconds
        timer_col = (220, 60, 60) if urgent else (220, 180, 40)
        timer_text = font_lg.render(f"DELIVER ITEMS: {mins}:{secs:02d}", True, timer_col)
        surface.blit(timer_text, (SCREEN_W - timer_text.get_width() - 14, HUD_Y + 10))
    else:
        zone_text = font_sm.render(f"[ {state.current_zone.name} ]", True, COLOR_BORDER)
        surface.blit(zone_text, (SCREEN_W - zone_text.get_width() - 14, HUD_Y + 10))

    # Controls hint
    hint = font_sm.render("H=Befriend  A=Attack  B=Bribe  ESC=Pause", True, (85, 85, 105))
    surface.blit(hint, (20, HUD_Y + 66))

    # Timed message
    if state.elapsed_ticks < state.message_until_tick:
        msg_surf = font_lg.render(state.message, True, (255, 220, 80))
        mx = SCREEN_W // 2 - msg_surf.get_width() // 2
        pygame.draw.rect(surface, (15, 15, 25),
                         (mx - 10, TICKER_Y - 30, msg_surf.get_width() + 20, 28), border_radius=4)
        pygame.draw.rect(surface, (120, 100, 40),
                         (mx - 10, TICKER_Y - 30, msg_surf.get_width() + 20, 28), 1, border_radius=4)
        surface.blit(msg_surf, (mx, TICKER_Y - 27))

    _draw_ticker(surface, state, font_sm)


def _draw_item_slot(surface: pygame.Surface, x: int, y: int,
                    item_name: str, held: bool, font: pygame.font.Font) -> None:
    # Background
    pygame.draw.rect(surface, (15, 15, 25), (x, y, 46, 46), border_radius=5)
    border_color = COLOR_ITEM_HELD if held else (55, 55, 70)
    pygame.draw.rect(surface, border_color, (x, y, 46, 46), 2, border_radius=5)

    cx, cy = x + 23, y + 20

    if item_name == "mirror":
        if held:
            # Octagonal mirror
            r = 11
            pts = [(cx + int(r * math.cos(math.pi / 8 + i * math.pi / 4)),
                    cy + int(r * math.sin(math.pi / 8 + i * math.pi / 4))) for i in range(8)]
            pygame.draw.polygon(surface, (150, 200, 245), pts)
            pygame.draw.polygon(surface, (210, 235, 255), pts, 2)
            pygame.draw.line(surface, (230, 248, 255), (cx - 6, cy), (cx + 6, cy), 1)
            pygame.draw.line(surface, (230, 248, 255), (cx, cy - 6), (cx, cy + 6), 1)
        else:
            pygame.draw.circle(surface, (50, 55, 65), (cx, cy), 10, 1)

    elif item_name == "scroll":
        if held:
            pygame.draw.rect(surface, (240, 210, 130), (cx - 9, cy - 4, 18, 8))
            pygame.draw.circle(surface, (185, 155, 90), (cx - 9, cy), 4)
            pygame.draw.circle(surface, (185, 155, 90), (cx + 9, cy), 4)
            pygame.draw.circle(surface, (210, 180, 110), (cx - 9, cy), 3)
            pygame.draw.circle(surface, (210, 180, 110), (cx + 9, cy), 3)
            for dy in (-2, 1):
                pygame.draw.line(surface, (160, 130, 75), (cx - 6, cy + dy), (cx + 6, cy + dy), 1)
        else:
            pygame.draw.rect(surface, (70, 65, 50), (cx - 7, cy - 3, 14, 6), 1)

    elif item_name == "buddha":
        if held:
            pygame.draw.ellipse(surface, (245, 170, 50), (cx - 8, cy, 16, 10))
            pygame.draw.circle(surface, (245, 170, 50), (cx, cy - 5), 6)
            pygame.draw.circle(surface, (255, 215, 90), (cx, cy - 5), 8, 1)
            pygame.draw.circle(surface, (215, 145, 35), (cx, cy - 11), 2)
        else:
            pygame.draw.circle(surface, (60, 55, 40), (cx, cy - 2), 7, 1)

    # Item name label at bottom of slot
    label_color = (210, 175, 30) if held else (75, 75, 90)
    label = font.render(item_name[0].upper(), True, label_color)
    surface.blit(label, (cx - label.get_width() // 2, y + 34))


def _draw_ticker(surface: pygame.Surface, state: GameState, font: pygame.font.Font) -> None:
    global _ticker_offset

    pygame.draw.rect(surface, C_TICKER_BG, (0, TICKER_Y, SCREEN_W, TICKER_H))
    pygame.draw.line(surface, (50, 40, 20), (0, TICKER_Y), (SCREEN_W, TICKER_Y), 1)

    label = font.render("NEWS »", True, C_TICKER_LABEL)
    surface.blit(label, (6, TICKER_Y + 3))
    clip_x = label.get_width() + 14

    if not state.event_log:
        return

    ticker_text = "  ·  ".join(state.event_log)
    text_surf = font.render(ticker_text, True, C_TICKER_TEXT)
    total_w = text_surf.get_width()

    _ticker_offset += _ticker_speed
    if _ticker_offset > total_w + SCREEN_W:
        _ticker_offset = 0.0

    draw_x = clip_x + SCREEN_W - int(_ticker_offset)

    old_clip = surface.get_clip()
    surface.set_clip(pygame.Rect(clip_x, TICKER_Y, SCREEN_W - clip_x, TICKER_H))
    surface.blit(text_surf, (draw_x, TICKER_Y + 3))
    surface.set_clip(old_clip)
