import { describe, expect, it } from "vitest";
import { decide, driftNeeds, processBehavior, scoreBehaviors } from "../src/sim/brain";
import { getAffinity } from "../src/sim/social";
import { Game } from "../src/sim/game";
import { Simulation } from "../src/sim/simulation";
import {
  CHAT_COOLDOWN_TICKS,
  FLEE_SAFETY_THRESHOLD,
  NEED_SOCIAL_RATE,
} from "../src/core/constants";
import type { Needs, Npc, Traits } from "../src/core/types";

const TRAITS: Traits = { brave: 0.5, gregarious: 0.5, greedy: 0.5, pious: 0.5 };

function needs(overrides: Partial<Needs> = {}): Needs {
  return { rest: 0, social: 0, purpose: 0, safety: 0, ...overrides };
}

function pickNpc(g: Game, filter: (n: Npc) => boolean): Npc {
  const n = g.npcs.find(filter);
  if (!n) throw new Error("no npc matches");
  return n;
}

function calm(npc: Npc): void {
  npc.needs = needs();
  npc.behavior = null;
  npc.plan = null;
  npc.chatCooldown = 0;
}

describe("driftNeeds", () => {
  it("grows needs over time, scaled by personality, and clamps", () => {
    const shy = needs();
    const outgoing = needs();
    for (let i = 0; i < 20; i++) {
      driftNeeds(shy, { ...TRAITS, gregarious: 0.1 });
      driftNeeds(outgoing, { ...TRAITS, gregarious: 1.0 });
    }
    expect(outgoing.social).toBeCloseTo(20 * NEED_SOCIAL_RATE);
    expect(outgoing.social).toBeGreaterThan(shy.social);
    for (let i = 0; i < 500; i++) driftNeeds(outgoing, TRAITS);
    expect(outgoing.rest).toBe(100);
  });
});

describe("scoreBehaviors", () => {
  const base = (over: Partial<Npc>): Npc =>
    ({
      ...over,
      traits: over.traits ?? TRAITS,
      needs: over.needs ?? needs(),
      hp: over.hp ?? 100,
      maxHp: 100,
    }) as Npc;

  it("wounded NPCs want to rest", () => {
    const hurt = base({ hp: 30, needs: needs({ rest: 10, purpose: 30 }) });
    expect(scoreBehaviors(hurt, false)[0].kind).toBe("rest");
  });

  it("socialize requires an available partner", () => {
    const chatty = base({ needs: needs({ social: 90 }) });
    expect(scoreBehaviors(chatty, true)[0].kind).toBe("socialize");
    expect(scoreBehaviors(chatty, false)[0].kind).not.toBe("socialize");
  });

  it("frightened cowards flee above the safety threshold", () => {
    const coward = base({
      needs: needs({ safety: FLEE_SAFETY_THRESHOLD + 20 }),
      traits: { ...TRAITS, brave: 0.1 },
    });
    expect(scoreBehaviors(coward, false)[0].kind).toBe("flee");
  });
});

describe("decide — role work destinations", () => {
  it("monks head for the temple", () => {
    const g = new Game("samurai", false, 42);
    const monk = pickNpc(g, (n) => n.role === "monk" && !(n.zx === 1 && n.zy === 5));
    calm(monk);
    monk.needs.purpose = 100;
    for (let i = 0; i < 10 && monk.behavior?.kind !== "work"; i++) {
      monk.behavior = null;
      monk.plan = null;
      decide(g, monk);
    }
    expect(monk.behavior?.kind).toBe("work");
    expect(monk.plan).not.toBeNull();
    const last = monk.plan!.waypoints[monk.plan!.waypoints.length - 1];
    expect(g.world.district(last.zx, last.zy).biome).toBe("temple");
  });

  it("peasants work the rice paddies", () => {
    const g = new Game("samurai", false, 42);
    const peasant = pickNpc(g, (n) => n.role === "peasant");
    calm(peasant);
    peasant.needs.purpose = 100;
    for (let i = 0; i < 10 && peasant.behavior?.kind !== "work"; i++) {
      peasant.behavior = null;
      peasant.plan = null;
      decide(g, peasant);
    }
    const dest = peasant.plan
      ? peasant.plan.waypoints[peasant.plan.waypoints.length - 1]
      : { zx: peasant.zx, zy: peasant.zy };
    expect(g.world.district(dest.zx, dest.zy).biome).toBe("paddy");
  });
});

describe("chatting", () => {
  function setupPair(g: Game): [Npc, Npc] {
    const a = g.npcs[16]; // merchants/monks: positive affinity likely
    const b = g.npcs[17];
    for (const n of [a, b]) calm(n);
    b.zx = a.zx;
    b.zy = a.zy;
    b.lx = a.lx + 2;
    b.ly = a.ly;
    a.needs.social = 100;
    return [a, b];
  }

  it("two NPCs meet, chat, gain affinity, and share news", () => {
    const g = new Game("samurai", false, 8);
    const [a, b] = setupPair(g);
    a.memories.push({ day: 1, kind: "fight", subjectId: 3, objectId: 4, zx: 0, zy: 0, secondhand: false });
    const before = getAffinity(g.affinities, a.id, b.id);
    for (let i = 0; i < 10 && a.behavior?.kind !== "socialize"; i++) {
      a.behavior = null;
      decide(g, a);
    }
    expect(a.behavior?.kind).toBe("socialize");
    for (let i = 0; i < 20 && (a.behavior || b.behavior); i++) {
      processBehavior(g, a);
      if (b.behavior) processBehavior(g, b);
    }
    expect(getAffinity(g.affinities, a.id, b.id)).toBeGreaterThan(before);
    expect(b.memories.some((m) => m.kind === "fight" && m.secondhand)).toBe(true);
    expect(a.needs.social).toBe(0);
    expect(a.chatCooldown).toBe(CHAT_COOLDOWN_TICKS);
  });

  it("chat cooldown prevents immediate re-chatting", () => {
    const g = new Game("samurai", false, 8);
    const [a] = setupPair(g);
    a.chatCooldown = CHAT_COOLDOWN_TICKS;
    a.needs.social = 100;
    a.needs.purpose = 0;
    a.needs.rest = 0;
    // With every potential partner on cooldown-free but a itself unable to
    // start (its partner check passes, but partners must also be free), the
    // partner search still works — cooldown gates the *partner*, so make
    // everyone else cooling down too.
    for (const n of g.npcs) n.chatCooldown = CHAT_COOLDOWN_TICKS;
    decide(g, a);
    expect(a.behavior?.kind).not.toBe("socialize");
  });
});

describe("living world integration", () => {
  it("NPCs chat out in the world and relationships move", () => {
    const g = new Game("samurai", false, 31);
    const sim = new Simulation();
    const before = JSON.stringify([...g.affinities.entries()].sort());
    for (let t = 0; t < 400; t++) sim.tick(g);
    expect(JSON.stringify([...g.affinities.entries()].sort())).not.toBe(before);
  });

  it("behavior stays deterministic per seed", () => {
    const run = (): string => {
      const g = new Game("samurai", false, 77);
      const sim = new Simulation();
      for (let t = 0; t < 150; t++) sim.tick(g);
      return g.npcs.map((n) => `${n.zx},${n.zy},${n.behavior?.kind ?? "-"}`).join("|");
    };
    expect(run()).toBe(run());
  });
});
