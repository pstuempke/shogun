import {
  NPC_FIGHT_CHANCE,
  NPC_FLEE_HEALTH,
  NPC_WANDER_CHANCE,
  RIVAL_MAX_FOLLOWERS,
  RIVAL_RECRUIT_SECONDS,
  RUMOR_SECONDS,
  SIM_TICK_SECONDS,
  WORLD_H,
  WORLD_W,
} from "../core/constants";
import type { Npc } from "../core/types";
import { pick } from "../core/rng";
import { resolveOffscreenFight } from "./combat";
import type { Game } from "./game";

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

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
      const onScreen = npc.zx === game.zx && npc.zy === game.zy;
      const travelling = npc.allegiance !== "player" || npc.order === "wait";
      if (!onScreen && travelling && rng() < NPC_WANDER_CHANCE && npc.order !== "guard") {
        this.wander(game, npc);
      }
      // Wounded NPCs slowly recover between encounters.
      if (npc.hp < npc.maxHp && !onScreen) {
        npc.hp = Math.min(npc.maxHp, npc.hp + 1);
        if (npc.yielded && npc.hp / npc.maxHp > NPC_FLEE_HEALTH) npc.yielded = false;
      }
    }
    this.maybeFight(game);
  }

  private wander(game: Game, npc: Npc): void {
    const options = DIRS.filter(
      ([dx, dy]) =>
        npc.zx + dx >= 0 && npc.zx + dx < WORLD_W && npc.zy + dy >= 0 && npc.zy + dy < WORLD_H,
    );
    const [dx, dy] = pick(game.rng, options);
    npc.zx += dx;
    npc.zy += dy;
    const p = game.world.randomWalkableTile(npc.zx, npc.zy, game.rng);
    npc.lx = p.lx;
    npc.ly = p.ly;
    if (npc.rank >= 4 || npc.isRivalLeader) {
      const dir = dy < 0 ? "north" : dy > 0 ? "south" : dx > 0 ? "east" : "west";
      game.ticker(`${npc.name} travels ${dir} to ${game.world.district(npc.zx, npc.zy).name}.`, "info");
    }
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
