// Core data model. Pure data — no three.js or DOM imports so the
// simulation stays headless-testable.

export type PlayerClassId = "peasant" | "merchant" | "ronin" | "samurai" | "noble";

export interface PlayerClass {
  id: PlayerClassId;
  label: string;
  rank: number; // 0 (peasant) .. 4 (noble); feudal hierarchy position
  persuasion: number; // base persuasion score
  gold: number; // starting koban
  attack: number; // damage per strike
  hp: number;
  scoreMultiplier: number; // peasants score highest
  blurb: string;
}

export type NpcRole =
  | "daimyo"
  | "noble"
  | "samurai"
  | "monk"
  | "merchant"
  | "peasant"
  | "ronin"
  | "bandit";

export type Allegiance = "none" | "player" | "rival";

export type FollowerOrder = "follow" | "wait" | "guard";

export interface Waypoint {
  zx: number;
  zy: number;
  lx: number;
  ly: number;
}

export interface TravelPlan {
  waypoints: Waypoint[];
  idx: number;
  ticksLeft: number; // sim-tick budget; abandoned when exhausted (stuck)
}

export interface Npc {
  id: number;
  name: string;
  role: NpcRole;
  rank: number; // 0..5 — daimyo are 5
  zx: number;
  zy: number;
  // local position within the district, world-units relative to district origin
  lx: number;
  ly: number;
  hp: number;
  maxHp: number;
  attack: number;
  disposition: number; // -100..100 toward the player
  allegiance: Allegiance;
  order: FollowerOrder;
  alive: boolean;
  hostile: boolean; // attacks the player on sight
  yielded: boolean;
  isRivalLeader: boolean;
  carrying: number | null; // item id the NPC picked up
  plan: TravelPlan | null; // active walking route; NPCs never teleport
}

export type ItemKind = "koban" | "gift" | "weapon" | "sacred";

export interface Item {
  id: number;
  kind: ItemKind;
  name: string;
  value: number; // koban worth / gift affinity / weapon bonus
  zx: number;
  zy: number;
  lx: number;
  ly: number;
  heldBy: "world" | "player" | "npc";
  sacredIndex: number; // 0..3 for the four sacred treasures, else -1
}

export type Biome =
  | "village"
  | "forest"
  | "sakura"
  | "lake"
  | "mountain"
  | "paddy"
  | "temple"
  | "palace"
  | "plains";

export interface District {
  zx: number;
  zy: number;
  biome: Biome;
  name: string;
  seed: number;
  // walkability grid [ty][tx]; false = blocked (water, rock, building)
  walkable: boolean[][];
  heights: number[][]; // terrain height per tile corner-sampled at centers
}

export type GamePhase = "gathering" | "quest" | "won" | "lost";

export interface TickerEvent {
  text: string;
  time: number; // game seconds
  kind: "info" | "good" | "bad" | "rumor";
}
