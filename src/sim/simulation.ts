import {
  NPC_FIGHT_CHANCE,
  NPC_FLEE_HEALTH,
  NPC_TRAVEL_SPEED,
  NPC_WANDER_CHANCE,
  PALACE_ZX,
  PALACE_ZY,
  RIVAL_MAX_FOLLOWERS,
  RIVAL_RECRUIT_SECONDS,
  RUMOR_SECONDS,
  SIM_TICK_SECONDS,
  WANDER_RADIUS,
  WORLD_H,
  WORLD_W,
} from "../core/constants";
import type { Npc } from "../core/types";
import { pick } from "../core/rng";
import { resolveOffscreenFight } from "./combat";
import { advancePlan, planRoute } from "./pathing";
import type { Game } from "./game";

// The living world: every heartbeat, off-screen NPCs wander between
// districts, brawl, heal, and Lord Ishido gathers his own retinue. Every
// state change worth knowing about is pushed to the ticker.
export class Simulation {
  private tickTimer = 0;
  private rivalTimer = 0;
  private rumorTimer = 0;

  update(game: Game, dt: number): void {
    if (game.phase === "won" || game.phase === "lost") return;
    this.tickTimer += dt;
    this.rivalTimer += dt;
    this.rumorTimer += dt;
    while (this.tickTimer >= SIM_TICK_SECONDS) {
      this.tickTimer -= SIM_TICK_SECONDS;
      this.tick(game);
    }
    if (this.rivalTimer >= RIVAL_RECRUIT_SECONDS) {
      this.rivalTimer = 0;
      this.rivalRecruit(game);
    }
    if (game.phase === "quest" && this.rumorTimer >= RUMOR_SECONDS) {
      this.rumorTimer = 0;
      const hint = game.sacredHint();
      if (hint) game.ticker(hint, "rumor");
    }
  }

  tick(game: Game): void {
    const rng = game.rng;
    for (const npc of game.npcs) {
      if (!npc.alive) continue;
      // Visible NPCs (player's 3x3 neighborhood) are walked per-frame by the
      // renderer loop; the sim only advances the ones nobody can see.
      const visible = Math.abs(npc.zx - game.zx) <= 1 && Math.abs(npc.zy - game.zy) <= 1;
      if (npc.plan) {
        npc.plan.ticksLeft--;
        if (npc.plan.ticksLeft <= 0) {
          npc.plan = null; // stuck or stale — give up and re-decide later
        } else if (!visible) {
          advancePlan(npc, NPC_TRAVEL_SPEED * SIM_TICK_SECONDS);
        }
      } else if (
        npc.allegiance !== "player" &&
        !npc.yielded &&
        rng() < NPC_WANDER_CHANCE
      ) {
        this.startJourney(game, npc);
      }
      // Wounded NPCs slowly recover between encounters.
      if (npc.hp < npc.maxHp && !visible) {
        npc.hp = Math.min(npc.maxHp, npc.hp + 1);
        if (npc.yielded && npc.hp / npc.maxHp > NPC_FLEE_HEALTH) npc.yielded = false;
      }
    }
    this.maybeFight(game);
  }

  // Pick a destination district a short walk away and start walking there.
  private startJourney(game: Game, npc: Npc): void {
    const candidates: { zx: number; zy: number }[] = [];
    for (let dy = -WANDER_RADIUS; dy <= WANDER_RADIUS; dy++) {
      for (let dx = -WANDER_RADIUS; dx <= WANDER_RADIUS; dx++) {
        const zx = npc.zx + dx;
        const zy = npc.zy + dy;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist === 0 || dist > WANDER_RADIUS) continue;
        if (zx < 0 || zx >= WORLD_W || zy < 0 || zy >= WORLD_H) continue;
        if (zx === PALACE_ZX && zy === PALACE_ZY) continue;
        candidates.push({ zx, zy });
      }
    }
    if (candidates.length === 0) return;
    const dest = pick(game.rng, candidates);
    const p = game.world.randomWalkableTile(dest.zx, dest.zy, game.rng);
    npc.plan = planRoute(npc, dest.zx, dest.zy, p.lx, p.ly);
  }

  private maybeFight(game: Game): void {
    if (game.rng() >= NPC_FIGHT_CHANCE * 10) return;
    // Find a district (away from the player) holding two NPCs with a grudge.
    const byZone = new Map<string, Npc[]>();
    for (const npc of game.npcs) {
      if (!npc.alive || npc.yielded) continue;
      if (npc.zx === game.zx && npc.zy === game.zy) continue;
      const key = `${npc.zx},${npc.zy}`;
      const arr = byZone.get(key) ?? [];
      arr.push(npc);
      byZone.set(key, arr);
    }
    const contested = [...byZone.values()].filter(
      (arr) =>
        arr.length >= 2 &&
        arr.some((n) => n.hostile || n.allegiance === "rival") &&
        arr.some((n) => !(n.hostile || n.allegiance === "rival")),
    );
    if (contested.length === 0) return;
    const zone = pick(game.rng, contested);
    const aggressor = pick(
      game.rng,
      zone.filter((n) => n.hostile || n.allegiance === "rival"),
    );
    const victim = pick(
      game.rng,
      zone.filter((n) => n !== aggressor && !(n.hostile || n.allegiance === "rival")),
    );
    const result = resolveOffscreenFight(aggressor, victim, game.rng);
    if (result.loserDied) {
      game.ticker(`${result.winner.name} has slain ${result.loser.name}!`, "bad");
      game.bus.emit("npcDied", { id: result.loser.id });
      if (result.loser.allegiance === "player") {
        game.bus.emit("followerChange", { count: game.followerCount });
      }
    } else {
      game.ticker(`${aggressor.name} attacks ${victim.name} in ${game.world.district(aggressor.zx, aggressor.zy).name}.`, "info");
    }
  }

  private rivalRecruit(game: Game): void {
    if (game.rivalFollowerCount() >= RIVAL_MAX_FOLLOWERS) return;
    const ishido = game.npcs.find((n) => n.isRivalLeader && n.alive);
    if (!ishido) return;
    const candidates = game.npcs.filter(
      (n) => n.alive && !n.isRivalLeader && n.allegiance === "none" && !n.hostile,
    );
    if (candidates.length === 0) return;
    const target = pick(game.rng, candidates);
    target.allegiance = "rival";
    game.bus.emit("npcAllegiance", { id: target.id });
    game.ticker(`Lord Ishido has recruited ${target.name} to his banner.`, "bad");
  }
}
