// All game tunables live here. No magic numbers in system files.

// ---- World layout ----
export const WORLD_W = 7; // districts across
export const WORLD_H = 7; // districts down
export const ZONE_TILES = 22; // tiles per district side
export const TILE = 2; // world units per tile
export const ZONE_SIZE = ZONE_TILES * TILE; // world units per district side
export const WORLD_SEED = 1600; // Battle of Sekigahara

// Palace district (Phase transition happens here)
export const PALACE_ZX = 3;
export const PALACE_ZY = 0;
// Temple district (respawn point after ransom)
export const TEMPLE_ZX = 1;
export const TEMPLE_ZY = 5;

// ---- Player movement ----
export const PLAYER_SPEED = 9; // world units / s
export const PLAYER_RADIUS = 0.55;
export const NPC_LOCAL_SPEED = 3.2;
export const INTERACT_RANGE = 3.2; // world units to open action bar
export const PICKUP_RANGE = 2.2;

// ---- Time ----
export const GAME_DAY_SECONDS = 120; // real seconds per in-game day

// ---- Living world simulation ----
export const NAMED_NPC_COUNT = 30;
export const SIM_TICK_SECONDS = 2.0; // global AI heartbeat
export const NPC_TRAVEL_SPEED = 4.5; // world units / s while walking a travel plan

// ---- NPC-vs-NPC fights ----
export const FIGHT_START_RANGE = 3; // world units for an aggressor to strike first blood
export const AGGRESS_PATIENCE = 20; // ticks a stalker pursues before giving up
export const FIGHT_DAMAGE_SCALE = 0.6; // per-tick blows are softer than duel strikes
export const FIGHT_DEATH_CHANCE = 0.12; // chance a bandit finishes a yielded victim
export const FIGHT_MAX_TICKS = 30; // stalemates disband
export const FIGHT_AFFINITY_HIT = 30; // starting a fight sours the pair
export const FIGHT_YIELD_AFFINITY_HIT = 20; // being beaten sours it further
export const INTERVENE_THRESHOLD = 40; // bravery+loyalty score needed to join a fight
export const WANDER_RADIUS = 2; // max district distance for a wander destination
export const PLAN_TIMEOUT_TICKS = 60; // abandon a travel plan after this many sim ticks
export const GATE_INSET_TILES = 1.5; // gate waypoints sit this far inside each district
export const NPC_FLEE_HEALTH = 0.35;
export const RIVAL_RECRUIT_SECONDS = 40; // Ishido recruits one NPC this often
export const RIVAL_MAX_FOLLOWERS = 12;
export const RIVAL_TICKER_MILESTONE = 3; // ticker reports every Nth rival recruit
export const TICKER_MAX_LINES = 5;

// ---- Memory & news ----
export const MEMORY_CAPACITY = 8; // ring buffer per NPC; treasure memories evict last
export const NEWS_MEMORIES_SHOWN = 3; // freshest memories narrated per ask
export const NEWS_MIN_DISPOSITION = -20; // colder NPCs refuse to talk
export const GOSSIP_CHANCE = 0.35; // per tick: two NPCs sharing a district swap news
export const TREASURE_WITNESSES = 3; // NPCs seeded with each treasure sighting

// ---- Relationships ----
export const AFFINITY_SAME_ROLE = 15;
export const AFFINITY_MONK_BONUS = 20; // everyone likes monks
export const AFFINITY_BANDIT_PENALTY = -60; // nobody likes bandits
export const AFFINITY_NOISE = 10; // seeded per-pair variation

// ---- Utility brain (needs & behaviors) ----
export const NEED_REST_RATE = 0.5; // per tick
export const NEED_SOCIAL_RATE = 1.2; // per tick, scaled by gregarious
export const NEED_PURPOSE_RATE = 0.9; // per tick
export const SAFETY_DECAY = 3; // per tick
export const SAFETY_WITNESS_SPIKE = 45; // added when violence is witnessed
export const REST_LOW_HP_BONUS = 30; // rest score bonus when wounded
export const IDLE_SCORE = 14; // baseline so nobody acts on trivial needs
export const WORK_TICKS = 8; // ticks spent working on arrival
export const REST_TICKS = 6;
export const REST_HEAL = 3; // extra hp per resting tick
export const CHAT_RANGE = 3.5; // world units to start a chat
export const CHAT_TICKS = 3;
export const CHAT_AFFINITY_GAIN = 8;
export const CHAT_COOLDOWN_TICKS = 15;
export const SOCIAL_MIN_AFFINITY = -10; // won't seek out people below this
export const SOCIALIZE_PATIENCE = 20; // give up finding the partner after this many ticks
export const SOCIAL_SEARCH_DISTRICTS = 2; // how far NPCs look for company
export const FLEE_SAFETY_THRESHOLD = 50; // above this, fleeing dominates

