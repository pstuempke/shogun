import { describe, expect, it } from "vitest";
import { attemptBefriend, attemptBribe, befriendChance, bribeCost, giveGift } from "../src/sim/social";
import type { Npc } from "../src/core/types";
import {
  BRIBE_BASE_COST,
  BRIBE_RANK_MULT,
  DISPOSITION_FAIL_PENALTY,
} from "../src/core/constants";

function makeNpc(overrides: Partial<Npc> = {}): Npc {
  return {
    id: 0,
    name: "Test Npc",
    role: "peasant",
    rank: 0,
    zx: 0,
    zy: 0,
    lx: 0,
    ly: 0,
    hp: 70,
    maxHp: 70,
    attack: 6,
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
    traits: { brave: 0.5, gregarious: 0.5, greedy: 0.5, pious: 0.5 },
    needs: { rest: 0, social: 0, purpose: 0, safety: 0 },
    behavior: null,
    chatCooldown: 0,
    mission: null,
    ...overrides,
  };
}

describe("befriendChance — the feudal hierarchy is the difficulty slider", () => {
  it("a noble easily persuades a peasant", () => {
    const chance = befriendChance({ persuasion: 55, rank: 4, followerCount: 0 }, makeNpc());
    expect(chance).toBeGreaterThan(60);
  });

  it("a peasant has near-zero odds against a daimyo", () => {
    const daimyo = makeNpc({ rank: 5, role: "daimyo" });
    const chance = befriendChance({ persuasion: 18, rank: 0, followerCount: 0 }, daimyo);
    expect(chance).toBeLessThanOrEqual(5);
  });

  it("followers add momentum to persuasion", () => {
    const npc = makeNpc({ rank: 3 });
    const alone = befriendChance({ persuasion: 30, rank: 2, followerCount: 0 }, npc);
    const withArmy = befriendChance({ persuasion: 30, rank: 2, followerCount: 15 }, npc);
    expect(withArmy).toBeGreaterThan(alone);
  });

  it("rival-aligned NPCs are harder to sway", () => {
    const free = befriendChance({ persuasion: 40, rank: 3, followerCount: 0 }, makeNpc({ rank: 2 }));
    const sworn = befriendChance(
      { persuasion: 40, rank: 3, followerCount: 0 },
      makeNpc({ rank: 2, allegiance: "rival" }),
    );
    expect(sworn).toBeLessThan(free);
  });

  it("is clamped to a 2..95 percent band", () => {
    const worst = befriendChance({ persuasion: 0, rank: 0, followerCount: 0 }, makeNpc({ rank: 5, disposition: -100 }));
    const best = befriendChance({ persuasion: 99, rank: 4, followerCount: 20 }, makeNpc({ disposition: 100 }));
    expect(worst).toBe(2);
    expect(best).toBe(95);
  });
});

describe("attemptBefriend", () => {
  it("success converts allegiance and boosts disposition", () => {
    const npc = makeNpc({ disposition: 20 });
    const res = attemptBefriend({ persuasion: 55, rank: 4, followerCount: 5 }, npc, 0.01);
    expect(res.success).toBe(true);
    expect(npc.allegiance).toBe("player");
    expect(npc.hostile).toBe(false);
  });

  it("failure lowers disposition", () => {
    const npc = makeNpc({ disposition: 0, rank: 5 });
    const res = attemptBefriend({ persuasion: 10, rank: 0, followerCount: 0 }, npc, 0.99);
    expect(res.success).toBe(false);
    expect(npc.disposition).toBe(-DISPOSITION_FAIL_PENALTY);
  });
});

describe("bribes — gold bypasses the persuasion check", () => {
  it("costs scale with NPC rank", () => {
    expect(bribeCost(makeNpc({ rank: 0 }))).toBe(BRIBE_BASE_COST);
    expect(bribeCost(makeNpc({ rank: 5 }))).toBe(BRIBE_BASE_COST + 5 * BRIBE_RANK_MULT);
  });

  it("succeeds when affordable, converting the NPC", () => {
    const npc = makeNpc();
    const res = attemptBribe(1000, npc);
    expect(res.outcome).toBe("success");
    expect(npc.allegiance).toBe("player");
  });

  it("fails when the player cannot afford it", () => {
    const npc = makeNpc({ rank: 5 });
    expect(attemptBribe(10, npc).outcome).toBe("cannot_afford");
    expect(npc.allegiance).toBe("none");
  });

  it("very hostile NPCs refuse gold entirely", () => {
    const npc = makeNpc({ disposition: -80 });
    expect(attemptBribe(9999, npc).outcome).toBe("too_hostile");
  });
});

describe("gifts", () => {
  it("raise disposition proportional to value and clamp at 100", () => {
    const npc = makeNpc({ disposition: 90 });
    giveGift(npc, 40);
    expect(npc.disposition).toBe(100);
  });
});
