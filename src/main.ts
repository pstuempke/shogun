import "./style.css";
import * as THREE from "three";
import {
  ATTACK_COOLDOWN,
  ATTACK_RANGE,
  DODGE_COOLDOWN,
  DODGE_IFRAMES,
  DODGE_SPEED,
  DODGE_TIME,
  ENEMY_ATTACK_COOLDOWN,
  ENEMY_STRIKE_RANGE,
  ENEMY_TELEGRAPH,
  FOLLOWERS_TO_WIN,
  INTERACT_RANGE,
  NPC_LOCAL_SPEED,
  NPC_TRAVEL_SPEED,
  PALACE_ZX,
  PALACE_ZY,
  PICKUP_RANGE,
  PLAYER_SPEED,
  SACRED_ITEM_COUNT,
  TILE,
  WORLD_H,
  WORLD_W,
  ZONE_SIZE,
  ZONE_TILES,
} from "./core/constants";
import type { Item, Npc } from "./core/types";
import { Game } from "./sim/game";
import { Simulation } from "./sim/simulation";
import { strikeDamage } from "./sim/combat";
import { normalizeZone, worldX, worldY } from "./sim/pathing";
import { IsoScene } from "./render/scene";
import { buildDistrictGroup } from "./render/zoneView";
import {
  allegianceColor,
  drawLabel,
  makeEmperorView,
  makeNpcView,
  makePlayerView,
  type CharacterView,
} from "./render/characters";
import { animateItemView, makeItemView } from "./render/itemViews";
import { Hud } from "./ui/hud";
import { showChooser, showEnd, showPause, showTitle } from "./ui/screens";

type AppState = "title" | "playing" | "paused" | "chooser" | "end";

interface NpcRuntime {
  view: CharacterView;
  lastHp: number;
  lastColor: string;
  wanderTimer: number;
  targetLx: number;
  targetLy: number;
  telegraph: number;
  cooldown: number;
  hitFlash: number;
}

class App {
  private iso: IsoScene;
  private hud = new Hud();
  private game!: Game;
  private sim!: Simulation;
  private state: AppState = "title";
  private keys = new Set<string>();

  private districtGroups = new Map<string, THREE.Group>();
  private activeDistricts = new Set<string>();
  private npcRt = new Map<number, NpcRuntime>();
  private itemViews = new Map<number, THREE.Group>();
  private playerView!: CharacterView;
  private emperor!: THREE.Group;

  private moveDir = new THREE.Vector2(0, -1);
  private attackCooldown = 0;
  private swingTimer = 0;
  private dodgeTimer = 0;
  private dodgeCooldown = 0;
  private iframes = 0;
  private playerY = 0;
  private minimapTimer = 0;
  private clock = new THREE.Clock();

  constructor() {
    const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
    this.iso = new IsoScene(canvas);
    window.addEventListener("keydown", (e) => this.onKeyDown(e));
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener("wheel", (e) => {
      if (this.state === "playing") this.iso.zoom(e.deltaY > 0 ? 2 : -2);
    });
    window.addEventListener("blur", () => this.keys.clear());
    showTitle((classId, honor) => this.startGame(classId, honor));
    this.loop();
  }

  // ---- lifecycle ----

  private startGame(classId: string, honorMode: boolean): void {
    this.disposeWorld();
    this.game = new Game(classId, honorMode, Math.floor(Math.random() * 1e9));
    this.sim = new Simulation();
    this.state = "playing";
    (window as unknown as { __game?: Game }).__game = this.game;

    this.playerView = makePlayerView(classId);
    this.iso.scene.add(this.playerView.group);
    this.emperor = makeEmperorView();
    const palaceD = this.game.world.district(PALACE_ZX, PALACE_ZY);
    const ec = Math.floor(ZONE_TILES / 2);
    this.emperor.position.set(
      PALACE_ZX * ZONE_SIZE + (ec + 0.5) * TILE,
      palaceD.heights[9][ec],
      PALACE_ZY * ZONE_SIZE + 9.5 * TILE,
    );
    this.iso.scene.add(this.emperor);

    this.wireBus();
    this.hud.show();
    this.hud.setClass(this.game.playerClass.label, this.game.playerClass.scoreMultiplier);
    this.hud.setDay(1);
    this.hud.setHp(this.game.hp, this.game.maxHp);
    this.hud.setGold(this.game.gold);
    this.hud.setFollowers(0);
    this.hud.updateInventory(this.game);
    this.updateObjective();
    this.refreshDistricts();
    const d = this.game.world.district(this.game.zx, this.game.zy);
    this.hud.zoneName(d.name);
    this.iso.snapTo(this.playerWorldPos());
    this.game.ticker("Japan, 1600. Gather twenty followers, then seek the Emperor.", "info");
    if (honorMode) this.game.ticker("Way of Honour: death is permanent.", "bad");
  }

