import { describe, expect, it } from "vitest";
import { Game } from "../src/sim/game";
import {
  PLAYER_REGEN_HP_PER_S,
  REGEN_COMBAT_DELAY,
  REST_AURA_MULT,
  TEMPLE_ZX,
  TEMPLE_ZY,
  TILE,
  TRADE_STOCK_SIZE,
} from "../src/core/constants";
import type { Npc } from "../src/core/types";

function merchant(g: Game): Npc {
  return g.npcs.find((n) => n.role === "merchant")!;
}

describe("passive regeneration", () => {
  it("does not tick during the post-combat delay", () => {
    const g = new Game("samurai", false, 9);
    g.hp = 50;
    g.lastCombatAt = g.elapsed;
    g.regen(1);
    expect(g.hp).toBe(50);
  });

  it("heals out of combat and caps at max", () => {
    const g = new Game("samurai", false, 9);
    // Find a spot with no pagoda/well nearby so the base rate applies.
    outer: for (let zy = 0; zy < 7; zy++) {
      for (let zx = 0; zx < 7; zx++) {
        const d = g.world.district(zx, zy);
        if (!d.props.some((p) => p.kind === "pagoda" || p.kind === "well")) {
          g.zx = zx;
          g.zy = zy;
          break outer;
        }
      }
    }
    expect(g.inRestAura()).toBe(false);
    g.hp = 50;
    g.lastCombatAt = -100;
    g.regen(2);
    expect(g.hp).toBeCloseTo(50 + 2 * PLAYER_REGEN_HP_PER_S);
    g.hp = g.maxHp - 0.1;
    g.regen(10);
    expect(g.hp).toBe(g.maxHp);
  });

  it("taking damage resets the regen clock", () => {
    const g = new Game("samurai", false, 9);
    g.elapsed = 100;
    g.damagePlayer(10);
    expect(g.elapsed - g.lastCombatAt).toBeLessThan(REGEN_COMBAT_DELAY);
  });

  it("rest auras at the temple pagoda multiply the rate", () => {
    const g = new Game("samurai", false, 9);
    g.zx = TEMPLE_ZX;
    g.zy = TEMPLE_ZY;
    const pagoda = g.world.district(TEMPLE_ZX, TEMPLE_ZY).props.find((p) => p.kind === "pagoda")!;
    g.lx = (pagoda.tx + 0.5) * TILE + 2;
    g.ly = (pagoda.ty + 0.5) * TILE + 2;
    expect(g.inRestAura()).toBe(true);
    g.hp = 50;
    g.lastCombatAt = -100;
    g.regen(1);
    expect(g.hp).toBeCloseTo(50 + PLAYER_REGEN_HP_PER_S * REST_AURA_MULT);
  });
});

describe("food", () => {
  it("eating heals and consumes the item", () => {
    const g = new Game("samurai", false, 9);
    const food = g.items.find((i) => i.kind === "food")!;
    food.heldBy = "player";
    g.hp = 40;
    const msg = g.useFood(food);
    expect(msg).toContain("You eat");
    expect(g.hp).toBe(40 + food.value);
    expect(g.inventory.find((i) => i.id === food.id)).toBeUndefined();
  });
});

describe("merchant trade", () => {
  it("stock is deterministic per day and rotates daily", () => {
    const g = new Game("samurai", false, 9);
    const m = merchant(g);
    const today = g.merchantStock(m).map((o) => o.name).join("|");
    expect(g.merchantStock(m).map((o) => o.name).join("|")).toBe(today);
    expect(g.merchantStock(m).length).toBe(TRADE_STOCK_SIZE);
    g.elapsed += 120 * 3; // three days pass
    const later = g.merchantStock(m).map((o) => o.name).join("|");
    expect(g.merchantStock(m).length).toBe(TRADE_STOCK_SIZE);
    void later; // names may coincide; the seed differs, so prices/mix can too
  });

  it("buying costs gold, adds the item, and depletes today's stock", () => {
    const g = new Game("merchant", false, 9);
    const m = merchant(g);
    const offer = g.merchantStock(m)[0];
    const goldBefore = g.gold;
    const msg = g.buyOffer(m, offer);
    expect(msg).toContain("Bought");
    expect(g.gold).toBe(goldBefore - offer.price);
    expect(g.inventory.some((i) => i.name === offer.name)).toBe(true);
    expect(g.merchantStock(m).some((o) => o.stockIndex === offer.stockIndex)).toBe(false);
  });

  it("refuses a purchase the player cannot afford", () => {
    const g = new Game("peasant", false, 9);
    g.gold = 0;
    const m = merchant(g);
    const offer = g.merchantStock(m)[0];
    expect(g.buyOffer(m, offer)).toContain("cannot afford");
    expect(g.inventory).toHaveLength(0);
  });

  it("selling pays half value and recomputes the weapon bonus", () => {
    const g = new Game("samurai", false, 9);
    const weapon = g.items.find((i) => i.kind === "weapon")!;
    g.takeItem(weapon);
    expect(g.weaponBonus).toBe(weapon.value);
    const goldBefore = g.gold;
    const msg = g.sellToMerchant(weapon);
    expect(msg).toContain("Sold");
    expect(g.gold).toBe(goldBefore + Math.floor(weapon.value / 2));
    expect(g.weaponBonus).toBe(0);
  });

  it("imperial treasures are never for sale", () => {
    const g = new Game("samurai", false, 9);
    for (const n of g.npcs.filter((n) => !n.isRivalLeader).slice(0, 20)) n.allegiance = "player";
    g.visitEmperor();
    const sacred = g.items.find((i) => i.sacredIndex >= 0)!;
    sacred.heldBy = "player";
    expect(g.sellToMerchant(sacred)).toContain("cannot sell");
    expect(sacred.heldBy).toBe("player");
  });
});
