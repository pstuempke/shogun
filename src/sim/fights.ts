import {
  FIGHT_AFFINITY_HIT,
  FIGHT_DAMAGE_SCALE,
  FIGHT_DEATH_CHANCE,
  FIGHT_MAX_TICKS,
  FIGHT_YIELD_AFFINITY_HIT,
  INTERVENE_THRESHOLD,
  YIELD_THRESHOLD,
} from "../core/constants";
import type { Fight, Npc } from "../core/types";
import { pick } from "../core/rng";
import { strikeDamage } from "./combat";
import { getAffinity, shiftAffinity } from "./social";
import type { Game } from "./game";

export function fightOf(game: Game, npcId: number): Fight | null {
  return game.fights.find((f) => f.sideA.includes(npcId) || f.sideB.includes(npcId)) ?? null;
}

// Bystanders may throw themselves into a fresh fight on the victim's side:
// courage plus loyalty to the victim, minus any sympathy for the aggressor.
function interventionScore(game: Game, bystander: Npc, aggressor: Npc, victim: Npc): number {
  return (
    bystander.traits.brave * 50 +
    getAffinity(game.affinities, bystander.id, victim.id) * 0.5 -
    getAffinity(game.affinities, bystander.id, aggressor.id) * 0.5
  );
}

export function startFight(game: Game, aggressor: Npc, victim: Npc): Fight | null {
  if (fightOf(game, aggressor.id) || fightOf(game, victim.id)) return null;
  if (!aggressor.alive || !victim.alive || victim.yielded) return null;
  const fight: Fight = {
    id: game.nextFightId++,
    sideA: [aggressor.id],
    sideB: [victim.id],
    zx: victim.zx,
    zy: victim.zy,
    ticks: 0,
  };
  game.fights.push(fight);
  for (const n of [aggressor, victim]) {
    n.behavior = null;
    n.plan = null;
  }
  shiftAffinity(game.affinities, aggressor.id, victim.id, -FIGHT_AFFINITY_HIT);
  game.witness("fight", aggressor.id, victim.id, fight.zx, fight.zy);

  for (const bystander of game.npcsInZone(fight.zx, fight.zy)) {
    if (bystander === aggressor || bystander === victim) continue;
    if (bystander.yielded || bystander.allegiance === "player") continue;
    if (fightOf(game, bystander.id)) continue;
    if (interventionScore(game, bystander, aggressor, victim) >= INTERVENE_THRESHOLD) {
      fight.sideB.push(bystander.id);
      bystander.behavior = null;
      bystander.plan = null;
      if (fight.zx === game.zx && fight.zy === game.zy) {
        game.ticker(`${bystander.name} rushes to defend ${victim.name}!`, "info");
      }
    }
  }

  const involvesFollower = victim.allegiance === "player";
  if (fight.zx === game.zx && fight.zy === game.zy) {
    game.ticker(`${aggressor.name} draws steel against ${victim.name}!`, "bad");
  } else if (involvesFollower) {
    game.ticker(
      `${aggressor.name} has attacked your follower ${victim.name} in ${game.world.district(fight.zx, fight.zy).name}!`,
      "bad",
    );
  }
  return fight;
}

function removeCombatant(fight: Fight, id: number): void {
  fight.sideA = fight.sideA.filter((n) => n !== id);
  fight.sideB = fight.sideB.filter((n) => n !== id);
}

function living(game: Game, ids: number[]): Npc[] {
  return ids.map((id) => game.npcs[id]).filter((n) => n.alive && !n.yielded);
}

// One round of blows. Each combatant strikes a random living opponent;
// opponents driven below the yield threshold drop out (bandits sometimes
// finish a yielded victim). Fights disband when one side is gone or the
// brawl drags on too long.
export function fightTick(game: Game): void {
  for (const fight of [...game.fights]) {
    fight.ticks++;
    const a = living(game, fight.sideA);
    const b = living(game, fight.sideB);
    if (a.length === 0 || b.length === 0 || fight.ticks > FIGHT_MAX_TICKS) {
      endFight(game, fight);
      continue;
    }
    for (const striker of [...a, ...b]) {
      const foes = living(game, fight.sideA.includes(striker.id) ? fight.sideB : fight.sideA);
      if (foes.length === 0) break;
      const target = pick(game.rng, foes);
      const dmg = Math.max(1, Math.round(strikeDamage(striker.attack, 0, game.rng) * FIGHT_DAMAGE_SCALE));
      target.hp = Math.max(1, target.hp - dmg);
      if (target.hp / target.maxHp <= YIELD_THRESHOLD) {
        target.yielded = true;
        target.hostile = false;
        target.needs.safety = 100;
        removeCombatant(fight, target.id);
        shiftAffinity(game.affinities, striker.id, target.id, -FIGHT_YIELD_AFFINITY_HIT);
        const merciless = striker.role === "bandit" || striker.allegiance === "rival";
        if (merciless && game.rng() < FIGHT_DEATH_CHANCE) {
          game.npcDeath(striker.id, target);
        } else if (fight.zx === game.zx && fight.zy === game.zy) {
          game.ticker(`${target.name} yields to ${striker.name}.`, "info");
        }
      }
    }
  }
}

function endFight(game: Game, fight: Fight): void {
  for (const id of [...fight.sideA, ...fight.sideB]) {
    const npc = game.npcs[id];
    npc.behavior = null;
  }
  game.fights = game.fights.filter((f) => f !== fight);
}
