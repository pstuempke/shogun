import type { NpcRole } from "../core/types";

export interface RosterEntry {
  name: string;
  role: NpcRole;
  rank: number;
  hp: number;
  attack: number;
  disposition: number;
  hostile: boolean;
  isRivalLeader: boolean;
}

const e = (
  name: string,
  role: NpcRole,
  rank: number,
  hp: number,
  attack: number,
  disposition = 0,
  hostile = false,
  isRivalLeader = false,
): RosterEntry => ({ name, role, rank, hp, attack, disposition, hostile, isRivalLeader });

// The 30 souls who roam Japan. A mix of figures from the novel and
// archetypes from the 1986 original. Ishido leads the rival faction and
// recruits followers of his own as the game runs.
export const ROSTER: readonly RosterEntry[] = [
  e("Lord Toranaga", "daimyo", 5, 160, 22, 10),
  e("Lord Ishido", "daimyo", 5, 170, 24, -60, false, true),
  e("Lady Mariko", "noble", 4, 90, 10, 20),
  e("Lord Kiyama", "daimyo", 5, 140, 20, -20),
  e("Lord Onoshi", "daimyo", 5, 130, 18, -15),
  e("Lord Sugiyama", "noble", 4, 110, 14, 0),
  e("Lady Ochiba", "noble", 4, 85, 8, -25),
  e("Lord Yabu", "noble", 4, 125, 17, -10),
  e("Captain Buntaro", "samurai", 3, 130, 19, -5),
  e("Naga the Loyal", "samurai", 3, 115, 16, 15),
  e("Omi the Cunning", "samurai", 3, 110, 15, 0),
  e("Hiromatsu Iron-Fist", "samurai", 3, 140, 20, 5),
  e("Anjin the Pilot", "samurai", 3, 105, 14, 25),
  e("Brother Sebastio", "monk", 2, 80, 6, -10),
  e("Abbot Genjiro", "monk", 2, 90, 7, 15),
  e("Sister Yukiko", "monk", 2, 75, 5, 20),
  e("Wandering Tetsuo", "monk", 2, 85, 8, 10),
  e("Merchant Goro", "merchant", 1, 80, 7, 10),
  e("Silk-Trader Hana", "merchant", 1, 75, 6, 15),
  e("Rice-Broker Denzo", "merchant", 1, 85, 8, 5),
  e("Pearl-Diver Umi", "merchant", 1, 70, 6, 20),
  e("Farmer Ichiro", "peasant", 0, 70, 6, 25),
  e("Fisherwife Sato", "peasant", 0, 65, 5, 25),
  e("Woodcutter Kenta", "peasant", 0, 80, 9, 20),
  e("Old Chiyo", "peasant", 0, 60, 4, 30),
  e("Ronin Kazuo", "ronin", 2, 110, 16, -5),
  e("Ronin Shiro", "ronin", 2, 105, 15, 0),
  e("Two-Sword Rin", "ronin", 2, 115, 17, -10),
  e("Bandit Gonji", "bandit", 1, 95, 13, -50, true),
  e("Bandit Raizo", "bandit", 1, 100, 14, -50, true),
];
