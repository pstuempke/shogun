from dataclasses import dataclass, field
from typing import Optional


REGIONS = [
    "Mutsu", "Dewa", "Hitachi", "Kozuke", "Shimosa",
    "Kai", "Izu", "Sagami", "Musashi", "Awa",
    "Totomi", "Suruga", "Mikawa", "Owari", "Mino",
    "Omi", "Yamashiro", "Yamato", "Kii", "Izumi",
    "Settsu", "Harima", "Bizen", "Mimasaka", "Inaba",
    "Izumo", "Iwami", "Nagato", "Buzen", "Chikuzen",
    "Hizen", "Higo", "Hyuga", "Osumi", "Satsuma",
]

NUM_PLAYERS = 5


@dataclass
class Province:
    name: str
    owner: Optional[int] = None  # player index, None = neutral
    armies: int = 0


@dataclass
class Player:
    index: int
    name: str
    koku: int = 100  # rice/currency
    is_human: bool = False


@dataclass
class GameState:
    provinces: list[Province] = field(default_factory=list)
    players: list[Player] = field(default_factory=list)
    year: int = 1560
    turn: int = 0
    current_player: int = 0
    phase: str = "recruitment"  # recruitment | movement | combat | tribute

    @classmethod
    def new_game(cls, human_player_index: int = 0) -> "GameState":
        provinces = [Province(name=name) for name in REGIONS]
        players = [
            Player(index=i, name=f"Clan {i+1}", is_human=(i == human_player_index))
            for i in range(NUM_PLAYERS)
        ]
        # distribute starting provinces evenly
        for i, province in enumerate(provinces):
            province.owner = i % NUM_PLAYERS
            province.armies = 5
        return cls(provinces=provinces, players=players)

    @property
    def active_player(self) -> Player:
        return self.players[self.current_player]

    def next_turn(self):
        self.current_player = (self.current_player + 1) % NUM_PLAYERS
        if self.current_player == 0:
            self.year += 1
            self.turn += 1
        self.phase = "recruitment"
