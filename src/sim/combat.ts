import { YIELD_THRESHOLD } from "../core/constants";
import type { Npc } from "../core/types";
import type { Rng } from "../core/rng";

export function strikeDamage(baseAttack: number, weaponBonus: number, rng: Rng): number {
  const variance = 0.8 + rng() * 0.4;
  return Math.max(1, Math.round((baseAttack + weaponBonus) * variance));
}

export function npcShouldYield(npc: Npc): boolean {
  return npc.hp > 0 && npc.hp / npc.maxHp <= YIELD_THRESHOLD;
}
