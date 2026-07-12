import {
  WORLD_W,
  WORLD_H,
  ZONE_TILES,
  TILE,
  WORLD_SEED,
  PALACE_ZX,
  PALACE_ZY,
  TEMPLE_ZX,
  TEMPLE_ZY,
} from "../core/constants";
import type { Biome, District } from "../core/types";
import { mulberry32, pick, randInt, shuffled, type Rng } from "../core/rng";

// Tile surface types (renderer colors by these).
export const T_GRASS = 0;
export const T_WATER = 1;
export const T_PATH = 2;
export const T_PADDY = 3;
export const T_STONE = 4;
export const T_SAND = 5;

export type PropKind =
  | "pine"
  | "sakura"
  | "rock"
  | "hut"
  | "torii"
  | "lantern"
  | "pagoda"
  | "palace"
  | "well"
  | "banner";

export interface Prop {
  kind: PropKind;
  tx: number;
  ty: number;
  rot: number;
  scale: number;
}

export interface DistrictFull extends District {
  tiles: number[][];
  props: Prop[];
}

const NAME_PARTS: Record<Biome, { pre: string[]; post: string }> = {
  village: { pre: ["Ohara", "Yedo", "Anjiro", "Mishima", "Kawana"], post: " Village" },
  forest: { pre: ["Kiso", "Hakone", "Shinano", "Kuro", "Owari"], post: " Forest" },
  sakura: { pre: ["Yoshino", "Ueno", "Arashi", "Hana"], post: " Blossom Grove" },
  lake: { pre: ["Biwa", "Ashi", "Suwa", "Kasumi"], post: " Lake" },
  mountain: { pre: ["Hiei", "Fuji", "Atago", "Kurama"], post: " Heights" },
  paddy: { pre: ["Midori", "Kome", "Aoi", "Taru"], post: " Paddies" },
  temple: { pre: ["Senso", "Kinkaku", "Ryoan"], post: " Temple" },
  palace: { pre: ["Imperial"], post: " Palace" },
  plains: { pre: ["Kanto", "Musashi", "Sagami", "Totomi", "Izu"], post: " Plain" },
};

function biomeLayout(rng: Rng): Biome[][] {
  const grid: Biome[][] = [];
  const pool: Biome[] = [];
  const counts: [Biome, number][] = [
    ["village", 5],
    ["forest", 8],
    ["sakura", 4],
    ["lake", 4],
    ["mountain", 6],
    ["paddy", 5],
    ["plains", WORLD_W * WORLD_H - 2 - 32],
  ];
  for (const [b, n] of counts) for (let i = 0; i < n; i++) pool.push(b);
  const bag = shuffled(rng, pool);
  let k = 0;
  for (let zy = 0; zy < WORLD_H; zy++) {
    const row: Biome[] = [];
    for (let zx = 0; zx < WORLD_W; zx++) {
      if (zx === PALACE_ZX && zy === PALACE_ZY) row.push("palace");
      else if (zx === TEMPLE_ZX && zy === TEMPLE_ZY) row.push("temple");
      else row.push(bag[k++]);
    }
    grid.push(row);
  }
  return grid;
}

function makeHeights(rng: Rng, amp: number): number[][] {
  // Coarse random lattice, bilinearly interpolated: cheap smooth noise.
  const step = 6;
  const cw = Math.ceil(ZONE_TILES / step) + 2;
  const lattice: number[][] = [];
  for (let y = 0; y < cw; y++) {
    lattice.push(Array.from({ length: cw }, () => rng() * amp));
  }
  const h: number[][] = [];
  for (let ty = 0; ty < ZONE_TILES; ty++) {
    const row: number[] = [];
    for (let tx = 0; tx < ZONE_TILES; tx++) {
      const gx = tx / step;
      const gy = ty / step;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const fx = gx - x0;
      const fy = gy - y0;
      const v =
        lattice[y0][x0] * (1 - fx) * (1 - fy) +
        lattice[y0][x0 + 1] * fx * (1 - fy) +
        lattice[y0 + 1][x0] * (1 - fx) * fy +
        lattice[y0 + 1][x0 + 1] * fx * fy;
      row.push(v);
    }
    h.push(row);
  }
  return h;
}

const inZone = (t: number): boolean => t >= 0 && t < ZONE_TILES;

function scatter(
  rng: Rng,
  district: DistrictFull,
  kind: PropKind,
  count: number,
  blocks: boolean,
  margin = 2,
): void {
  for (let i = 0; i < count; i++) {
    for (let tries = 0; tries < 20; tries++) {
      const tx = randInt(rng, margin, ZONE_TILES - 1 - margin);
      const ty = randInt(rng, margin, ZONE_TILES - 1 - margin);
      if (!district.walkable[ty][tx] || district.tiles[ty][tx] !== T_GRASS) continue;
      district.props.push({ kind, tx, ty, rot: rng() * Math.PI * 2, scale: 0.8 + rng() * 0.5 });
      if (blocks) district.walkable[ty][tx] = false;
      break;
    }
  }
}

