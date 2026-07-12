import * as THREE from "three";
import { PAL } from "./palette";
import type { PropKind } from "../sim/world";

const mats = new Map<number, THREE.MeshStandardMaterial>();

export function mat(color: number, opts: { flat?: boolean; emissive?: number } = {}): THREE.MeshStandardMaterial {
  const key = color ^ ((opts.emissive ?? 0) << 1);
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      flatShading: opts.flat ?? true,
      roughness: 0.9,
      metalness: 0.02,
      emissive: opts.emissive ?? 0x000000,
      emissiveIntensity: opts.emissive ? 0.7 : 0,
    });
    mats.set(key, m);
  }
  return m;
}

function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cone(r: number, h: number, seg: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color));
  m.castShadow = true;
  return m;
}

function cyl(rt: number, rb: number, h: number, seg: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.castShadow = true;
  return m;
}

// A pagoda-style tiered roof: stacked, slightly rotated squashed pyramids.
function roofTier(size: number, height: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.ConeGeometry(size, height, 4), mat(color));
  m.rotation.y = Math.PI / 4;
  m.castShadow = true;
  return m;
}

function makePine(): THREE.Group {
  const g = new THREE.Group();
  const trunk = cyl(0.14, 0.2, 1.2, 6, PAL.trunk);
  trunk.position.y = 0.6;
  g.add(trunk);
  const tiers = [
    [1.1, 1.4, 1.4],
    [0.85, 1.15, 2.2],
    [0.6, 0.95, 2.9],
  ] as const;
  tiers.forEach(([r, h, y], i) => {
    const c = cone(r, h, 7, i % 2 === 0 ? PAL.pine : PAL.pineDark);
    c.position.y = y;
    g.add(c);
  });
  return g;
}

function makeSakura(): THREE.Group {
  const g = new THREE.Group();
  const trunk = cyl(0.13, 0.2, 1.1, 6, PAL.trunk);
  trunk.position.y = 0.55;
  g.add(trunk);
  const blobs: [number, number, number, number][] = [
    [0, 1.7, 0, 0.95],
    [0.6, 1.45, 0.25, 0.6],
    [-0.55, 1.5, -0.2, 0.65],
    [0.15, 1.4, -0.55, 0.55],
  ];
  blobs.forEach(([x, y, z, r], i) => {
    const s = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 0),
      mat(i % 2 === 0 ? PAL.sakura : PAL.sakuraDark),
    );
    s.position.set(x, y, z);
    s.castShadow = true;
    g.add(s);
  });
  return g;
}

function makeRock(): THREE.Group {
  const g = new THREE.Group();
  const r1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), mat(PAL.rock));
  r1.position.y = 0.35;
  r1.scale.y = 0.7;
  r1.castShadow = true;
  const r2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 0), mat(PAL.rockDark));
  r2.position.set(0.55, 0.2, 0.2);
  r2.castShadow = true;
  g.add(r1, r2);
  return g;
}

function makeHut(): THREE.Group {
  const g = new THREE.Group();
  const base = box(3.2, 1.6, 2.6, PAL.wall);
  base.position.y = 0.8;
  const roof = roofTier(2.9, 1.5, PAL.roof);
  roof.position.y = 2.35;
  roof.scale.z = 0.85;
  const door = box(0.7, 1.0, 0.1, PAL.wood);
  door.position.set(0, 0.5, 1.31);
  g.add(base, roof, door);
  return g;
}

function makeTorii(): THREE.Group {
  const g = new THREE.Group();
  const legL = cyl(0.16, 0.2, 3.0, 8, PAL.torii);
  legL.position.set(-1.3, 1.5, 0);
  const legR = legL.clone();
  legR.position.x = 1.3;
  const top = box(3.9, 0.28, 0.34, PAL.torii);
  top.position.y = 3.05;
  const top2 = box(4.3, 0.22, 0.3, PAL.toriiDark);
  top2.position.y = 3.35;
  const mid = box(2.7, 0.2, 0.26, PAL.torii);
  mid.position.y = 2.35;
  g.add(legL, legR, top, top2, mid);
  return g;
}

