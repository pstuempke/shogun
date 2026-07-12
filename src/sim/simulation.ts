import {
  GOSSIP_CHANCE,
  NPC_FLEE_HEALTH,
  NPC_TRAVEL_SPEED,
  RIVAL_MAX_FOLLOWERS,
  RIVAL_RECRUIT_SECONDS,
  RIVAL_TICKER_MILESTONE,
  SIM_TICK_SECONDS,
} from "../core/constants";
import type { Npc } from "../core/types";
import { pick } from "../core/rng";
import { decide, driftNeeds, processBehavior } from "./brain";
import { fightOf, fightTick } from "./fights";
import { gossip } from "./memory";
import { advancePlan } from "./pathing";
import type { Game } from "./game";

// The living world: every heartbeat, off-screen NPCs wander between
// districts, brawl, heal, and Lord Ishido gathers his own retinue. Every
// state change worth knowing about is pushed to the ticker.
export class Simulation {
  private tickTimer = 0;
  private rivalTimer = 0;
  private rivalRecruitCount = 0;

  update(game: Game, dt: number): void {
    if (game.phase === "won" || game.phase === "lost") return;
    this.tickTimer += dt;
    this.rivalTimer += dt;
    while (this.tickTimer >= SIM_TICK_SECONDS) {
      this.tickTimer -= SIM_TICK_SECONDS;
      this.tick(game);
    }
    if (this.rivalTimer >= RIVAL_RECRUIT_SECONDS) {
      this.rivalTimer = 0;
      this.rivalRecruit(game);
    }
  }

  tick(game: Game): void {
    for (const npc of game.npcs) {
      if (!npc.alive) continue;
      if (npc.chatCooldown > 0) npc.chatCooldown--;
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
      }
      // The utility brain drives everyone who isn't sworn to the player
      // and isn't currently in a brawl (the fight system owns those).
      if (npc.allegiance !== "player" && !npc.yielded && !fightOf(game, npc.id)) {
        driftNeeds(npc.needs, npc.traits);
        if (npc.behavior) processBehavior(game, npc);
        else if (!npc.plan) decide(game, npc);
      }
      // Wounded NPCs slowly recover between encounters.
      if (npc.hp < npc.maxHp && !visible && !fightOf(game, npc.id)) {
        npc.hp = Math.min(npc.maxHp, npc.hp + 1);
        if (npc.yielded && npc.hp / npc.maxHp > NPC_FLEE_HEALTH) npc.yielded = false;
      }
    }
    fightTick(game);
    this.maybeGossip(game);
  }

  // Until proper chats arrive (WP3), NPCs sharing a district swap news
  // opportunistically — this is how treasure sightings travel the map.
  private maybeGossip(game: Game): void {
    if (game.rng() >= GOSSIP_CHANCE) return;
    const byZone = new Map<string, Npc[]>();
    for (const npc of game.npcs) {
      if (!npc.alive) continue;
      const key = `${npc.zx},${npc.zy}`;
      const arr = byZone.get(key) ?? [];
      arr.push(npc);
      byZone.set(key, arr);
    }
    const crowded = [...byZone.values()].filter((arr) => arr.length >= 2);
    if (crowded.length === 0) return;
    const zone = pick(game.rng, crowded);
    const a = pick(game.rng, zone);
    const b = pick(
      game.rng,
      zone.filter((n) => n !== a),
    );
    gossip(a, b);
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
    game.witness("recruit", ishido.id, target.id, target.zx, target.zy);
    this.rivalRecruitCount++;
    if (this.rivalRecruitCount % RIVAL_TICKER_MILESTONE === 1) {
      game.ticker(
        `Word spreads: Lord Ishido's banner grows — ${game.rivalFollowerCount()} now follow him.`,
        "bad",
      );
    }
  }
}
