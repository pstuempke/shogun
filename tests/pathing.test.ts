import { describe, expect, it } from "vitest";
import { advancePlan, planRoute, worldX, worldY } from "../src/sim/pathing";
import { Game } from "../src/sim/game";
import { Simulation } from "../src/sim/simulation";
import {
  NPC_TRAVEL_SPEED,
  PALACE_ZX,
  PALACE_ZY,
  SIM_TICK_SECONDS,
  WORLD_H,
  WORLD_W,
  ZONE_SIZE,
} from "../src/core/constants";
import type { Npc } from "../src/core/types";

function walker(zx: number, zy: number, lx = 20, ly = 20): Npc {
  return {
    id: 0,
    name: "Walker",
    role: "peasant",
    rank: 0,
    zx,
    zy,
    lx,
    ly,
    hp: 70,
    maxHp: 70,
    attack: 5,
    disposition: 0,
    allegiance: "none",
    order: "follow",
    alive: true,
    hostile: false,
    yielded: false,
    isRivalLeader: false,
    carrying: null,
    plan: null,
    memories: [],
  };
}

describe("planRoute", () => {
  it("chains waypoints through adjacent districts only", () => {
    const plan = planRoute({ zx: 0, zy: 0, lx: 20, ly: 20 }, 4, 5, 10, 10);
    let prev = { zx: 0, zy: 0 };
    for (const wp of plan.waypoints) {
      const step = Math.abs(wp.zx - prev.zx) + Math.abs(wp.zy - prev.zy);
      expect(step).toBeLessThanOrEqual(1);
      prev = wp;
    }
    const last = plan.waypoints[plan.waypoints.length - 1];
    expect([last.zx, last.zy, last.lx, last.ly]).toEqual([4, 5, 10, 10]);
  });

  it("never routes through the palace district unless it is the destination", () => {
    // Cross the top row, right past the palace at (3,0).
    const plan = planRoute({ zx: 1, zy: 0, lx: 20, ly: 20 }, 5, 0, 10, 10);
    for (const wp of plan.waypoints) {
      expect(wp.zx === PALACE_ZX && wp.zy === PALACE_ZY).toBe(false);
    }
    const direct = planRoute({ zx: 2, zy: 0, lx: 20, ly: 20 }, PALACE_ZX, PALACE_ZY, 10, 10);
    const last = direct.waypoints[direct.waypoints.length - 1];
    expect([last.zx, last.zy]).toEqual([PALACE_ZX, PALACE_ZY]);
  });
});

describe("advancePlan — walking, never teleporting", () => {
  it("moves at most the requested distance per call", () => {
    const npc = walker(0, 0);
    npc.plan = planRoute(npc, 6, 6, 20, 20);
    let guard = 0;
    while (npc.plan && guard++ < 500) {
      const bx = worldX(npc);
      const by = worldY(npc);
      advancePlan(npc, 9);
      const moved = Math.hypot(worldX(npc) - bx, worldY(npc) - by);
      expect(moved).toBeLessThanOrEqual(9 + 1e-6);
    }
    expect(npc.plan).toBeNull();
    expect(npc.zx).toBe(6);
    expect(npc.zy).toBe(6);
  });

  it("keeps local coordinates normalized to the containing district", () => {
    const npc = walker(2, 2);
    npc.plan = planRoute(npc, 4, 2, 20, 20);
    while (npc.plan) {
      advancePlan(npc, 5);
      expect(npc.lx).toBeGreaterThanOrEqual(0);
      expect(npc.lx).toBeLessThanOrEqual(ZONE_SIZE);
      expect(npc.ly).toBeGreaterThanOrEqual(0);
      expect(npc.ly).toBeLessThanOrEqual(ZONE_SIZE);
    }
  });
});

describe("Simulation travel", () => {
  it("NPCs never jump more than one tick's walk, ever", () => {
    const g = new Game("samurai", false, 99);
    const sim = new Simulation();
    const maxStep = NPC_TRAVEL_SPEED * SIM_TICK_SECONDS + 1e-6;
    for (let t = 0; t < 500; t++) {
      const before = g.npcs.map((n) => [worldX(n), worldY(n)]);
      sim.tick(g);
      g.npcs.forEach((n, i) => {
        const moved = Math.hypot(worldX(n) - before[i][0], worldY(n) - before[i][1]);
        expect(moved).toBeLessThanOrEqual(maxStep);
      });
    }
  });

  it("NPCs still spread across the map over time", () => {
    const g = new Game("samurai", false, 99);
    const sim = new Simulation();
    const before = g.npcs.map((n) => `${n.zx},${n.zy}`).join("|");
    for (let t = 0; t < 200; t++) sim.tick(g);
    expect(g.npcs.map((n) => `${n.zx},${n.zy}`).join("|")).not.toBe(before);
  });

  it("no NPC wanders into the palace district", () => {
    const g = new Game("samurai", false, 99);
    const sim = new Simulation();
    for (let t = 0; t < 400; t++) {
      sim.tick(g);
      for (const n of g.npcs) {
        expect(n.zx >= 0 && n.zx < WORLD_W && n.zy >= 0 && n.zy < WORLD_H).toBe(true);
        expect(n.zx === PALACE_ZX && n.zy === PALACE_ZY).toBe(false);
      }
    }
  });

  it("travel is deterministic per seed", () => {
    const run = (): string => {
      const g = new Game("samurai", false, 1234);
      const sim = new Simulation();
      for (let t = 0; t < 100; t++) sim.tick(g);
      return g.npcs.map((n) => `${n.zx},${n.zy},${n.lx.toFixed(2)},${n.ly.toFixed(2)}`).join("|");
    };
    expect(run()).toBe(run());
  });

  it("the ticker no longer reports routine travel", () => {
    const g = new Game("samurai", false, 99);
    const events: string[] = [];
    g.bus.on("ticker", (e) => events.push(e.text));
    const sim = new Simulation();
    for (let t = 0; t < 200; t++) sim.tick(g);
    expect(events.filter((e) => e.includes("travels"))).toHaveLength(0);
  });
});

describe("Game clock", () => {
  it("counts in-game days from elapsed time", () => {
    const g = new Game("samurai", false, 99);
    expect(g.day).toBe(1);
    g.elapsed = 121;
    expect(g.day).toBe(2);
  });
});
