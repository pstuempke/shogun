import {
  CHAT_AFFINITY_GAIN,
  CHAT_COOLDOWN_TICKS,
  CHAT_RANGE,
  CHAT_TICKS,
  FLEE_SAFETY_THRESHOLD,
  IDLE_SCORE,
  NEED_PURPOSE_RATE,
  NEED_REST_RATE,
  NEED_SOCIAL_RATE,
  PALACE_ZX,
  PALACE_ZY,
  REST_HEAL,
  REST_LOW_HP_BONUS,
  REST_TICKS,
  SAFETY_DECAY,
  SOCIALIZE_PATIENCE,
  SOCIAL_MIN_AFFINITY,
  SOCIAL_SEARCH_DISTRICTS,
  WANDER_RADIUS,
  WORK_TICKS,
  WORLD_H,
  WORLD_W,
} from "../core/constants";
import type { BehaviorKind, Biome, Needs, Npc, Traits } from "../core/types";
import { pick } from "../core/rng";
import { getAffinity, shiftAffinity } from "./social";
import { gossip } from "./memory";
import { planRoute, worldX, worldY } from "./pathing";
import type { Game } from "./game";

// Where each role goes to do its work. Roles not listed patrol instead.
const WORK_BIOME: Partial<Record<Npc["role"], Biome>> = {
  peasant: "paddy",
  merchant: "village",
  monk: "temple",
  daimyo: "village",
  noble: "village",
};

export interface ScoredBehavior {
  kind: BehaviorKind;
  score: number;
}

const clampNeed = (v: number): number => Math.max(0, Math.min(100, v));

export function driftNeeds(needs: Needs, traits: Traits): void {
  needs.rest = clampNeed(needs.rest + NEED_REST_RATE);
  needs.social = clampNeed(needs.social + NEED_SOCIAL_RATE * traits.gregarious);
  needs.purpose = clampNeed(needs.purpose + NEED_PURPOSE_RATE);
  needs.safety = clampNeed(needs.safety - SAFETY_DECAY);
}

// Pure scoring: what does this NPC most want to do right now?
export function scoreBehaviors(npc: Npc, partnerAvailable: boolean): ScoredBehavior[] {
  const n = npc.needs;
  const wounded = npc.hp / npc.maxHp < 0.5;
  const scores: ScoredBehavior[] = [
    { kind: "idle", score: IDLE_SCORE },
    { kind: "rest", score: n.rest + (wounded ? REST_LOW_HP_BONUS : 0) },
    { kind: "work", score: n.purpose },
    { kind: "socialize", score: partnerAvailable ? n.social * (0.5 + npc.traits.gregarious) : 0 },
  ];
  if (n.safety >= FLEE_SAFETY_THRESHOLD) {
    scores.push({ kind: "flee", score: n.safety * (1.5 - npc.traits.brave) });
  }
  return scores.sort((a, b) => b.score - a.score);
}

function isFreeForChat(npc: Npc): boolean {
  return (
    npc.alive &&
    !npc.yielded &&
    npc.allegiance !== "player" &&
    npc.chatCooldown <= 0 &&
    (npc.behavior === null || npc.behavior.kind === "idle" || npc.behavior.kind === "work")
  );
}

function findChatPartner(game: Game, npc: Npc): Npc | null {
  let best: Npc | null = null;
  let bestDist = Infinity;
  for (const other of game.npcs) {
    if (other === npc || !isFreeForChat(other)) continue;
    const dist = Math.abs(other.zx - npc.zx) + Math.abs(other.zy - npc.zy);
    if (dist > SOCIAL_SEARCH_DISTRICTS) continue;
    if (getAffinity(game.affinities, npc.id, other.id) < SOCIAL_MIN_AFFINITY) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = other;
    }
  }
  return best;
}

function travelCandidates(npc: Npc): { zx: number; zy: number }[] {
  const out: { zx: number; zy: number }[] = [];
  for (let dy = -WANDER_RADIUS; dy <= WANDER_RADIUS; dy++) {
    for (let dx = -WANDER_RADIUS; dx <= WANDER_RADIUS; dx++) {
      const zx = npc.zx + dx;
      const zy = npc.zy + dy;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist === 0 || dist > WANDER_RADIUS) continue;
      if (zx < 0 || zx >= WORLD_W || zy < 0 || zy >= WORLD_H) continue;
      if (zx === PALACE_ZX && zy === PALACE_ZY) continue;
      out.push({ zx, zy });
    }
  }
  return out;
}

function nearestBiomeDistrict(game: Game, npc: Npc, biome: Biome): { zx: number; zy: number } | null {
  let best: { zx: number; zy: number } | null = null;
  let bestDist = Infinity;
  for (let zy = 0; zy < WORLD_H; zy++) {
    for (let zx = 0; zx < WORLD_W; zx++) {
      if (game.world.district(zx, zy).biome !== biome) continue;
      const dist = Math.abs(zx - npc.zx) + Math.abs(zy - npc.zy);
      if (dist < bestDist) {
        bestDist = dist;
        best = { zx, zy };
      }
    }
  }
  return best;
}

