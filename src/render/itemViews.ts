import * as THREE from "three";
import type { Item } from "../core/types";
import { PAL } from "./palette";
import { mat } from "./props";

export function makeItemView(item: Item): THREE.Group {
  const g = new THREE.Group();
  switch (item.kind) {
    case "koban": {
      for (let i = 0; i < 3; i++) {
        const coin = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.28, 0.08, 10),
          mat(PAL.gold, { emissive: 0x6b5210 }),
        );
        coin.position.set((i - 1) * 0.16, 0.06 + i * 0.09, (i % 2) * 0.12);
        coin.castShadow = true;
        g.add(coin);
      }
      break;
    }
    case "gift": {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.55), mat(0xb84a6e));
      box.position.y = 0.2;
      box.castShadow = true;
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.12), mat(0xf0e6c8));
      ribbon.position.y = 0.42;
      g.add(box, ribbon);
      break;
    }
    case "weapon": {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.16), mat(0xcfd4dd));
      blade.rotation.z = 0.9;
      blade.position.y = 0.5;
      blade.castShadow = true;
      const hilt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.18), mat(0x2c2c38));
      hilt.rotation.z = 0.9;
      hilt.position.set(0.48, 0.14, 0);
      g.add(blade, hilt);
      break;
    }
    case "food": {
      const leaf = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.06, 8), mat(0x5c8a3a));
      leaf.position.y = 0.04;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), mat(0xf2efe4));
      ball.scale.y = 0.85;
      ball.position.y = 0.28;
      ball.castShadow = true;
      const nori = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.08), mat(0x2b3a2b));
      nori.position.set(0, 0.24, 0.22);
      g.add(leaf, ball, nori);
      break;
    }
    case "sacred": {
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 0.4, 8), mat(PAL.stone));
      pedestal.position.y = 0.2;
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.42, 1),
        mat(0xffe9a0, { emissive: 0xd9a520 }),
      );
      orb.position.y = 1.1;
      orb.name = "sacred-orb";
      const light = new THREE.PointLight(0xffdf80, 8, 10);
      light.position.y = 1.6;
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.34, 7, 8, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xffe9a0,
          transparent: true,
          opacity: 0.16,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      beam.position.y = 3.5;
      g.add(pedestal, orb, light, beam);
      break;
    }
  }
  return g;
}

export function animateItemView(g: THREE.Group, t: number): void {
  const orb = g.getObjectByName("sacred-orb");
  if (orb) {
    orb.position.y = 1.1 + Math.sin(t * 2) * 0.15;
    orb.rotation.y = t;
  }
}
