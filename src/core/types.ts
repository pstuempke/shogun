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

// The player is not an NPC; memories about the player use this id.
export const PLAYER_ID = -2;

// Personality, 0..1 each. Scales behavior scoring and social outcomes.
export interface Traits {
  brave: number; // fight vs flee; intervention (WP4)
  gregarious: number; // how fast the social need grows
  greedy: number; // trade pricing, bribe appetite
  pious: number; // temple visits, rest preference
}

// Sims-like drives, 0..100. Higher = more urgent.
export interface Needs {
  rest: number;
  social: number;
  purpose: number; // do my role's work
  safety: number; // spiked by witnessed violence, decays
}

export type BehaviorKind = "idle" | "work" | "rest" | "socialize" | "chat" | "flee" | "aggress";

// A skirmish between NPCs, resolved over sim ticks so the player can
// stumble onto one mid-fight and watch (or join).
export interface Fight {
  id: number;
  sideA: number[]; // aggressors
  sideB: number[]; // defenders (interveners join here)
  zx: number;
  zy: number;
  ticks: number;
}

export interface NpcBehavior {
  kind: BehaviorKind;
  until: number; // remaining sim ticks (paused while walking a plan)
  partnerId: number; // chat/socialize partner, else -1
}

// A follower dispatched to persuade another NPC on the player's behalf.
export interface EnvoyMission {
  targetId: number;
  stage: "travel" | "return";
  hops: number; // re-plans consumed chasing a moving target
}

export type MemoryKind = "fight" | "death" | "recruit" | "treasure";

export interface Memory {
  day: number; // in-game day it was witnessed
  kind: MemoryKind;
  subjectId: number; // who did it (npc id or PLAYER_ID)
  objectId: number; // to whom (npc id, or sacredIndex for treasure sightings)
  zx: number;
  zy: number;
  secondhand: boolean; // learned via gossip rather than witnessed
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
  memories: Memory[]; // what this NPC witnessed or heard, freshest last
  traits: Traits;
  needs: Needs;
  behavior: NpcBehavior | null;
  chatCooldown: number; // sim ticks before this NPC will chat again
  mission: EnvoyMission | null; // active envoy errand (followers only)
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