  private wireBus(): void {
    const b = this.game.bus;
    b.on("ticker", (e) => this.hud.ticker(e.text, e.kind));
    b.on("hpChange", (e) => this.hud.setHp(e.hp, e.maxHp));
    b.on("goldChange", (e) => this.hud.setGold(e.gold));
    b.on("followerChange", (e) => {
      this.hud.setFollowers(e.count);
      this.updateObjective();
    });
    b.on("phaseChange", () => {
      this.updateObjective();
      if (this.game.phase === "lost") this.endGame(false, "Your campaign has failed.");
    });
    b.on("victory", () => this.endGame(true));
    b.on("zoneChange", (e) => {
      this.hud.zoneName(e.name);
      this.refreshDistricts();
    });
    b.on("itemTaken", () => this.hud.updateInventory(this.game));
    b.on("itemDropped", () => this.hud.updateInventory(this.game));
    b.on("playerDefeated", () => {
      if (!this.game.honorMode && this.game.phase !== "lost") {
        this.iso.snapTo(this.playerWorldPos());
        this.refreshDistricts();
      }
    });
  }

  private endGame(won: boolean, reason?: string): void {
    if (this.state === "end") return;
    this.state = "end";
    const g = this.game;
    this.hud.hide();
    showEnd(
      {
        won,
        score: g.score,
        followers: g.followerCount,
        gold: g.gold,
        sacred: SACRED_ITEM_COUNT,
        minutes: Math.round(g.elapsed / 60),
        classLabel: g.playerClass.label,
        multiplier: g.playerClass.scoreMultiplier,
        reason,
      },
      () => {
        this.state = "title";
        showTitle((c, h) => this.startGame(c, h));
      },
    );
  }

  private disposeWorld(): void {
    for (const gr of this.districtGroups.values()) this.iso.scene.remove(gr);
    this.districtGroups.clear();
    this.activeDistricts.clear();
    for (const rt of this.npcRt.values()) this.iso.scene.remove(rt.view.group);
    this.npcRt.clear();
    for (const v of this.itemViews.values()) this.iso.scene.remove(v);
    this.itemViews.clear();
    if (this.playerView) this.iso.scene.remove(this.playerView.group);
    if (this.emperor) this.iso.scene.remove(this.emperor);
  }

  // ---- world/view helpers ----

  private playerWorldPos(): THREE.Vector3 {
    const g = this.game;
    return new THREE.Vector3(g.zx * ZONE_SIZE + g.lx, this.playerY, g.zy * ZONE_SIZE + g.ly);
  }