function walkTo(game: Game, npc: Npc, zx: number, zy: number): void {
  if (zx === npc.zx && zy === npc.zy) return;
  const p = game.world.randomWalkableTile(zx, zy, game.rng);
  npc.plan = planRoute(npc, zx, zy, p.lx, p.ly);
}

// Choose and initiate the next behavior for an idle NPC.
export function decide(game: Game, npc: Npc): void {
  const partner = findChatPartner(game, npc);
  const ranked = scoreBehaviors(npc, partner !== null);
  // Soft pick: usually the top choice, sometimes the runner-up.
  const chosen = ranked.length > 1 && game.rng() < 0.25 ? ranked[1] : ranked[0];
  switch (chosen.kind) {
    case "idle":
      npc.behavior = { kind: "idle", until: 2, partnerId: -1 };
      break;
    case "rest":
      npc.behavior = { kind: "rest", until: REST_TICKS, partnerId: -1 };
      break;
    case "flee": {
      const options = travelCandidates(npc);
      if (options.length > 0) {
        const dest = pick(game.rng, options);
        walkTo(game, npc, dest.zx, dest.zy);
      }
      npc.behavior = { kind: "flee", until: SOCIALIZE_PATIENCE, partnerId: -1 };
      npc.needs.safety = 0;
      break;
    }
    case "socialize":
      npc.behavior = { kind: "socialize", until: SOCIALIZE_PATIENCE, partnerId: partner!.id };
      break;
    case "work": {
      const biome = WORK_BIOME[npc.role];
      const dest = biome ? nearestBiomeDistrict(game, npc, biome) : null;
      if (dest) {
        walkTo(game, npc, dest.zx, dest.zy);
      } else {
        // Patrolling roles (samurai, ronin, bandits) roam instead.
        const options = travelCandidates(npc);
        if (options.length > 0) {
          const roam = pick(game.rng, options);
          walkTo(game, npc, roam.zx, roam.zy);
        }
      }
      npc.behavior = { kind: "work", until: WORK_TICKS, partnerId: -1 };
      break;
    }
    case "chat":
      break; // never chosen directly
  }
}

function endChat(game: Game, a: Npc, b: Npc): void {
  shiftAffinity(game.affinities, a.id, b.id, CHAT_AFFINITY_GAIN);
  gossip(a, b);
  a.needs.social = 0;
  b.needs.social = 0;
  a.chatCooldown = CHAT_COOLDOWN_TICKS;
  b.chatCooldown = CHAT_COOLDOWN_TICKS;
  a.behavior = null;
  b.behavior = null;
}

// Advance an active behavior by one sim tick.
export function processBehavior(game: Game, npc: Npc): void {
  const b = npc.behavior;
  if (!b) return;
  // Travelling toward the behavior's destination: the clock starts on arrival
  // (except socialize/flee, whose budget includes the walk).
  const walking = npc.plan !== null;
  switch (b.kind) {
    case "idle":
    case "work":
      if (walking) return;
      b.until--;
      if (b.until <= 0) {
        if (b.kind === "work") npc.needs.purpose = 0;
        npc.behavior = null;
      }
      return;
    case "rest":
      npc.hp = Math.min(npc.maxHp, npc.hp + REST_HEAL);
      b.until--;
      if (b.until <= 0) {
        npc.needs.rest = 0;
        npc.behavior = null;
      }
      return;
    case "flee":
      b.until--;
      if (b.until <= 0 || !walking) npc.behavior = null;
      return;
    case "socialize": {
      const partner = game.npcs[b.partnerId];
      b.until--;
      const partnerGone =
        !partner ||
        !partner.alive ||
        partner.allegiance === "player" ||
        Math.abs(partner.zx - npc.zx) + Math.abs(partner.zy - npc.zy) > SOCIAL_SEARCH_DISTRICTS;
      if (b.until <= 0 || partnerGone) {
        npc.behavior = null;
        return;
      }
      const dist = Math.hypot(worldX(partner) - worldX(npc), worldY(partner) - worldY(npc));
      if (dist <= CHAT_RANGE && isFreeForChat(partner)) {
        npc.plan = null;
        partner.plan = null;
        npc.behavior = { kind: "chat", until: CHAT_TICKS, partnerId: partner.id };
        partner.behavior = { kind: "chat", until: CHAT_TICKS, partnerId: npc.id };
      } else if (!walking) {
        // Partner moved — walk to where they are now.
        npc.plan = planRoute(npc, partner.zx, partner.zy, partner.lx, partner.ly);
      }
      return;
    }
    case "chat": {
      const partner = game.npcs[b.partnerId];
      if (!partner?.alive || partner.behavior?.kind !== "chat") {
        npc.behavior = null;
        return;
      }
      // The lower id drives the shared countdown so it ticks exactly once.
      if (npc.id < partner.id) {
        b.until--;
        if (b.until <= 0) endChat(game, npc, partner);
      }
      return;
    }
  }
}
