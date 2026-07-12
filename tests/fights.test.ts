import { describe, expect, it } from "vitest";
import { fightOf, fightTick, startFight } from "../src/sim/fights";
import { decide, processBehavior } from "../src/sim/brain";
import { getAffinity, shiftAffinity } from "../src/sim/social";
import { Game } from "../src/sim/game";
import { Simulation } from "../src/sim/simulation";
import { FIGHT_MAX_TICKS, FOLLOWERS_TO_WIN } from "../src/core/constants";
import type { Npc } from "../src/core/types";

function colocate(_g: Game, npcs: Npc[], zx: number, zy: number): void {
  let lx = 20;
  for (const n of npcs) {
    n.zx = zx;
    n.zy = zy;
    n.lx = lx;
    n.ly = 20;
    n.plan = null;
    n.behavior = null;
    lx += 2;
  }
}

function bandit(g: Game): Npc {
  return g.npcs.find((n) => n.role === "bandit")!;
}

function civilian(g: Game): Npc {
  return g.npcs.find((n) => n.role === "peasant")!;
}

describe("startFight", () => {
  it("creates a fight, sours the pair, and bystanders remember it", () => {
    const g = new Game("samurai", false, 12);
    const b = bandit(g);
    const v = civilian(g);
    const bystander = g.npcs.find((n) => n.role === "merchant")!;
    colocate(g, [b, v, bystander], 4, 4);
    const affBefore = getAffinity(g.affinities, b.id, v.id);
    const fight = startFight(g, b, v);
    expect(fight).not.toBeNull();
    expect(fightOf(g, b.id)).toBe(fight);
    expect(getAffinity(g.affinities, b.id, v.id)).toBeLessThan(affBefore);
    expect(bystander.memories.some((m) => m.kind === "fight" && m.subjectId === b.id)).toBe(true);
    expect(bystander.needs.safety).toBeGreaterThan(0);
  });

  it("brave friends of the victim intervene; cowards do not", () => {
    const g = new Game("samurai", false, 12);
    const b = bandit(g);
    const v = civilian(g);
    const hero = g.npcs.find((n) => n.role === "samurai")!;
    const coward = g.npcs.find((n) => n.role === "merchant")!;
    hero.traits.brave = 1.0;
    coward.traits.brave = 0.0;
    colocate(g, [b, v, hero, coward], 4, 4);
    shiftAffinity(g.affinities, hero.id, v.id, 60);
    const fight = startFight(g, b, v)!;
    expect(fight.sideB).toContain(hero.id);
    expect(fight.sideB).not.toContain(coward.id);
  });

  it("no duplicate fights for the same NPC", () => {
    const g = new Game("samurai", false, 12);
    const b = bandit(g);
    const v = civilian(g);
    colocate(g, [b, v], 4, 4);
    expect(startFight(g, b, v)).not.toBeNull();
    expect(startFight(g, b, v)).toBeNull();
  });
});

describe("fightTick", () => {
  it("resolves over multiple ticks with someone yielding", () => {
    const g = new Game("samurai", false, 12);
    const b = bandit(g);
    const v = civilian(g);
    colocate(g, [b, v], 4, 4);
    startFight(g, b, v);
    let ticks = 0;
    while (g.fights.length > 0 && ticks++ < FIGHT_MAX_TICKS + 2) fightTick(g);
    expect(g.fights).toHaveLength(0);
    expect(v.yielded || !v.alive || b.yielded || !b.alive).toBe(true);
    expect(ticks).toBeGreaterThan(1);
  });

  it("an intervening samurai can turn the tide", () => {
    const g = new Game("samurai", false, 12);
    const b = bandit(g);
    const v = civilian(g);
    const hero = g.npcs.find((n) => n.role === "samurai")!;
    hero.traits.brave = 1.0;
    colocate(g, [b, v, hero], 4, 4);
    shiftAffinity(g.affinities, hero.id, v.id, 80);
    const fight = startFight(g, b, v)!;
    expect(fight.sideB).toContain(hero.id);
    expect(fight.sideB.length).toBeGreaterThanOrEqual(2);
    let guard = 0;
    while (g.fights.length > 0 && guard++ < FIGHT_MAX_TICKS + 2) fightTick(g);
    // Two-on-one: the bandit should be the one beaten down.
    expect(b.yielded || !b.alive).toBe(true);
  });
});

describe("bandit aggression via the brain", () => {
  it("a hungry bandit stalks and attacks a nearby civilian", () => {
    const g = new Game("samurai", false, 12);
    const b = bandit(g);
    const v = civilian(g);
    colocate(g, [b, v], 4, 4);
    v.lx = b.lx + 1.5; // within striking range
    b.needs.purpose = 100;
    b.needs.rest = 0;
    b.needs.social = 0;
    for (let i = 0; i < 10 && b.behavior?.kind !== "aggress"; i++) {
      b.behavior = null;
      decide(g, b);
    }
    // The brain chooses to hunt (whichever prey is nearest)...
    expect(b.behavior?.kind).toBe("aggress");
    // ...and pursuing a victim in striking range starts the fight.
    b.behavior = { kind: "aggress", until: 20, partnerId: v.id };
    processBehavior(g, b);
    expect(fightOf(g, b.id)).not.toBeNull();
    expect(fightOf(g, v.id)).not.toBeNull();
  });
});

describe("living world integration", () => {
  it("fights break out on their own over time", () => {
    const g = new Game("samurai", false, 13);
    const sim = new Simulation();
    let sawFight = false;
    for (let t = 0; t < 800 && !sawFight; t++) {
      sim.tick(g);
      sawFight = g.npcs.some((n) => n.memories.some((m) => m.kind === "fight"));
    }
    expect(sawFight).toBe(true);
  });

  it("the recruitable pool stays viable through the chaos", () => {
    const g = new Game("samurai", false, 13);
    const sim = new Simulation();
    for (let t = 0; t < 800; t++) sim.tick(g);
    expect(g.recruitablePool).toBeGreaterThanOrEqual(FOLLOWERS_TO_WIN);
    expect(g.phase).toBe("gathering");
  });
});