function placeBlock(
  district: DistrictFull,
  kind: PropKind,
  tx: number,
  ty: number,
  w: number,
  h: number,
  tile = T_STONE,
): void {
  district.props.push({ kind, tx, ty, rot: 0, scale: 1 });
  for (let y = ty - Math.floor(h / 2); y <= ty + Math.floor(h / 2); y++) {
    for (let x = tx - Math.floor(w / 2); x <= tx + Math.floor(w / 2); x++) {
      if (inZone(x) && inZone(y)) {
        district.walkable[y][x] = false;
        district.tiles[y][x] = tile;
      }
    }
  }
}

function flatten(district: DistrictFull, tx: number, ty: number, r: number): void {
  const base = district.heights[ty]?.[tx] ?? 0;
  for (let y = ty - r; y <= ty + r; y++) {
    for (let x = tx - r; x <= tx + r; x++) {
      if (inZone(x) && inZone(y)) district.heights[y][x] = base;
    }
  }
}

function buildDistrict(zx: number, zy: number, biome: Biome, seed: number): DistrictFull {
  const rng = mulberry32(seed);
  const name = pick(rng, NAME_PARTS[biome].pre) + NAME_PARTS[biome].post;
  const amp = biome === "mountain" ? 3.2 : biome === "lake" ? 0.5 : 1.0;
  const heights = makeHeights(mulberry32(seed ^ 0x9e3779b9), amp);
  // Blend edges to a shared height so adjacent districts meet seamlessly.
  const EDGE_H = 0.8;
  for (let ty = 0; ty < ZONE_TILES; ty++) {
    for (let tx = 0; tx < ZONE_TILES; tx++) {
      const edgeDist = Math.min(tx, ty, ZONE_TILES - 1 - tx, ZONE_TILES - 1 - ty);
      if (edgeDist < 3) {
        const t = edgeDist / 3;
        heights[ty][tx] = EDGE_H * (1 - t) + heights[ty][tx] * t;
      }
    }
  }
  const walkable: boolean[][] = [];
  const tiles: number[][] = [];
  for (let ty = 0; ty < ZONE_TILES; ty++) {
    walkable.push(Array.from({ length: ZONE_TILES }, () => true));
    tiles.push(Array.from({ length: ZONE_TILES }, () => T_GRASS));
  }
  const d: DistrictFull = { zx, zy, biome, name, seed, walkable, heights, tiles, props: [] };
  const c = Math.floor(ZONE_TILES / 2);

  switch (biome) {
    case "lake": {
      const cx = c + randInt(rng, -2, 2);
      const cy = c + randInt(rng, -2, 2);
      const rr = randInt(rng, 5, 7);
      for (let ty = 0; ty < ZONE_TILES; ty++) {
        for (let tx = 0; tx < ZONE_TILES; tx++) {
          const dist = Math.hypot(tx - cx, ty - cy) + (rng() - 0.5) * 1.6;
          if (dist < rr) {
            tiles[ty][tx] = T_WATER;
            walkable[ty][tx] = false;
            heights[ty][tx] = -0.6;
          } else if (dist < rr + 1.6) {
            tiles[ty][tx] = T_SAND;
          }
        }
      }
      scatter(rng, d, "pine", 6, true);
      scatter(rng, d, "rock", 4, true);
      scatter(rng, d, "lantern", 2, false);
      break;
    }
    case "forest":
      scatter(rng, d, "pine", 26, true);
      scatter(rng, d, "rock", 5, true);
      break;
    case "sakura":
      scatter(rng, d, "sakura", 18, true);
      scatter(rng, d, "lantern", 4, false);
      scatter(rng, d, "rock", 3, true);
      break;
    case "mountain":
      scatter(rng, d, "rock", 18, true);
      scatter(rng, d, "pine", 8, true);
      break;
    case "paddy": {
      for (let p = 0; p < 4; p++) {
        const px = randInt(rng, 3, ZONE_TILES - 7);
        const py = randInt(rng, 3, ZONE_TILES - 7);
        for (let y = py; y < py + 4; y++) {
          for (let x = px; x < px + 4; x++) {
            tiles[y][x] = T_PADDY;
            heights[y][x] = heights[py][px];
          }
        }
      }
      placeBlock(d, "hut", c, 4, 2, 2, T_GRASS);
      flatten(d, c, 4, 2);
      scatter(rng, d, "pine", 4, true);
      break;
    }
    case "village": {
      const spots: [number, number][] = [
        [5, 5],
        [ZONE_TILES - 6, 5],
        [5, ZONE_TILES - 6],
        [ZONE_TILES - 6, ZONE_TILES - 6],
        [c, c - 4],
      ];
      for (const [hx, hy] of spots) {
        placeBlock(d, "hut", hx + randInt(rng, -1, 1), hy + randInt(rng, -1, 1), 2, 2, T_GRASS);
        flatten(d, hx, hy, 2);
      }
      d.props.push({ kind: "well", tx: c, ty: c, rot: 0, scale: 1 });
      walkable[c][c] = false;
      d.props.push({ kind: "torii", tx: c, ty: ZONE_TILES - 3, rot: 0, scale: 1 });
      for (let y = 3; y < ZONE_TILES - 2; y++) tiles[y][c] = T_PATH;
      scatter(rng, d, "lantern", 4, false);
      scatter(rng, d, "sakura", 3, true);
      break;
    }
    case "temple": {
      placeBlock(d, "pagoda", c, c - 2, 3, 3);
      flatten(d, c, c - 2, 4);
      d.props.push({ kind: "torii", tx: c, ty: ZONE_TILES - 4, rot: 0, scale: 1.2 });
      for (let y = c + 1; y < ZONE_TILES - 2; y++) tiles[y][c] = T_PATH;
      scatter(rng, d, "sakura", 8, true);
      scatter(rng, d, "lantern", 6, false);
      break;
    }
    case "palace": {
      placeBlock(d, "palace", c, 6, 5, 4);
      flatten(d, c, 6, 6);
      d.props.push({ kind: "torii", tx: c, ty: ZONE_TILES - 3, rot: 0, scale: 1.4 });
      d.props.push({ kind: "banner", tx: c - 4, ty: 10, rot: 0, scale: 1 });
      d.props.push({ kind: "banner", tx: c + 4, ty: 10, rot: 0, scale: 1 });
      for (let y = 9; y < ZONE_TILES - 2; y++) {
        tiles[y][c - 1] = T_STONE;
        tiles[y][c] = T_STONE;
        tiles[y][c + 1] = T_STONE;
      }
      scatter(rng, d, "sakura", 6, true);
      scatter(rng, d, "lantern", 8, false);
      break;
    }
    case "plains":
      scatter(rng, d, "pine", 5, true);
      scatter(rng, d, "rock", 4, true);
      scatter(rng, d, "sakura", 2, true);
      break;
  }

  // World border is impassable; inter-district edges keep a wide open gate
  // in the middle (the original's pixel-perfect exits were notorious).
  const gate0 = c - 3;
  const gate1 = c + 3;
  for (let t = 0; t < ZONE_TILES; t++) {
    if (zy === 0) walkable[0][t] = false;
    if (zy === WORLD_H - 1) walkable[ZONE_TILES - 1][t] = false;
    if (zx === 0) walkable[t][0] = false;
    if (zx === WORLD_W - 1) walkable[t][ZONE_TILES - 1] = false;
  }
  const carve = (tx: number, ty: number): void => {
    walkable[ty][tx] = true;
    if (tiles[ty][tx] === T_WATER) tiles[ty][tx] = T_SAND;
    d.props = d.props.filter((p) => !(Math.abs(p.tx - tx) < 1 && Math.abs(p.ty - ty) < 1));
  };
  for (let g = gate0; g <= gate1; g++) {
    if (zy > 0) for (let y = 0; y < 3; y++) carve(g, y);
    if (zy < WORLD_H - 1) for (let y = ZONE_TILES - 3; y < ZONE_TILES; y++) carve(g, y);
    if (zx > 0) for (let x = 0; x < 3; x++) carve(x, g);
    if (zx < WORLD_W - 1) for (let x = ZONE_TILES - 3; x < ZONE_TILES; x++) carve(x, g);
  }

  return d;
}

