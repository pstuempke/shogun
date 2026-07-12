import { OFFSCREEN_FIGHT_SWING, YIELD_THRESHOLD } from "../core/constants";
import type { Npc } from "../core/types";
import type { Rng } from "../core/rng";

export function strikeDamage(baseAttack: number, weaponBonus: number, rng: Rng): number {
  const variance = 0.8 + rng() * 0.4;
  return Math.max(1, Math.round((baseAttack + weaponBonus) * variance));
}

export function npcShouldYield(npc: Npc): boolean {
  return npc.hp > 0 && npc.hp / npc.maxHp <= YIELD_THRESHOLD;
}

export interface OffscreenFightResult {
  winner: Npc;
  loser: Npc;
  loserDied: boolean;
}

// Resolves an off-screen skirmish between two roaming NPCs. Losers usually
// survive wounded and flee; a badly outmatched loser can die.
export function resolveOffscreenFight(a: Npc, b: Npc, rng: Rng): OffscreenFightResult {
  const scoreA = a.attack * (0.5 + rng()) + a.hp * 0.1;
  const scoreB = b.attack * (0.5 + rng()) + b.hp * 0.1;
  const winner = scoreA >= scoreB ? a : b;
  const loser = winner === a ? b : a;
  const damage = Math.round(winner.attack * (1 + rng()) + rng() * OFFSCREEN_FIGHT_SWING);
  loser.hp -= damage;
  const loserDied = loser.hp <= 0;
  if (loserDied) {
    loser.hp = 0;
    loser.alive = false;
  }
  return { winner, loser, loserDied };
}