  private refreshDistricts(): void {
    const want = new Set<string>();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const zx = this.game.zx + dx;
        const zy = this.game.zy + dy;
        if (this.game.world.inBounds(zx, zy)) want.add(`${zx},${zy}`);
      }
    }
    for (const key of this.activeDistricts) {
      if (!want.has(key)) {
        const gr = this.districtGroups.get(key);
        if (gr) this.iso.scene.remove(gr);
      }
    }
    for (const key of want) {
      if (!this.activeDistricts.has(key)) {
        let gr = this.districtGroups.get(key);
        if (!gr) {
          const [zx, zy] = key.split(",").map(Number);
          gr = buildDistrictGroup(this.game.world.district(zx, zy));
          this.districtGroups.set(key, gr);
        }
        this.iso.scene.add(gr);
      }
    }
    this.activeDistricts.clear();
    for (const k of want) this.activeDistricts.add(k);
  }

  private isNpcVisible(npc: Npc): boolean {
    return (
      npc.alive &&
      Math.abs(npc.zx - this.game.zx) <= 1 &&
      Math.abs(npc.zy - this.game.zy) <= 1
    );
  }

  private isHostileNow(npc: Npc): boolean {
    if (!npc.alive || npc.yielded) return false;
    if (npc.hostile) return true;
    return this.game.phase === "quest" && (npc.allegiance === "rival" || npc.isRivalLeader);
  }

  // ---- input ----

  private onKeyDown(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (this.state !== "playing") {
      if (k === "escape" && this.state === "paused") {
        // handled by pause overlay buttons; ignore
      }
      return;
    }
    if (k === "escape") {
      this.state = "paused";
      showPause(
        () => (this.state = "playing"),
        () => {
          this.state = "title";
          this.hud.hide();
          showTitle((c, h) => this.startGame(c, h));
        },
      );
      return;
    }
    if (k === " ") {
      e.preventDefault();
      this.tryAttack();
      return;
    }
    if (k === "shift") {
      this.tryDodge();
      return;
    }
    if (k === "enter" || /^[a-z]$/.test(k)) {
      if (this.hud.triggerAction(k === "enter" ? "⏎" : k.toUpperCase())) e.preventDefault();
    }
  }

  private tryAttack(): void {
    if (this.attackCooldown > 0) return;
    this.attackCooldown = ATTACK_COOLDOWN;
    this.swingTimer = 0.18;
    const target = this.nearestNpc(ATTACK_RANGE, (n) => n.allegiance !== "player");
    if (!target) return;
    const dmg = strikeDamage(this.game.playerClass.attack, this.game.weaponBonus, this.game.rng);
    const wasNeutral = !this.isHostileNow(target) && !target.yielded;
    const result = this.game.damageNpc(target, dmg);
    const rt = this.npcRt.get(target.id);
    if (rt) rt.hitFlash = 0.2;
    if (result === "yielded") {
      this.hud.toast(`${target.name} yields! Befriend them — or show no mercy.`);
    } else if (result === "fighting" && wasNeutral) {
      target.hostile = true;
      target.disposition = Math.max(-100, target.disposition - 30);
      this.hud.toast(`${target.name} draws steel!`);
    }
  }

  private tryDodge(): void {
    if (this.dodgeCooldown > 0 || this.state !== "playing") return;
    this.dodgeTimer = DODGE_TIME;
    this.iframes = DODGE_IFRAMES;
    this.dodgeCooldown = DODGE_COOLDOWN;
  }

  private nearestNpc(range: number, filter: (n: Npc) => boolean): Npc | null {
    let best: Npc | null = null;
    let bestD = range;
    for (const npc of this.game.npcsInZone(this.game.zx, this.game.zy)) {
      if (!filter(npc)) continue;
      const d = Math.hypot(npc.lx - this.game.lx, npc.ly - this.game.ly);
      if (d < bestD) {
        bestD = d;
        best = npc;
      }
    }
    return best;
  }

  private nearestItem(range: number): Item | null {
    let best: Item | null = null;
    let bestD = range;
    for (const item of this.game.itemsInZone(this.game.zx, this.game.zy)) {
      const d = Math.hypot(item.lx - this.game.lx, item.ly - this.game.ly);
      if (d < bestD) {
        bestD = d;
        best = item;
      }
    }
    return best;
  }

  private nearEmperor(): boolean {
    if (this.game.zx !== PALACE_ZX || this.game.zy !== PALACE_ZY) return false;
    const ex = this.emperor.position.x - PALACE_ZX * ZONE_SIZE;
    const ez = this.emperor.position.z - PALACE_ZY * ZONE_SIZE;
    return Math.hypot(ex - this.game.lx, ez - this.game.ly) < 5;
  }

  // ---- context actions ----

  private updateActions(): void {
    const actions = [];
    const npc = this.nearestNpc(INTERACT_RANGE, () => true);
    const item = this.nearestItem(PICKUP_RANGE);
    if (this.nearEmperor()) {
      actions.push({
        key: "⏎",
        label: "Seek audience with the Emperor",
        onUse: () => this.hud.toast(this.game.visitEmperor(), 5),
      });
    }
    if (npc) {
      actions.push({ key: "E", label: `Examine`, onUse: () => this.hud.toast(this.game.examine(npc), 5) });
      if (npc.allegiance === "player") {
        actions.push({ key: "O", label: `Order ${shortName(npc)}`, onUse: () => this.openOrders(npc) });
      } else {
        actions.push({ key: "F", label: `Befriend`, onUse: () => void this.game.befriend(npc) });
        actions.push({
          key: "B",
          label: `Bribe (${this.game.bribeCostFor(npc)})`,
          onUse: () => {
            const r = this.game.bribe(npc);
            if (!r.ok) this.hud.toast(r.message);
          },
        });
        actions.push({ key: "Q", label: "Attack", onUse: () => this.tryAttack() });
      }
      if (this.game.inventory.some((i) => i.kind !== "sacred")) {
        actions.push({ key: "G", label: "Give gift", onUse: () => this.openGive(npc) });
      }
    }
    if (item) {
      actions.push({ key: "T", label: `Take ${item.name}`, onUse: () => this.hud.toast(this.game.takeItem(item)) });
    }
    if (!npc && this.game.inventory.length > 0) {
      actions.push({ key: "X", label: "Drop item", onUse: () => this.openDrop() });
    }
    this.hud.setActions(actions);
  }

  private openOrders(npc: Npc): void {
    this.state = "chooser";
    showChooser(
      `Orders for ${npc.name}`,
      [
        { label: "Follow me", value: "follow" },
        { label: "Wait here", value: "wait" },
        { label: "Stand guard in this district", value: "guard" },
      ],
      (v) => {
        this.state = "playing";
        if (v) this.game.setOrder(npc, v as Npc["order"]);
      },
    );
  }

  private openGive(npc: Npc): void {
    const options = this.game.inventory
      .filter((i) => i.kind !== "sacred")
      .map((i) => ({ label: `${i.name} (${i.kind === "weapon" ? "+" + i.value + " atk" : "worth " + i.value})`, value: String(i.id) }));
    if (options.length === 0) return;
    this.state = "chooser";
    showChooser(`Give to ${npc.name}`, options, (v) => {
      this.state = "playing";
      if (v === null) return;
      const item = this.game.items.find((i) => i.id === Number(v));
      if (item) {
        this.hud.toast(this.game.give(npc, item));
        this.hud.updateInventory(this.game);
      }
    });
  }

  private openDrop(): void {
    const options = this.game.inventory.map((i) => ({ label: i.name, value: String(i.id) }));
    this.state = "chooser";
    showChooser("Drop which item?", options, (v) => {
      this.state = "playing";
      if (v === null) return;
      const item = this.game.items.find((i) => i.id === Number(v));
      if (item) this.game.dropItem(item);
    });
  }

  private updateObjective(): void {
    const g = this.game;
    if (g.phase === "gathering") {
      this.hud.setObjective(
        g.followerCount >= FOLLOWERS_TO_WIN
          ? "⭐ Seek the Emperor at the Imperial Palace (far north)"
          : `Gather ${FOLLOWERS_TO_WIN} followers (${g.followerCount}/${FOLLOWERS_TO_WIN})`,
      );
    } else if (g.phase === "quest") {
      this.hud.setObjective(`✦ Recover the Imperial Treasures (${g.sacredCarried()}/${SACRED_ITEM_COUNT}), then return to the Emperor`);
    }
  }

  // ---- per-frame updates ----

  private updatePlayer(dt: number): void {
    const g = this.game;
    let vx = 0;
    let vz = 0;
    const up = this.keys.has("w") || this.keys.has("arrowup");
    const down = this.keys.has("s") || this.keys.has("arrowdown");
    const left = this.keys.has("a") || this.keys.has("arrowleft");
    const right = this.keys.has("d") || this.keys.has("arrowright");
    const K = Math.SQRT1_2;
    if (up) { vx -= K; vz -= K; }
    if (down) { vx += K; vz += K; }
    if (right) { vx += K; vz -= K; }
    if (left) { vx -= K; vz += K; }
    const len = Math.hypot(vx, vz);
    if (len > 0) {
      vx /= len;
      vz /= len;
      this.moveDir.set(vx, vz);
    }
    const speed = this.dodgeTimer > 0 ? DODGE_SPEED : PLAYER_SPEED;
    const dir = this.dodgeTimer > 0 ? this.moveDir : new THREE.Vector2(vx, vz);
    if (dir.lengthSq() > 0) {
      const px = g.zx * ZONE_SIZE + g.lx;
      const pz = g.zy * ZONE_SIZE + g.ly;
      const step = speed * dt;
      const tryMove = (nx: number, nz: number): boolean => {
        const zx = Math.min(Math.max(Math.floor(nx / ZONE_SIZE), 0), WORLD_W - 1);
        const zy = Math.min(Math.max(Math.floor(nz / ZONE_SIZE), 0), WORLD_H - 1);
        const lx = nx - zx * ZONE_SIZE;
        const ly = nz - zy * ZONE_SIZE;
        if (!this.game.world.isWalkable(zx, zy, lx, ly)) return false;
        const zoneChanged = zx !== g.zx || zy !== g.zy;
        g.zx = zx;
        g.zy = zy;
        g.lx = lx;
        g.ly = ly;
        if (zoneChanged) {
          this.carryFollowersAcross();
          g.bus.emit("zoneChange", { zx, zy, name: g.world.district(zx, zy).name });
        }
        return true;
      };
      if (!tryMove(px + dir.x * step, pz + dir.y * step)) {
        if (!tryMove(px + dir.x * step, pz)) tryMove(px, pz + dir.y * step);
      }
    }
    const targetY = g.world.heightAt(g.zx, g.zy, g.lx, g.ly);
    this.playerY += (targetY - this.playerY) * Math.min(1, dt * 12);

    const pos = this.playerWorldPos();
    const moving = dir.lengthSq() > 0;
    const bob = moving ? Math.sin(performance.now() * 0.015) * 0.08 : 0;
    this.playerView.group.position.set(pos.x, pos.y + bob, pos.z);
    this.playerView.group.rotation.y = Math.atan2(this.moveDir.x, this.moveDir.y);
    this.playerView.body.rotation.x = this.swingTimer > 0 ? -0.6 * (this.swingTimer / 0.18) : 0;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.swingTimer = Math.max(0, this.swingTimer - dt);
    this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.iframes = Math.max(0, this.iframes - dt);
  }

  private ensureNpcRuntime(npc: Npc): NpcRuntime {
    let rt = this.npcRt.get(npc.id);
    if (!rt) {
      const view = makeNpcView(npc);
      view.body.material = (view.body.material as THREE.MeshStandardMaterial).clone();
      rt = {
        view,
        lastHp: npc.hp,
        lastColor: allegianceColor(npc),
        wanderTimer: Math.random() * 3,
        targetLx: npc.lx,
        targetLy: npc.ly,
        telegraph: 0,
        cooldown: 0,
        hitFlash: 0,
      };
      this.iso.scene.add(view.group);
      this.npcRt.set(npc.id, rt);
    }
    return rt;
  }

  private updateNpcs(dt: number): void {
    const g = this.game;
    // Remove views for NPCs that died or left the visible neighborhood.
    for (const [id, rt] of this.npcRt) {
      const npc = g.npcs[id];
      if (!this.isNpcVisible(npc)) {
        this.iso.scene.remove(rt.view.group);
        this.npcRt.delete(id);
      }
    }
    for (const npc of g.npcs) {
      if (!this.isNpcVisible(npc)) continue;
      const rt = this.ensureNpcRuntime(npc);
      const inPlayerZone = npc.zx === g.zx && npc.zy === g.zy;
      if (inPlayerZone) this.updateNpcBehavior(npc, rt, dt);
      else if (npc.plan && !npc.yielded) this.followPlanFrame(npc, dt);

      const h = g.world.heightAt(npc.zx, npc.zy, npc.lx, npc.ly);
      rt.view.group.position.set(npc.zx * ZONE_SIZE + npc.lx, h, npc.zy * ZONE_SIZE + npc.ly);
      rt.view.group.scale.y = npc.yielded ? 0.6 : 1;
      if (rt.hitFlash > 0) {
        rt.hitFlash -= dt;
        rt.view.group.scale.setScalar(1 + rt.hitFlash * 0.8);
        rt.view.group.scale.y *= npc.yielded ? 0.6 : 1;
      }
      const mat = rt.view.body.material as THREE.MeshStandardMaterial;
      if (rt.telegraph > 0) {
        mat.emissive.setHex(0xaa2211);
        mat.emissiveIntensity = 0.9;
      } else {
        mat.emissiveIntensity = 0;
      }
      const color = allegianceColor(npc);
      if (npc.hp !== rt.lastHp || color !== rt.lastColor) {
        drawLabel(rt.view.labelCanvas, npc.name, color, npc.hp / npc.maxHp);
        rt.lastHp = npc.hp;
        rt.lastColor = color;
      }
    }
  }

  private updateNpcBehavior(npc: Npc, rt: NpcRuntime, dt: number): void {
    const g = this.game;
    rt.cooldown = Math.max(0, rt.cooldown - dt);
    const distToPlayer = Math.hypot(npc.lx - g.lx, npc.ly - g.ly);

    if (npc.yielded) return;

    if (this.isHostileNow(npc)) {
      if (rt.telegraph > 0) {
        rt.telegraph -= dt;
        if (rt.telegraph <= 0) {
          if (distToPlayer < ENEMY_STRIKE_RANGE * 1.4 && this.iframes <= 0) {
            g.damagePlayer(strikeDamage(npc.attack, 0, g.rng));
          }
          rt.cooldown = ENEMY_ATTACK_COOLDOWN;
        }
        return;
      }
      if (distToPlayer > ENEMY_STRIKE_RANGE) {
        this.moveNpcToward(npc, g.lx, g.ly, NPC_LOCAL_SPEED * 1.35, dt);
      } else if (rt.cooldown <= 0) {
        rt.telegraph = ENEMY_TELEGRAPH;
      }
      return;
    }

    if (npc.allegiance === "player" && npc.order === "follow") {
      const idx = g.followers.filter((f) => f.order === "follow").indexOf(npc);
      const gap = 2.6 + Math.max(0, idx) * 1.1;
      if (distToPlayer > gap) {
        this.moveNpcToward(npc, g.lx, g.ly, NPC_LOCAL_SPEED * 1.6, dt);
      }
      return;
    }

    if (npc.plan) {
      this.followPlanFrame(npc, dt);
      return;
    }

    rt.wanderTimer -= dt;
    if (rt.wanderTimer <= 0) {
      rt.wanderTimer = 2.5 + g.rng() * 4;
      const p = g.world.randomWalkableTile(npc.zx, npc.zy, g.rng);
      const nearLx = npc.lx + (p.lx - npc.lx) * 0.4;
      const nearLy = npc.ly + (p.ly - npc.ly) * 0.4;
      rt.targetLx = nearLx;
      rt.targetLy = nearLy;
    }
    if (Math.hypot(rt.targetLx - npc.lx, rt.targetLy - npc.ly) > 0.6) {
      this.moveNpcToward(npc, rt.targetLx, rt.targetLy, NPC_LOCAL_SPEED * 0.7, dt);
    }
  }

  // Walk a travel plan with collision, one frame at a time. Same waypoints
  // the off-screen sim uses, so hand-off between the two is seamless.
  private followPlanFrame(npc: Npc, dt: number): void {
    const plan = npc.plan;
    if (!plan) return;
    const wp = plan.waypoints[plan.idx];
    const targetLx = wp.zx * ZONE_SIZE + wp.lx - npc.zx * ZONE_SIZE;
    const targetLy = wp.zy * ZONE_SIZE + wp.ly - npc.zy * ZONE_SIZE;
    this.moveNpcToward(npc, targetLx, targetLy, NPC_TRAVEL_SPEED, dt);
    const dist = Math.hypot(worldX(wp) - worldX(npc), worldY(wp) - worldY(npc));
    if (dist < 1.0) {
      plan.idx++;
      normalizeZone(npc);
      if (plan.idx >= plan.waypoints.length) npc.plan = null;
    }
  }

  // Reassign trailing followers to the player's new district, keeping their
  // physical position (local coords may briefly sit outside the district).
  private carryFollowersAcross(): void {
    const g = this.game;
    for (const f of g.followers) {
      if (f.order !== "follow") continue;
      const wx = f.zx * ZONE_SIZE + f.lx;
      const wz = f.zy * ZONE_SIZE + f.ly;
      f.zx = g.zx;
      f.zy = g.zy;
      f.lx = wx - g.zx * ZONE_SIZE;
      f.ly = wz - g.zy * ZONE_SIZE;
    }
  }

  private moveNpcToward(npc: Npc, tx: number, ty: number, speed: number, dt: number): void {
    const dx = tx - npc.lx;
    const dy = ty - npc.ly;
    const d = Math.hypot(dx, dy);
    if (d < 0.01) return;
    const step = Math.min(speed * dt, d);
    const nx = npc.lx + (dx / d) * step;
    const ny = npc.ly + (dy / d) * step;
    // Free movement when out of the district frame or standing somewhere
    // unwalkable (e.g. an off-screen ghost-walk ended on water): the NPC may
    // pass through blockers until back on legal ground.
    const outside = npc.lx < 0 || npc.ly < 0 || npc.lx >= ZONE_SIZE || npc.ly >= ZONE_SIZE;
    const freeMove = outside || !this.game.world.isWalkable(npc.zx, npc.zy, npc.lx, npc.ly);
    if (freeMove || this.game.world.isWalkable(npc.zx, npc.zy, nx, ny)) {
      npc.lx = nx;
      npc.ly = ny;
    } else if (this.game.world.isWalkable(npc.zx, npc.zy, nx, npc.ly)) {
      npc.lx = nx;
    } else if (this.game.world.isWalkable(npc.zx, npc.zy, npc.lx, ny)) {
      npc.ly = ny;
    }
    const rt = this.npcRt.get(npc.id);
    if (rt) rt.view.group.rotation.y = Math.atan2(dx / d, dy / d);
  }

  private updateItems(t: number): void {
    const g = this.game;
    for (const [id, view] of this.itemViews) {
      const item = g.items.find((i) => i.id === id)!;
      const visible =
        item.heldBy === "world" &&
        Math.abs(item.zx - g.zx) <= 1 &&
        Math.abs(item.zy - g.zy) <= 1;
      if (!visible) {
        this.iso.scene.remove(view);
        this.itemViews.delete(id);
      }
    }
    for (const item of g.items) {
      if (item.heldBy !== "world") continue;
      if (Math.abs(item.zx - g.zx) > 1 || Math.abs(item.zy - g.zy) > 1) continue;
      let view = this.itemViews.get(item.id);
      if (!view) {
        view = makeItemView(item);
        this.itemViews.set(item.id, view);
        this.iso.scene.add(view);
      }
      const h = g.world.heightAt(item.zx, item.zy, item.lx, item.ly);
      view.position.set(item.zx * ZONE_SIZE + item.lx, h, item.zy * ZONE_SIZE + item.ly);
      animateItemView(view, t);
    }
  }

  // ---- main loop ----

  private loop = (): void => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    if (this.state === "playing") {
      this.game.elapsed += dt;
      this.sim.update(this.game, dt);
      this.updatePlayer(dt);
      this.updateNpcs(dt);
      this.updateItems(t);
      this.updateActions();
      this.hud.tick(dt);
      this.minimapTimer -= dt;
      if (this.minimapTimer <= 0) {
        this.minimapTimer = 0.5;
        this.hud.drawMinimap(this.game);
        this.hud.updateInventory(this.game);
        this.hud.setDay(this.game.day);
        this.refreshDistricts();
      }
      this.iso.follow(this.playerWorldPos(), dt);
    }
    if (this.state !== "title" && this.game) {
      this.iso.render();
    }
  };
}

function shortName(npc: Npc): string {
  return npc.name.split(" ")[0];
}

new App();