export class World {
  districts: DistrictFull[][] = [];

  constructor(seed: number = WORLD_SEED) {
    const rng = mulberry32(seed);
    const layout = biomeLayout(rng);
    for (let zy = 0; zy < WORLD_H; zy++) {
      const row: DistrictFull[] = [];
      for (let zx = 0; zx < WORLD_W; zx++) {
        row.push(buildDistrict(zx, zy, layout[zy][zx], seed * 31 + zy * WORLD_W + zx));
      }
      this.districts.push(row);
    }
  }

  district(zx: number, zy: number): DistrictFull {
    return this.districts[zy][zx];
  }

  inBounds(zx: number, zy: number): boolean {
    return zx >= 0 && zx < WORLD_W && zy >= 0 && zy < WORLD_H;
  }

  isWalkable(zx: number, zy: number, lx: number, ly: number): boolean {
    const tx = Math.floor(lx / TILE);
    const ty = Math.floor(ly / TILE);
    if (!inZone(tx) || !inZone(ty)) return false;
    return this.districts[zy][zx].walkable[ty][tx];
  }

  heightAt(zx: number, zy: number, lx: number, ly: number): number {
    const d = this.districts[zy][zx];
    const tx = Math.min(ZONE_TILES - 1, Math.max(0, Math.floor(lx / TILE)));
    const ty = Math.min(ZONE_TILES - 1, Math.max(0, Math.floor(ly / TILE)));
    return d.heights[ty][tx];
  }

  randomWalkableTile(zx: number, zy: number, rng: Rng): { lx: number; ly: number } {
    const d = this.districts[zy][zx];
    for (let tries = 0; tries < 200; tries++) {
      const tx = randInt(rng, 2, ZONE_TILES - 3);
      const ty = randInt(rng, 2, ZONE_TILES - 3);
      if (d.walkable[ty][tx]) {
        return { lx: (tx + 0.5) * TILE, ly: (ty + 0.5) * TILE };
      }
    }
    return { lx: (ZONE_TILES / 2) * TILE, ly: (ZONE_TILES / 2) * TILE };
  }
}
