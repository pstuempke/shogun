import {
  FOLLOWERS_TO_WIN,
  PALACE_ZX,
  PALACE_ZY,
  SACRED_ITEM_COUNT,
  SCORE_GOLD_WEIGHT,
  SCORE_PER_FOLLOWER,
  SCORE_PER_SACRED_ITEM,
  SCORE_TIME_BONUS_MAX,
  SCORE_TIME_PAR_SECONDS,
  WORLD_H,
  WORLD_W,
} from "../core/constants";
import type { Item } from "../core/types";
import { shuffled, type Rng } from "../core/rng";

export const SACRED_NAMES = [
  "Kusanagi, the Grass-Cutter Sword",
  "Yata, the Sacred Mirror",
  "Yasakani, the Jade Magatama",
  "The Golden War Fan of Minamoto",
] as const;

export function readyForAudience(followerCount: number): boolean {
  return followerCount >= FOLLOWERS_TO_WIN;
}

// The Emperor scatters the four treasures across districts far from the
// palace; each hides in a distinct district.
export function sacredItemDistricts(rng: Rng): { zx: number; zy: number }[] {
  const candidates: { zx: number; zy: number }[] = [];
  for (let zy = 0; zy < WORLD_H; zy++) {
    for (let zx = 0; zx < WORLD_W; zx++) {
      const far = Math.abs(zx - PALACE_ZX) + Math.abs(zy - PALACE_ZY) >= 4;
      if (far) candidates.push({ zx, zy });
    }
  }
  return shuffled(rng, candidates).slice(0, SACRED_ITEM_COUNT);
}

export function sacredCarriedCount(items: Item[]): number {
  return items.filter((i) => i.sacredIndex >= 0 && i.heldBy === "player").length;
}

export function questComplete(items: Item[]): boolean {
  return sacredCarriedCount(items) === SACRED_ITEM_COUNT;
}

export interface ScoreInput {
  followers: number;
  gold: number;
  sacredDelivered: number;
  elapsedSeconds: number;
  classMultiplier: number;
}

export function finalScore(s: ScoreInput): number {
  const timeFrac = Math.max(0, 1 - s.elapsedSeconds / (SCORE_TIME_PAR_SECONDS * 2));
  const timeBonus = Math.round(SCORE_TIME_BONUS_MAX * Math.min(1, timeFrac * 2));
  const base =
    s.followers * SCORE_PER_FOLLOWER +
    s.gold * SCORE_GOLD_WEIGHT +
    s.sacredDelivered * SCORE_PER_SACRED_ITEM +
    timeBonus;
  return Math.round(base * s.classMultiplier);
}
