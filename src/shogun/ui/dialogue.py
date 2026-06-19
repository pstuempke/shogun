from __future__ import annotations
import pygame
from shogun.core.models import GameState, NPC, Order
from shogun.core.constants import SCREEN_W, SCREEN_H, HUD_H, COLOR_HUD, COLOR_BORDER, COLOR_TEXT

# Colors
C_PANEL = (35, 35, 55)
C_HIGHLIGHT = (80, 120, 200)
C_DISABLED = (70, 70, 70)
C_CONFIRM = (60, 160, 60)
C_CANCEL = (160, 60, 60)

HUD_Y = SCREEN_H - HUD_H


class ActionMenu:
    """Small popup shown when adjacent to an NPC: H / A / B options."""

    def draw(
        self,
        surface: pygame.Surface,
        npc: NPC,
        state: GameState,
        cam_x: float,
        cam_y: float,
        font: pygame.font.Font,
    ) -> None:
        sx = int(npc.position[0] - cam_x)
        sy = int(npc.position[1] - cam_y) - 60
        sy = max(4, min(sy, HUD_Y - 80))

        panel_w, panel_h = 210, 72
        panel = pygame.Surface((panel_w, panel_h), pygame.SRCALPHA)
        panel.fill((30, 30, 50, 210))
        surface.blit(panel, (sx, sy))
        pygame.draw.rect(surface, COLOR_BORDER, (sx, sy, panel_w, panel_h), 2)

        title = font.render(npc.name, True, (220, 200, 120))
        surface.blit(title, (sx + 8, sy + 6))

        actions = []
        if not npc.is_follower and not npc.is_dead:
            actions.append(("[H] Befriend", True))
        if not npc.is_dead and not npc.is_follower:
            actions.append(("[A] Attack", True))
        if not npc.is_dead and not npc.is_follower:
            can_afford = state.player.yen >= __import__("shogun.systems.economy", fromlist=["bribe_cost"]).bribe_cost(npc)
            actions.append(("[B] Bribe", can_afford))
        if npc.is_follower:
            actions.append(("[H] Orders", True))

        x_off = 8
        for label, enabled in actions:
            color = COLOR_TEXT if enabled else C_DISABLED
            s = font.render(label, True, color)
            surface.blit(s, (sx + x_off, sy + 44))
            x_off += s.get_width() + 12


class OrderScreen:
    """Full-screen overlay for assigning 2 orders to a freshly befriended NPC."""

    def __init__(self) -> None:
        self.active = False
        self.npc_id: str = ""
        self._slots: list[dict] = [
            {"action": "befriend", "target_id": ""},
            {"action": "befriend", "target_id": ""},
        ]
        self._available_targets: list[NPC] = []
        self._selected_slot = 0
        self._selected_target: list[int] = [0, 0]
        self._action_idx: list[int] = [0, 0]
        self._actions = ["befriend", "attack"]

    def open(self, npc_id: str, state: GameState) -> None:
        self.active = True
        self.npc_id = npc_id
        self._selected_slot = 0
        self._action_idx = [0, 0]
        self._selected_target = [0, 0]
        self._available_targets = [
            n for n in state.npcs_in_current_zone
            if n.id != npc_id and not n.is_dead
        ]

    def handle_key(self, key: int, state: GameState) -> bool:
        """Returns True when the screen should close."""
        if key == pygame.K_ESCAPE:
            self.active = False
            return True

        if key == pygame.K_RETURN:
            self._commit(state)
            self.active = False
            return True

        if key == pygame.K_TAB:
            self._selected_slot = 1 - self._selected_slot

        slot = self._selected_slot
        if key == pygame.K_LEFT:
            self._action_idx[slot] = (self._action_idx[slot] - 1) % len(self._actions)
        if key == pygame.K_RIGHT:
            self._action_idx[slot] = (self._action_idx[slot] + 1) % len(self._actions)
        if key == pygame.K_UP and self._available_targets:
            self._selected_target[slot] = (self._selected_target[slot] - 1) % len(self._available_targets)
        if key == pygame.K_DOWN and self._available_targets:
            self._selected_target[slot] = (self._selected_target[slot] + 1) % len(self._available_targets)

        return False

    def _commit(self, state: GameState) -> None:
        from shogun.systems.orders import assign_orders
        npc = state.npcs.get(self.npc_id)
        if npc is None:
            return
        orders = []
        for i in range(2):
            action = self._actions[self._action_idx[i]]
            if self._available_targets:
                tidx = self._selected_target[i] % len(self._available_targets)
                target_id = self._available_targets[tidx].id
                orders.append(Order(action=action, target_id=target_id))
        assign_orders(npc, orders)

    def draw(self, surface: pygame.Surface, state: GameState, font_lg: pygame.font.Font, font_sm: pygame.font.Font) -> None:
        if not self.active:
            return
        overlay = pygame.Surface((SCREEN_W, SCREEN_H), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 180))
        surface.blit(overlay, (0, 0))

        panel_w, panel_h = 600, 420
        px = SCREEN_W // 2 - panel_w // 2
        py = SCREEN_H // 2 - panel_h // 2
        pygame.draw.rect(surface, C_PANEL, (px, py, panel_w, panel_h), border_radius=8)
        pygame.draw.rect(surface, COLOR_BORDER, (px, py, panel_w, panel_h), 2, border_radius=8)

        npc = state.npcs.get(self.npc_id)
        title = f"Assign Orders — {npc.name if npc else ''}"
        ts = font_lg.render(title, True, (220, 200, 120))
        surface.blit(ts, (px + panel_w // 2 - ts.get_width() // 2, py + 16))

        for slot in range(2):
            sy = py + 80 + slot * 140
            selected = slot == self._selected_slot
            border_col = C_HIGHLIGHT if selected else COLOR_BORDER
            pygame.draw.rect(surface, (45, 45, 65), (px + 20, sy, panel_w - 40, 120), border_radius=4)
            pygame.draw.rect(surface, border_col, (px + 20, sy, panel_w - 40, 120), 2, border_radius=4)

            slot_label = font_lg.render(f"Order {slot + 1}{'  ← active' if selected else ''}", True, COLOR_TEXT)
            surface.blit(slot_label, (px + 30, sy + 10))

            action = self._actions[self._action_idx[slot]]
            act_surf = font_sm.render(f"Action: ◄ {action.upper()} ►  (LEFT/RIGHT)", True, (180, 220, 180))
            surface.blit(act_surf, (px + 30, sy + 42))

            if self._available_targets:
                tidx = self._selected_target[slot] % len(self._available_targets)
                t = self._available_targets[tidx]
                tgt_surf = font_sm.render(f"Target: ▲ {t.name} ({t.npc_class.name}) ▼  (UP/DOWN)", True, (180, 220, 180))
            else:
                tgt_surf = font_sm.render("Target: (no NPCs in zone)", True, C_DISABLED)
            surface.blit(tgt_surf, (px + 30, sy + 70))

        hints = font_sm.render("TAB=switch slot   ENTER=confirm   ESC=skip", True, (140, 140, 160))
        surface.blit(hints, (px + panel_w // 2 - hints.get_width() // 2, py + panel_h - 36))