function makeLantern(): THREE.Group {
  const g = new THREE.Group();
  const base = box(0.5, 0.25, 0.5, PAL.stone);
  base.position.y = 0.12;
  const post = cyl(0.1, 0.12, 0.8, 6, PAL.stone);
  post.position.y = 0.65;
  const housing = box(0.55, 0.45, 0.55, PAL.stone);
  housing.position.y = 1.25;
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.28, 0.3),
    mat(PAL.lanternLight, { emissive: PAL.lanternLight }),
  );
  glow.position.y = 1.25;
  const cap = cone(0.5, 0.4, 4, PAL.rockDark);
  cap.rotation.y = Math.PI / 4;
  cap.position.y = 1.65;
  g.add(base, post, housing, glow, cap);
  return g;
}

function makePagoda(): THREE.Group {
  const g = new THREE.Group();
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const s = 1 - i * 0.24;
    const body = box(3.6 * s, 1.5, 3.6 * s, PAL.wall);
    body.position.y = 0.75 + i * 2.1;
    const roof = roofTier(3.4 * s, 1.15, PAL.roof);
    roof.position.y = 2.1 + i * 2.1;
    g.add(body, roof);
  }
  const spire = cyl(0.06, 0.06, 1.4, 6, PAL.gold);
  spire.position.y = tiers * 2.1 + 0.9;
  g.add(spire);
  return g;
}

function makePalace(): THREE.Group {
  const g = new THREE.Group();
  const plinth = box(11, 0.8, 8, PAL.stone);
  plinth.position.y = 0.4;
  const main = box(9, 2.4, 6, PAL.wall);
  main.position.y = 2.0;
  const roof = roofTier(7.4, 2.4, PAL.roofPalace);
  roof.position.y = 4.35;
  roof.scale.z = 0.75;
  const upper = box(5, 1.6, 3.6, PAL.wall);
  upper.position.y = 5.4;
  const roof2 = roofTier(4.4, 1.8, PAL.roofPalace);
  roof2.position.y = 6.9;
  roof2.scale.z = 0.75;
  const door = box(1.6, 1.6, 0.2, PAL.wood);
  door.position.set(0, 1.2, 3.05);
  const fin = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mat(PAL.gold));
  fin.position.y = 7.9;
  g.add(plinth, main, roof, upper, roof2, door, fin);
  const gLight = new THREE.PointLight(0xffe0b0, 12, 18);
  gLight.position.set(0, 3, 4);
  g.add(gLight);
  return g;
}

function makeWell(): THREE.Group {
  const g = new THREE.Group();
  const ring = cyl(0.75, 0.85, 0.7, 8, PAL.stone);
  ring.position.y = 0.35;
  const postL = box(0.12, 1.3, 0.12, PAL.wood);
  postL.position.set(-0.6, 1.0, 0);
  const postR = postL.clone();
  postR.position.x = 0.6;
  const roof = roofTier(1.1, 0.6, PAL.roof);
  roof.position.y = 1.9;
  g.add(ring, postL, postR, roof);
  return g;
}

function makeBanner(): THREE.Group {
  const g = new THREE.Group();
  const pole = cyl(0.05, 0.07, 3.4, 6, PAL.wood);
  pole.position.y = 1.7;
  const cloth = box(0.9, 2.0, 0.06, PAL.banner);
  cloth.position.set(0.5, 2.3, 0);
  const sun = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12), mat(PAL.torii));
  sun.rotation.x = Math.PI / 2;
  sun.position.set(0.5, 2.4, 0);
  g.add(pole, cloth, sun);
  return g;
}

const builders: Record<PropKind, () => THREE.Group> = {
  pine: makePine,
  sakura: makeSakura,
  rock: makeRock,
  hut: makeHut,
  torii: makeTorii,
  lantern: makeLantern,
  pagoda: makePagoda,
  palace: makePalace,
  well: makeWell,
  banner: makeBanner,
};

export function buildProp(kind: PropKind): THREE.Group {
  return builders[kind]();
}
