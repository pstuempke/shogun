import * as THREE from "three";
import type { Npc } from "../core/types";
import { PAL, ROLE_ROBE } from "./palette";
import { mat } from "./props";

export interface CharacterView {
  group: THREE.Group;
  body: THREE.Mesh;
  label: THREE.Sprite;
  labelCanvas: HTMLCanvasElement;
  bubble: THREE.Sprite;
  bobPhase: number;
}

// Small speech bubble shown while an NPC is chatting.
function makeBubbleSprite(): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 48;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(250, 248, 240, 0.95)";
  ctx.strokeStyle = "rgba(40, 40, 55, 0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(32, 20, 26, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(24, 34);
  ctx.lineTo(18, 46);
  ctx.lineTo(32, 35);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#33334a";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(20 + i * 12, 20, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
  );
  sprite.scale.set(1.6, 1.2, 1);
  sprite.position.set(0.8, 3.7, 0);
  sprite.renderOrder = 11;
  sprite.visible = false;
  return sprite;
}

function makeLabelSprite(): { sprite: THREE.Sprite; canvas: HTMLCanvasElement } {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 2;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
  );
  sprite.scale.set(5, 1.25, 1);
  sprite.renderOrder = 10;
  return { sprite, canvas };
}

export function drawLabel(
  canvas: HTMLCanvasElement,
  name: string,
  color: string,
  hpFrac: number | null,
): void {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "bold 26px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(20,20,30,0.85)";
  ctx.strokeText(name, 128, 30);
  ctx.fillStyle = color;
  ctx.fillText(name, 128, 30);
  if (hpFrac !== null && hpFrac < 1) {
    ctx.fillStyle = "rgba(20,20,30,0.7)";
    ctx.fillRect(64, 40, 128, 10);
    ctx.fillStyle = hpFrac > 0.5 ? "#5ec46a" : hpFrac > 0.25 ? "#e0b13e" : "#d64545";
    ctx.fillRect(66, 42, 124 * Math.max(0, hpFrac), 6);
  }
  const sprite = (canvas as unknown as { __tex?: THREE.CanvasTexture }).__tex;
  if (sprite) sprite.needsUpdate = true;
}

function bindTexture(view: CharacterView): void {
  const material = view.label.material as THREE.SpriteMaterial;
  (view.labelCanvas as unknown as { __tex?: THREE.CanvasTexture }).__tex =
    material.map as THREE.CanvasTexture;
}

function makeFigure(robeColor: number, role: string): { group: THREE.Group; body: THREE.Mesh } {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 8), mat(robeColor));
  body.position.y = 0.75;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), mat(PAL.skin));
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.44, 0.16, 8), mat(0x2c2c38));
  sash.position.y = 0.85;
  group.add(sash);
  switch (role) {
    case "peasant":
    case "merchant": {
      const kasa = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.3, 10), mat(0xcbb26a));
      kasa.position.y = 2.02;
      group.add(kasa);
      break;
    }
    case "samurai":
    case "daimyo": {
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6), mat(0x33334a));
      helm.scale.y = 0.7;
      helm.position.y = 1.9;
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.05), mat(PAL.gold));
      crest.position.y = 2.15;
      group.add(helm, crest);
      break;
    }
    case "noble": {
      const eboshi = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 6), mat(0x1e1e2c));
      eboshi.position.y = 2.15;
      group.add(eboshi);
      break;
    }
    case "ronin": {
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), mat(0x1e1e2c));
      knot.position.y = 2.05;
      group.add(knot);
      const sword = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.14), mat(0x8b8b96));
      sword.rotation.z = 1.1;
      sword.position.set(-0.45, 1.0, -0.15);
      group.add(sword);
      break;
    }
    case "bandit": {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 6, 10), mat(0xa93524));
      band.rotation.x = Math.PI / 2;
      band.position.y = 1.85;
      group.add(band);
      break;
    }
    case "monk": {
      const beads = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 10), mat(0x6b4a2a));
      beads.rotation.x = 1.2;
      beads.position.y = 1.3;
      group.add(beads);
      break;
    }
  }
  return { group, body };
}

export function allegianceColor(npc: Npc): string {
  if (npc.allegiance === "player") return "#7ce09a";
  if (npc.allegiance === "rival" || npc.isRivalLeader) return "#ff8a7a";
  if (npc.hostile) return "#ffb3a0";
  return "#f2efe6";
}

export function makeNpcView(npc: Npc): CharacterView {
  const { group, body } = makeFigure(ROLE_ROBE[npc.role] ?? PAL.neutral, npc.role);
  const { sprite, canvas } = makeLabelSprite();
  sprite.position.y = 2.9;
  group.add(sprite);
  const bubble = makeBubbleSprite();
  group.add(bubble);
  const view: CharacterView = { group, body, label: sprite, labelCanvas: canvas, bubble, bobPhase: Math.random() * 6 };
  bindTexture(view);
  drawLabel(canvas, npc.name, allegianceColor(npc), npc.hp / npc.maxHp);
  return view;
}

export function makePlayerView(className: string): CharacterView {
  const { group, body } = makeFigure(PAL.playerRobe, className === "noble" ? "noble" : className === "samurai" ? "samurai" : className);
  const { sprite, canvas } = makeLabelSprite();
  sprite.position.y = 2.9;
  group.add(sprite);
  const bubble = makeBubbleSprite();
  group.add(bubble);
  const view: CharacterView = { group, body, label: sprite, labelCanvas: canvas, bubble, bobPhase: 0 };
  bindTexture(view);
  drawLabel(canvas, "You", "#9ecbff", null);
  return view;
}

export function makeEmperorView(): THREE.Group {
  const { group } = makeFigure(PAL.emperor, "noble");
  group.scale.setScalar(1.15);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.05, 8, 20),
    mat(PAL.gold, { emissive: PAL.gold }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 2.4;
  group.add(halo);
  return group;
}
