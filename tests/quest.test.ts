import { describe, expect, it } from "vitest";
import { finalScore, questComplete, readyForAudience, sacredItemDistricts } from "../src/sim/quest";
import { FOLLOWERS_TO_WIN, PALACE_ZX, PALACE_ZY, SACRED_ITEM_COUNT } from "../src/core/constants";
import { mulberry32 } from "../src/core/rng";
import type { Item } from "../src/core/types";

function sacredItem(idx: number, heldBy: Item["heldBy"]): Item {
  return {
    id: 100 + idx,
    kind: "sacred",
    name: `Treasure ${idx}`,
    value: 0,
    zx: 0,
    zy: 0,
    lx: 0,
    ly: 0,
    heldBy,
    sacredIndex: idx,
  };
}

describe("phase gate", () => {
  it("requires exactly the follower quota for an audience", () => {
    expect(readyForAudience(FOLLOWERS_TO_WIN - 1)).toBe(false);
    expect(readyForAudience(FOLLOWERS_TO_WIN)).toBe(true);
  });
});

describe("sacred item placement", () => {
  it("places four treasures in distinct districts far from the palace", () => {
    const spots = sacredItemDistricts(mulberry32(7));
    expect(spots).toHaveLength(SACRED_ITEM_COUNT);
    const keys = new Set(spots.map((s) => `${s.zx},${s.zy}`));
    expect(keys.size).toBe(SACRED_ITEM_COUNT);
    for (const s of spots) {
      expect(Math.abs(s.zx - PALACE_ZX) + Math.abs(s.zy - PALACE_ZY)).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("quest completion — all four must be carried simultaneously", () => {
  it("is incomplete with three carried and one in the world", () => {
    const items = [
      sacredItem(0, "player"),
      sacredItem(1, "player"),
      sacredItem(2, "player"),
      sacredItem(3, "world"),
    ];
    expect(questComplete(items)).toBe(false);
  });

  it("is complete with all four carried", () => {
    const items = [0, 1, 2, 3].map((i) => sacredItem(i, "player"));
    expect(questComplete(items)).toBe(true);
  });
});

describe("scoring", () => {
  it("multiplies by the class coefficient", () => {
    const base = { followers: 20, gold: 100, sacredDelivered: 4, elapsedSeconds: 3000 };
    const peasant = finalScore({ ...base, classMultiplier: 5 });
    const noble = finalScore({ ...base, classMultiplier: 1 });
    expect(peasant).toBe(noble * 5);
  });

  it("rewards faster completions", () => {
    const base = { followers: 20, gold: 0, sacredDelivered: 4, classMultiplier: 1 };
    const fast = finalScore({ ...base, elapsedSeconds: 300 });
    const slow = finalScore({ ...base, elapsedSeconds: 3200 });
    expect(fast).toBeGreaterThan(slow);
  });
});
