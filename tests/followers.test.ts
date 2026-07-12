import { describe, expect, it } from "vitest";
import { Game } from "../src/sim/game";
import { Simulation } from "../src/sim/simulation";
import { fightOf } from "../src/sim/fights";

function makeFollower(g: Game, filter?: (n: (typeof g.npcs)[number]) => boolean): (typeof g.npcs)[number] {
  const npc = g.npcs.find((n) => n.alive && !n.isRivalLeader && (!filter || filter(n)))!;
  npc.allegiance = "player";
  npc.order = "follow";
  return npc;
}

describe("Order: attack", () => {
  it("opens a fight with the follower as aggressor and sours the target", () => {
    const g = new Game("samurai", false, 19);
    const follower = makeFollower(g, (n) => n.role === "samurai");
    const target = g.npcs.find((n) => n.alive && n.allegiance === "none" && n !== follower)!;
    target.zx = follower.zx = g.zx;
    target.zy = follower.zy = g.zy;
    const dispBefore = target.disposition;
    const msg = g.orderAttack(follower, target);
    expect(msg).toContain("draws steel");
    const fight = fightOf(g, follower.id)!;
    expect(fight.sideA).toContain(follower.id);
    expect(fight.sideB).toContain(target.id);
    expect(target.disposition).toBeLessThan(dispBefore);
  });

  it("refuses to attack another follower", () => {
    const g = new Game("samurai", false, 19);
    const a = makeFollower(g);
    const b = makeFollower(g, (n) => n !== a);
    expect(g.orderAttack(a, b)).toContain("your own");
    expect(fightOf(g, a.id)).toBeNull();
  });
});

describe("Order: envoy", () => {
  function setup(): { g: Game; envoy: Npc; target: Npc } {
    const g = new Game("noble", false, 23);
    // Park the player in a corner so the errand happens off-screen.
    g.zx = 0;
    g.zy = 0;
    const envoy = makeFollower(g, (n) => n.rank >= 3);
    envoy.zx = 5;
    envoy.zy = 5;
    const target = g.npcs.find((n) => n.alive && n.allegiance === "none" && n.rank <= 1 && !n.hostile)!;
    target.zx = 6;
    target.zy = 6;
    target.disposition = 80;
    target.plan = null;
    target.behavior = { kind: "rest", until: 999, partnerId: -1 }; // stay put
    return { g, envoy, target };
  }
  type Npc = Game["npcs"][number];

  it("travels to the target, attempts persuasion, and heads home", () => {
    const { g, envoy, target } = setup();
    const msg = g.sendEnvoy(envoy, target);
    expect(msg).toContain("departs");
    expect(envoy.mission?.stage).toBe("travel");
    expect(envoy.order).toBe("wait");
    const sim = new Simulation();
    let recruited = false;
    for (let t = 0; t < 500 && !recruited; t++) {
      sim.tick(g);
      target.behavior = { kind: "rest", until: 999, partnerId: -1 }; // pin the target
      recruited = target.allegiance === "player";
      // A single attempt can fail on the dice — send the envoy back out.
      if (!recruited && (!envoy.mission || envoy.mission.stage === "return")) {
        envoy.mission = null;
        g.sendEnvoy(envoy, target);
      }
      if (g.phase !== "gathering") break;
    }
    expect(recruited).toBe(true);
    expect(envoy.mission === null || envoy.mission.stage === "return").toBe(true);
    // The new recruit walks toward the player rather than teleporting.
    expect(target.plan === null || target.plan.waypoints.length > 0).toBe(true);
  });

  it("a follower cannot run two errands at once", () => {
    const { g, envoy, target } = setup();
    g.sendEnvoy(envoy, target);
    const other = g.npcs.find((n) => n.alive && n.allegiance === "none" && n !== target)!;
    expect(g.sendEnvoy(envoy, other)).toContain("already");
  });
});
