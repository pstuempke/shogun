import { describe, expect, it } from "vitest";
import { Game } from "../src/sim/game";
import { Simulation } from "../src/sim/simulation";
import {
  FOLLOWERS_TO_WIN,
  NAMED_NPC_COUNT,
  PALACE_ZX,
  PALACE_ZY,
  SACRED_ITEM_COUNT,
  TEMPLE_ZX,
  TEMPLE_ZY,
} from "../src/core/constants";

describe("Game setup", () => {
  it("spawns the full roster across the map", () => {
    const g = new Game("samurai");
    expect(g.npcs).toHaveLength(NAMED_NPC_COUNT);
    expect(g.npcs.every((n) => n.alive)).toBe(true);
    expect(g.npcs.some((n) => n.isRivalLeader)).toBe(true);
  });

  it("world generation is deterministic for a given seed", () => {
    const a = new Game("noble", false, 42);
    const b = new Game("noble", false, 42);
    expect(a.world.district(2, 2).name).toBe(b.world.district(2, 2).name);
    expect(a.npcs.map((n) => `${n.zx},${n.zy}`)).toEqual(b.npcs.map((n) => `${n.zx},${n.zy}`));
  });

  it("class choice sets the player's stats", () => {
    const p = new Game("peasant");
    const n = new Game("noble");
    expect(p.gold).toBeLessThan(n.gold);
    expect(p.playerClass.scoreMultiplier).toBeGreaterThan(n.playerClass.scoreMultiplier);
  });
});

describe("The two-phase loop", () => {
  function gameWithFollowers(count: number): Game {
    const g = new Game("noble", false, 7);
    for (const npc of g.npcs.filter((n) => !n.isRivalLeader).slice(0, count)) {
      npc.allegiance = "player";
    }
    return g;
  }

  it("the Emperor turns away a player without twenty followers", () => {
    const g = gameWithFollowers(5);
    g.zx = PALACE_ZX;
    g.zy = PALACE_ZY;
    const msg = g.visitEmperor();
    expect(g.phase).toBe("gathering");
    expect(msg).toContain("guards");
  });

  it("twenty followers unlock phase 2 and scatter the sacred treasures", () => {
    const g = gameWithFollowers(FOLLOWERS_TO_WIN);
    const msg = g.visitEmperor();
    expect(g.phase).toBe("quest");
    expect(msg).toContain("treasures");
    const sacred = g.items.filter((i) => i.sacredIndex >= 0);
    expect(sacred).toHaveLength(SACRED_ITEM_COUNT);
    expect(sacred.every((i) => i.heldBy === "world")).toBe(true);
  });

  it("returning with all four treasures wins and scores", () => {
    const g = gameWithFollowers(FOLLOWERS_TO_WIN);
    g.visitEmperor();
    expect(g.visitEmperor()).toContain("0 of 4");
    for (const i of g.items.filter((i) => i.sacredIndex >= 0)) i.heldBy = "player";
    const msg = g.visitEmperor();
    expect(g.phase).toBe("won");
    expect(msg).toContain("SHOGUN");
    expect(g.score).toBeGreaterThan(0);
  });
});

describe("Combat consequences", () => {
  it("an NPC low on health yields instead of dying", () => {
    const g = new Game("ronin", false, 3);
    const npc = g.npcs[20];
    const result = g.damageNpc(npc, npc.maxHp * 0.8);
    expect(result).toBe("yielded");
    expect(npc.yielded).toBe(true);
    expect(npc.hostile).toBe(false);
  });

  it("killing recruits below the winnable pool loses the game", () => {
    const g = new Game("ronin", false, 3);
    const recruitable = g.npcs.filter((n) => !n.isRivalLeader);
    for (const npc of recruitable.slice(0, recruitable.length - FOLLOWERS_TO_WIN + 1)) {
      g.damageNpc(npc, 9999);
    }
    expect(g.phase).toBe("lost");
  });

  it("defeat in normal mode ransoms the player back at the temple", () => {
    const g = new Game("samurai", false, 3);
    g.gold = 100;
    g.damagePlayer(9999);
    expect(g.phase).not.toBe("lost");
    expect(g.hp).toBe(g.maxHp);
    expect(g.gold).toBe(50);
    expect(g.zx).toBe(TEMPLE_ZX);
    expect(g.zy).toBe(TEMPLE_ZY);
  });

  it("defeat in honour mode is permanent", () => {
    const g = new Game("samurai", true, 3);
    g.damagePlayer(9999);
    expect(g.phase).toBe("lost");
  });
});

describe("Living world simulation", () => {
  it("Ishido recruits rivals over time", () => {
    const g = new Game("samurai", false, 11);
    const sim = new Simulation();
    sim.update(g, 41); // one rival recruit interval
    expect(g.rivalFollowerCount()).toBeGreaterThanOrEqual(1);
  });

  it("NPCs wander between districts and the ticker reports movements", () => {
    const g = new Game("samurai", false, 11);
    const before = g.npcs.map((n) => `${n.zx},${n.zy}`).join("|");
    const events: string[] = [];
    g.bus.on("ticker", (e) => events.push(e.text));
    const sim = new Simulation();
    for (let i = 0; i < 30; i++) sim.tick(g);
    const after = g.npcs.map((n) => `${n.zx},${n.zy}`).join("|");
    expect(after).not.toBe(before);
    expect(events.length).toBeGreaterThan(0);
  });
});

describe("Economy", () => {
  it("picking up koban adds gold and consumes the item", () => {
    const g = new Game("peasant", false, 5);
    const pouch = g.items.find((i) => i.kind === "koban")!;
    const before = g.gold;
    g.takeItem(pouch);
    expect(g.gold).toBe(before + pouch.value);
    expect(g.inventory.find((i) => i.id === pouch.id)).toBeUndefined();
  });

  it("a weapon pickup raises attack; dropping it lowers it again", () => {
    const g = new Game("peasant", false, 5);
    const weapon = g.items.find((i) => i.kind === "weapon")!;
    g.takeItem(weapon);
    expect(g.weaponBonus).toBe(weapon.value);
    g.dropItem(weapon);
    expect(g.weaponBonus).toBe(0);
  });
});
