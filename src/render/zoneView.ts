import * as THREE from "three";
import { TILE, ZONE_SIZE, ZONE_TILES } from "../core/constants";
import { mulberry32 } from "../core/rng";
import { T_GRASS, T_PADDY, T_PATH, T_SAND, T_STONE, T_WATER, type DistrictFull } from "../sim/world";
import { PAL } from "./palette";
import { buildProp } from "./props";

const TILE_COLORS: Record<number, number> = {
  [T_GRASS]: PAL.grass,
  [T_WATER]: PAL.water,
  [T_PATH]: PAL.path,
  [T_PADDY]: PAL.paddy,
  [T_STONE]: PAL.stone,
  [T_SAND]: PAL.sand,
};

// Corner heights average the surrounding tiles so terrain reads as smooth
// hills while each tile keeps a crisp single color (non-indexed faces).
function cornerHeight(d: DistrictFull, cx: number, cy: number): number {
  let sum = 0;
  let n = 0;
  for (let ty = cy - 1; ty <= cy; ty++) {
    for (let tx = cx - 1; tx <= cx; tx++) {
      if (tx >= 0 && tx < ZONE_TILES && ty >= 0 && ty < ZONE_TILES) {
        sum += d.heights[ty][tx];
        n++;
      }
    }
  }
  return n ? sum / n : 0;
}

function buildTerrain(d: DistrictFull): THREE.Mesh {
  const rng = mulberry32(d.seed ^ 0x51ab);
  const positions: number[] = [];
  const colors: number[] = [];
  const color = new THREE.Color();
  const corner = (cx: number, cy: number): [number, number, number] => [
    cx * TILE,
    cornerHeight(d, cx, cy),
    cy * TILE,
  ];
  for (let ty = 0; ty < ZONE_TILES; ty++) {
    for (let tx = 0; tx < ZONE_TILES; tx++) {
      const t = d.tiles[ty][tx];
      const p00 = corner(tx, ty);
      const p10 = corner(tx + 1, ty);
      const p01 = corner(tx, ty + 1);
      const p11 = corner(tx + 1, ty + 1);
      if (t === T_WATER) {
        p00[1] = p10[1] = p01[1] = p11[1] = -0.55;
      }
      positions.push(...p00, ...p01, ...p10, ...p10, ...p01, ...p11);
      color.setHex(TILE_COLORS[t] ?? PAL.grass);
      const jitter = (rng() - 0.5) * 0.07;
      color.offsetHSL(0, 0, jitter);
      for (let i = 0; i < 6; i++) colors.push(color.r, color.g, color.b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

function buildWaterOverlay(d: DistrictFull): THREE.Mesh | null {
  let hasWater = false;
  for (const row of d.tiles) if (row.includes(T_WATER)) hasWater = true;
  if (!hasWater) return null;
  const geo = new THREE.PlaneGeometry(ZONE_SIZE, ZONE_SIZE);
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: PAL.waterDeep,
      transparent: true,
      opacity: 0.45,
      roughness: 0.2,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.set(ZONE_SIZE / 2, -0.28, ZONE_SIZE / 2);
  return m;
}

export function buildDistrictGroup(d: DistrictFull): THREE.Group {
  const g = new THREE.Group();
  g.add(buildTerrain(d));
  const water = buildWaterOverlay(d);
  if (water) g.add(water);
  for (const p of d.props) {
    const mesh = buildProp(p.kind);
    const x = (p.tx + 0.5) * TILE;
    const z = (p.ty + 0.5) * TILE;
    mesh.position.set(x, d.heights[p.ty][p.tx], z);
    mesh.rotation.y = ["torii", "hut", "palace", "pagoda", "banner"].includes(p.kind) ? 0 : p.rot;
    mesh.scale.setScalar(p.scale);
    g.add(mesh);
  }
  g.position.set(d.zx * ZONE_SIZE, 0, d.zy * ZONE_SIZE);
  return g;
}
