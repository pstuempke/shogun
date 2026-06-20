from __future__ import annotations
from enum import IntEnum


class NpcClass(IntEnum):
    BANDIT = 0
    PEASANT = 1
    SERVANT = 2
    GEISHA = 3
    SAMURAI = 4
    LORD = 5


# --- Display ---
SCREEN_W = 1280
SCREEN_H = 960
HUD_H = 80
TILE_SIZE = 32
FPS = 30

# --- Movement ---
PLAYER_SPEED = 3.0
PASSABLE_TILES: frozenset[int] = frozenset({0, 4})

# --- Social / Combat ---
CONTACT_DISTANCE = 48
PLAYER_DRAIN_RATE = 0.4
NPC_DRAIN_RATE = 1.5
YIELD_THRESHOLD = 0.0
DEATH_THRESHOLD = -20.0
YIELD_BEFRIEND_TICKS = 300
FLEE_DISTANCE = 96
FLEE_SPEED_MULT = 0.8

# --- Reincarnation ---
RESPAWN_DELAY = 1800  # ticks (~60s at 30 FPS)

# --- Economy ---
BRIBE_DURATION = 600  # ticks
ORDER_CONTACT_DISTANCE = CONTACT_DISTANCE

# --- Energy regeneration ---
ENERGY_MAX = 100.0
ENERGY_REGEN_RATE = 0.05  # energy per tick while not in combat

# --- Win condition ---
WIN_FOLLOWER_COUNT = 20
SACRED_ITEMS: frozenset[str] = frozenset({"mirror", "scroll", "buddha"})
DELIVERY_TIME_LIMIT = 9000  # ticks after milestone to collect scattered items (~5 min at 30 FPS)

# --- NPC rival AI ---
RIVAL_BEFRIEND_INTERVAL = 120   # ticks between each rival recruit attempt
RIVAL_WIN_COUNT = 8             # rival follower count that triggers a warning in the event log

# --- Betrayal ---
BETRAYAL_CHANCE_BANDIT = 0.0008      # per-tick probability for bandit followers
BETRAYAL_CHANCE_UNRELIABLE = 0.0004  # per-tick probability for NPCs flagged unreliable

# --- Tile IDs ---
TILE_FLOOR = 0
TILE_WALL = 1
TILE_WATER = 2
TILE_BUILDING = 3
TILE_BRIDGE = 4
TILE_ROCK = 5

# --- NPC class data ---
NPC_CLASS_DATA: dict[NpcClass, dict] = {
    NpcClass.BANDIT:  dict(max_energy=60.0,  speed=2.5, yen_min=5,  yen_max=15,  befriend_pct=60, bribe_cost=20),
    NpcClass.PEASANT: dict(max_energy=70.0,  speed=2.0, yen_min=10, yen_max=25,  befriend_pct=60, bribe_cost=35),
    NpcClass.SERVANT: dict(max_energy=80.0,  speed=2.0, yen_min=15, yen_max=35,  befriend_pct=50, bribe_cost=50),
    NpcClass.GEISHA:  dict(max_energy=75.0,  speed=2.2, yen_min=20, yen_max=50,  befriend_pct=50, bribe_cost=70),
    NpcClass.SAMURAI: dict(max_energy=100.0, speed=3.0, yen_min=30, yen_max=80,  befriend_pct=40, bribe_cost=120),
    NpcClass.LORD:    dict(max_energy=120.0, speed=1.5, yen_min=50, yen_max=150, befriend_pct=30, bribe_cost=250),
}

REINCARNATION_WEIGHTS: list[tuple[NpcClass, int]] = [
    (NpcClass.BANDIT,  30),
    (NpcClass.PEASANT, 25),
    (NpcClass.SERVANT, 20),
    (NpcClass.GEISHA,  12),
    (NpcClass.SAMURAI, 10),
    (NpcClass.LORD,     3),
]

# --- Colors (UI) ---
COLOR_BG = (20, 20, 40)
COLOR_TEXT = (220, 220, 200)
COLOR_HUD = (30, 30, 50)
COLOR_BORDER = (120, 100, 60)
COLOR_ENERGY_HIGH = (60, 200, 60)
COLOR_ENERGY_LOW = (200, 60, 60)
COLOR_ITEM_EMPTY = (80, 80, 80)
COLOR_ITEM_HELD = (220, 180, 40)

# --- Character select ---
CHARACTER_STARTS: dict[str, dict] = {
    "Ronin":   dict(yen=50,  energy=100.0, bonus_followers=0,
                    desc="A masterless samurai. Balanced start with nothing but skill."),
    "Samurai": dict(yen=80,  energy=100.0, bonus_followers=1,
                    desc="A skilled warrior. Begins with one loyal follower."),
    "Lord":    dict(yen=150, energy=120.0, bonus_followers=2,
                    desc="A powerful noble. Two sworn followers and a full purse."),
    "Geisha":  dict(yen=120, energy=85.0,  bonus_followers=0,
                    desc="A celebrated entertainer. High yen makes bribery easy."),
}

NPC_CLASS_COLORS: dict[NpcClass, tuple[int, int, int]] = {
    NpcClass.BANDIT:  (160, 60, 60),
    NpcClass.PEASANT: (140, 120, 80),
    NpcClass.SERVANT: (80, 120, 160),
    NpcClass.GEISHA:  (200, 100, 160),
    NpcClass.SAMURAI: (60, 60, 180),
    NpcClass.LORD:    (180, 160, 40),
}