// ---- Social system ----
export const FOLLOWERS_TO_WIN = 20;
export const BEFRIEND_BASE_DIFFICULTY = 55; // roll-under target modifiers apply to this
export const DISPOSITION_MIN = -100;
export const DISPOSITION_MAX = 100;
export const DISPOSITION_BEFRIEND_BONUS = 0.35; // disposition * this added to persuasion
export const DISPOSITION_FAIL_PENALTY = 8; // failed befriend lowers disposition
export const DISPOSITION_GIFT_DIVISOR = 2; // gift value / this => disposition gain
export const RANK_GAP_PENALTY = 14; // persuasion penalty per rank the NPC is above you
export const RANK_GAP_BONUS = 5; // bonus per rank the NPC is below you
export const FOLLOWER_MOMENTUM = 1.5; // each existing follower adds this to persuasion
export const RIVAL_ALIGNED_PENALTY = 25; // NPC already sworn to the rival
export const BRIBE_BASE_COST = 40; // koban; scaled by NPC rank
export const BRIBE_RANK_MULT = 35;
export const BRIBE_DISPOSITION_FLOOR = -40; // too hostile to bribe below this

// ---- Combat ----
export const PLAYER_BASE_HP = 100;
export const ATTACK_RANGE = 2.4;
export const ATTACK_ARC_DOT = 0.25; // facing tolerance
export const ATTACK_COOLDOWN = 0.45; // s
export const DODGE_SPEED = 22;
export const DODGE_TIME = 0.22;
export const DODGE_COOLDOWN = 0.9;
export const DODGE_IFRAMES = 0.3;
export const ENEMY_TELEGRAPH = 0.5; // windup before an enemy strike lands
export const ENEMY_STRIKE_RANGE = 2.2;
export const ENEMY_ATTACK_COOLDOWN = 1.4;
export const YIELD_THRESHOLD = 0.25; // NPC yields (can be spared) below this HP fraction

// ---- Followers in combat & envoy errands ----
export const FOLLOWER_RETREAT_HP = 0.3; // followers stop assisting below this HP fraction
export const FOLLOWER_ATTACK_COOLDOWN = 1.1; // s between follower strikes
export const FOLLOWER_ASSIST_RANGE = 16; // world units from the player they will engage within
export const ENVOY_PERSUASION_SHARE = 0.8; // of the player's persuasion an envoy carries
export const ENVOY_MAX_HOPS = 3; // re-plans chasing a moving target before giving up
export const ORDER_ATTACK_DISPOSITION_HIT = 40; // being jumped by your goons is not endearing

// ---- Health recovery ----
export const PLAYER_REGEN_HP_PER_S = 1.5; // out-of-combat passive regen
export const REGEN_COMBAT_DELAY = 6; // seconds after combat before regen starts
export const REST_AURA_RANGE = 7; // world units from a pagoda/well
export const REST_AURA_MULT = 3; // regen multiplier inside an aura

// ---- Trade ----
export const TRADE_STOCK_SIZE = 3; // wares a merchant offers per day
export const TRADE_SELL_FRACTION = 0.5; // merchants buy your goods at half value
export const TRADE_GREED_SPREAD = 0.6; // price = base * (0.8 + greedy * this)

// ---- Economy ----
export const KOBAN_PICKUP_MIN = 15;
export const KOBAN_PICKUP_MAX = 60;
export const RANSOM_GOLD_FRACTION = 0.5; // lost on defeat (normal mode)
export const RANSOM_FOLLOWER_FRACTION = 0.5;

// ---- Quest / scoring ----
export const SACRED_ITEM_COUNT = 4;
export const SCORE_PER_FOLLOWER = 100;
export const SCORE_PER_SACRED_ITEM = 250;
export const SCORE_GOLD_WEIGHT = 1;
export const SCORE_TIME_BONUS_MAX = 2000;
export const SCORE_TIME_PAR_SECONDS = 1500; // finish faster than this for full bonus

// ---- Camera ----
export const CAM_DISTANCE = 34;
export const CAM_ZOOM_MIN = 14;
export const CAM_ZOOM_MAX = 30;
export const CAM_VIEW_HEIGHT = 21; // ortho half-height in world units
export const CAM_LERP = 4.5; // follow smoothing
