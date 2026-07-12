import { describe, expect, it } from "vitest";
import { World } from "../src/sim/world";
import {
  PALACE_ZX,
  PALACE_ZY,
  TEMPLE_ZX,
  TEMPLE_ZY,
  WORLD_H,
  WORLD_W,
  ZONE_TILES,
} from "../src/core/constants";

describe("World generation", () => {
  const world = new World(123);

  it("builds the full district grid with fixed landmarks", () => {
    expect(world.districts).toHaveLength(WORLD_H);
    expect(world.district(PALACE_ZX, PALACE_ZY).biome).toBe("palace");
    expect(world.district(TEMPLE_ZX, TEMPLE_ZY).biome).toBe("temple");
  });

  it("keeps wide gates open between adjacent districts", () => {
    const mid = Math.floor(ZONE_TILES / 2);
    for (let zy = 0; zy < WORLD_H; zy++) {
      for (let zx = 0; zx < WORLD_W; zx++) {
        const d = world.district(zx, zy);
        if (zx < WORLD_W - 1) {
          expect(d.walkable[mid][ZONE_TILES - 1]).toBe(true);
          expect(world.district(zx + 1, zy).walkable[mid][0]).toBe(true);
        }
        if (zy < WORLD_H - 1) {
          expect(d.walkable[ZONE_TILES - 1][mid]).toBe(true);
          expect(world.district(zx, zy + 1).walkable[0][mid]).toBe(true);
        }
      }
    }
  });

  it("seals the outer world border", () => {
    const nw = world.district(0, 0);
    expect(nw.walkable[0][5]).toBe(false);
    expect(nw.walkable[5][0]).toBe(false);
  });

  it("every district offers walkable spawn tiles", () => {
    let calls = 0;
    const rng = (): number => {
      calls++;
      return (calls % 97) / 97;
    };
    for (let zy = 0; zy < WORLD_H; zy++) {
      for (let zx = 0; zx < WORLD_W; zx++) {
        const p = world.randomWalkableTile(zx, zy, rng);
        expect(world.isWalkable(zx, zy, p.lx, p.ly)).toBe(true);
      }
    }
  });
});
