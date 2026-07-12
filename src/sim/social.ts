import {
  BEFRIEND_BASE_DIFFICULTY,
  BRIBE_BASE_COST,
  BRIBE_DISPOSITION_FLOOR,
  BRIBE_RANK_MULT,
  DISPOSITION_BEFRIEND_BONUS,
  DISPOSITION_FAIL_PENALTY,
  DISPOSITION_GIFT_DIVISOR,
  DISPOSITION_MAX,
  DISPOSITION_MIN,
  FOLLOWER_MOMENTUM,
  RANK_GAP_BONUS,
  RANK_GAP_PENALTY,
  RIVAL_ALIGNED_PENALTY,
} from "../core/constants";
import type { Npc } from "../core/types";

export interface Persuader {
  persuasion: number;
  rank: number;
  followerCount: number;
}

export function clampDisposition(v: number): number {
  return Math.max(DISPOSITION_MIN, Math.min(DISPOSITION_MAX, v));
}

// Probability (0..100) that a befriend attempt succeeds.
export function befriendChance(p: Persuader, npc: Npc): number {
  let score = p.persuasion;
  score += p.followerCount * FOLLOWER_MOMENTUM;
  score += npc.disposition * DISPOSITION_BEFRIEND_BONUS;
  const rankDelta = npc.rank - p.rank;
  if (rankDelta > 0) score -= rankDelta * RANK_GAP_PENALTY;
  else score += -rankDelta * RANK_GAP_BONUS;
  if (npc.allegiance === "rival") score -= RIVAL_ALIGNED_PENALTY;
  const chance = 50 + score - BEFRIEND_BASE_DIFFICULTY;
  return Math.max(2, Math.min(95, chance));
}

export interface BefriendResult {
  success: boolean;
  chance: number;
}

export function attemptBefriend(p: Persuader, npc: Npc, roll: number): BefriendResult {
  const chance = befriendChance(p, npc);
  const success = roll * 100 < chance;
  if (success) {
    npc.allegiance = "player";
    npc.order = "follow";
    npc.hostile = false;
    npc.disposition = clampDisposition(npc.disposition + 20);
  } else {
    npc.disposition = clampDisposition(npc.disposition - DISPOSITION_FAIL_PENALTY);
  }
  return { success, chance };
}

export function bribeCost(npc: Npc): number {
  return BRIBE_BASE_COST + npc.rank * BRIBE_RANK_MULT;
}

export type BribeOutcome = "success" | "too_hostile" | "cannot_afford";

export function attemptBribe(gold: number, npc: Npc): { outcome: BribeOutcome; cost: number } {
  const cost = bribeCost(npc);
  if (npc.disposition < BRIBE_DISPOSITION_FLOOR) return { outcome: "too_hostile", cost };
  if (gold < cost) return { outcome: "cannot_afford", cost };
  npc.allegiance = "player";
  npc.order = "follow";
  npc.hostile = false;
  npc.disposition = clampDisposition(npc.disposition + 10);
  return { outcome: "success", cost };
}

export function giveGift(npc: Npc, giftValue: number): number {
  const gain = Math.round(giftValue / DISPOSITION_GIFT_DIVISOR);
  npc.disposition = clampDisposition(npc.disposition + gain);
  return gain;
}
