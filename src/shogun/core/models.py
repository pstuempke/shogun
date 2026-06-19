from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal

from shogun.core.constants import NpcClass, NPC_CLASS_DATA, SACRED_ITEMS, WIN_FOLLOWER_COUNT


@dataclass
class Order:
    action: Literal["befriend", "attack"]
    target_id: str
    completed: bool = False


@dataclass
class Portal:
    rect: tuple[int, int, int, int]  # x, y, w, h in tile coords
    target_zone_id: str
    target_position: tuple[float, float]  # pixel coords in target zone


@dataclass
class Zone:
    id: str
    name: str
    tile_map: list[list[int]]
    portals: list[Portal]
    npc_ids: list[str] = field(default_factory=list)
    item_ids: list[str] = field(default_factory=list)


@dataclass
class Item:
    name: Literal["mirror", "scroll", "buddha"]
    zone_id: str
    position: tuple[float, float]
    holder_id: str | None = None


@dataclass
class NPC:
    id: str
    name: str
    npc_class: NpcClass
    zone_id: str
    position: tuple[float, float]
    energy: float = field(init=False)
    max_energy: float = field(init=False)
    speed: float = field(init=False)
    is_follower: bool = False
    orders: list[Order] = field(default_factory=list)
    yen: int = 0
    is_dead: bool = False
    death_tick: int = -1
    allegiance: str | None = None
    combat_target: str | None = None
    bribed_until_tick: int = -1

    def __post_init__(self) -> None:
        data = NPC_CLASS_DATA[self.npc_class]
        self.max_energy = data["max_energy"]
        self.speed = data["speed"]
        self.energy = self.max_energy

    def apply_class(self, npc_class: NpcClass) -> None:
        self.npc_class = npc_class
        data = NPC_CLASS_DATA[npc_class]
        self.max_energy = data["max_energy"]
        self.speed = data["speed"]
        self.energy = self.max_energy

    @property
    def energy_pct(self) -> float:
        return (self.energy / self.max_energy) * 100 if self.max_energy > 0 else 0.0

    @property
    def pending_orders(self) -> list[Order]:
        return [o for o in self.orders if not o.completed]


@dataclass
class Player:
    position: tuple[float, float]
    energy: float = 100.0
    yen: int = 50
    follower_ids: list[str] = field(default_factory=list)
    sacred_items: list[str] = field(default_factory=list)
    current_zone_id: str = "bridge"
    combat_target: str | None = None

    @property
    def energy_pct(self) -> float:
        return self.energy


@dataclass
class GameState:
    player: Player
    npcs: dict[str, NPC]
    zones: dict[str, Zone]
    items: dict[str, Item]
    game_phase: Literal["playing", "won", "lost"] = "playing"
    elapsed_ticks: int = 0
    message: str = ""
    message_until_tick: int = 0
    event_log: list[str] = field(default_factory=list)  # newest first

    def show_message(self, text: str, duration: int = 90) -> None:
        self.message = text
        self.message_until_tick = self.elapsed_ticks + duration

    def log_event(self, text: str, max_entries: int = 40) -> None:
        self.event_log.insert(0, text)
        if len(self.event_log) > max_entries:
            self.event_log.pop()

    @property
    def current_zone(self) -> Zone:
        return self.zones[self.player.current_zone_id]

    @property
    def npcs_in_current_zone(self) -> list[NPC]:
        return [self.npcs[nid] for nid in self.current_zone.npc_ids if nid in self.npcs]

    def check_win(self) -> bool:
        return (
            len(self.player.follower_ids) >= WIN_FOLLOWER_COUNT
            and SACRED_ITEMS.issubset(set(self.player.sacred_items))
        )
