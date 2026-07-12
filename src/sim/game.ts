import {
  FOLLOWERS_TO_WIN,
  GAME_DAY_SECONDS,
  KOBAN_PICKUP_MAX,
  KOBAN_PICKUP_MIN,
  PALACE_ZX,
  PALACE_ZY,
  RANSOM_FOLLOWER_FRACTION,
  RANSOM_GOLD_FRACTION,
  SACRED_ITEM_COUNT,
  TEMPLE_ZX,
  TEMPLE_ZY,
  TILE,
  WORLD_H,
  WORLD_SEED,
  WORLD_W,
  ZONE_TILES,
} from "../core/constants";
import { Bus } from "../core/bus";
import type {
  FollowerOrder,
  GamePhase,
  Item,
  Npc,
  PlayerClass,
} from "../core/types";
import { mulberry32, pick, randInt, shuffled, type Rng } from "../core/rng";
import { World } from "./world";
import { ROSTER } from "./roster";
import { getClass } from "./classes";
import { attemptBefriend, attemptBribe, befriendChance, bribeCost, giveGift } from "./social";
import { npcShouldYield } from "./combat";
import { finalScore, questComplete, readyForAudience, sacredItemDistricts, SACRED_NAMES } from "./quest";

const GIFT_NAMES: [string, number][] = [
  ["Lacquered Tea Set", 30],
  ["Bolt of Silk", 40],
  ["Ivory Netsuke", 25],
  ["Plum Wine Cask", 20],
  ["Calligraphy Scroll", 35],
  ["Jade Comb", 28],
  ["Incense Box", 22],
  ["Painted Fan", 18],
];

const WEAPON_NAMES: [string, number][] = [
  ["Tanto Dagger", 3],
  ["Wakizashi", 5],
  ["Fine Katana", 8],
  ["Naginata", 10],
];

export class Game {
  readonly bus = new Bus();
  readonly world: World;
  readonly rng: Rng;
  readonly playerClass: PlayerClass;
  readonly honorMode: boolean;

  npcs: Npc[] = [];
  items: Item[] = [];
  phase: GamePhase = "gathering";
  elapsed = 0;

  hp: number;
  maxHp: number;
  gold: number;
  weaponBonus = 0;

  zx = 3;
  zy = 3;
  lx = (ZONE_TILES / 2) * TILE;
  ly = (ZONE_TILES / 2) * TILE;

  emperorMet = false;
  score = 0;
  defeatCount = 0;

  constructor(classId: string, honorMode = false, seed: number = WORLD_SEED) {
    this.playerClass = getClass(classId);
    this.honorMode = honorMode;
    this.world = new World(seed);
    this.rng = mulberry32(seed ^ 0xc0ffee);
    this.hp = this.playerClass.hp;
    this.maxHp = this.playerClass.hp;
    this.gold = this.playerClass.gold;
    this.spawnNpcs();
    this.spawnItems();
  }

  // ---- setup ----

  private spawnNpcs(): void {
    const zones: { zx: number; zy: number }[] = [];
    for (let zy = 0; zy < WORLD_H; zy++) {
      for (let zx = 0; zx < WORLD_W; zx++) {
        if (zx === PALACE_ZX && zy === PALACE_ZY) continue;
        if (zx === this.zx && zy === this.zy) continue;
        zones.push({ zx, zy });
      }
    }
    const spots = shuffled(this.rng, zones);
    this.npcs = ROSTER.map((r, i) => {
      const z = spots[i % spots.length];
      const p = this.world.randomWalkableTile(z.zx, z.zy, this.rng);
      return {
        id: i,
        name: r.name,
        role: r.role,
        rank: r.rank,
        zx: z.zx,
        zy: z.zy,
        lx: p.lx,
        ly: p.ly,
        hp: r.hp,
        maxHp: r.hp,
        attack: r.attack,
        disposition: r.disposition,
        allegiance: "none" as const,
        order: "follow" as const,
        alive: true,
        hostile: r.hostile,
        yielded: false,
        isRivalLeader: r.isRivalLeader,
        carrying: null,
        plan: null,
      };
    });
  }

  private spawnItems(): void {
    let id = 0;
    const place = (kind: Item["kind"], name: string, value: number, sacredIndex = -1): void => {
      const zx = randInt(this.rng, 0, WORLD_W - 1);
      const zy = randInt(this.rng, 0, WORLD_H - 1);
      if (zx === PALACE_ZX && zy === PALACE_ZY) return place(kind, name, value, sacredIndex);
      const p = this.world.randomWalkableTile(zx, zy, this.rng);
      this.items.push({
        id: id++,
        kind,
        name,
        value,
        zx,
        zy,
        lx: p.lx,
        ly: p.ly,
        heldBy: "world",
        sacredIndex,
      });
    };
    for (let i = 0; i < 14; i++) {
      place("koban", "Pouch of Koban", randInt(this.rng, KOBAN_PICKUP_MIN, KOBAN_PICKUP_MAX));
    }
    for (const [name, value] of GIFT_NAMES) place("gift", name, value);
    for (const [name, value] of WEAPON_NAMES) place("weapon", name, value);
  }

  // The Emperor's quest: the four treasures appear only in phase 2.
  private placeSacredItems(): void {
    const districts = sacredItemDistricts(this.rng);
    let id = this.items.reduce((m, i) => Math.max(m, i.id), 0) + 1;
    districts.forEach((z, idx) => {
      const p = this.world.randomWalkableTile(z.zx, z.zy, this.rng);
      this.items.push({
        id: id++,
        kind: "sacred",
        name: SACRED_NAMES[idx],
        value: 0,
        zx: z.zx,
        zy: z.zy,
        lx: p.lx,
        ly: p.ly,
        heldBy: "world",
        sacredIndex: idx,
      });
    });
  }

  // ---- queries ----

  get day(): number {
    return Math.floor(this.elapsed / GAME_DAY_SECONDS) + 1;
  }

  get followers(): Npc[] {
    return this.npcs.filter((n) => n.alive && n.allegiance === "player");
  }

  get followerCount(): number {
    return this.followers.length;
  }

  get inventory(): Item[] {
    return this.items.filter((i) => i.heldBy === "player");
  }

  get recruitablePool(): number {
    return this.npcs.filter((n) => n.alive && !n.isRivalLeader).length;
  }

  npcsInZone(zx: number, zy: number): Npc[] {
    return this.npcs.filter((n) => n.alive && n.zx === zx && n.zy === zy);
  }

  itemsInZone(zx: number, zy: number): Item[] {
    return this.items.filter((i) => i.heldBy === "world" && i.zx === zx && i.zy === zy);
  }

  rivalFollowerCount(): number {
    return this.npcs.filter((n) => n.alive && n.allegiance === "rival").length;
  }

  ticker(text: string, kind: "info" | "good" | "bad" | "rumor" = "info"): void {
    this.bus.emit("ticker", { text, kind });
  }

  // ---- player actions ----

  examine(npc: Npc): string {
    const stance =
      npc.allegiance === "player"
        ? "sworn to you"
        : npc.allegiance === "rival"
          ? "sworn to Lord Ishido"
          : npc.hostile
            ? "hostile"
            : npc.disposition > 30
              ? "friendly"
              : npc.disposition < -20
                ? "wary of you"
                : "neutral";
    const roleLabel = npc.role.charAt(0).toUpperCase() + npc.role.slice(1);
    const chance = befriendChance(this.persuader(), npc);
    return `${npc.name} — ${roleLabel} (rank ${npc.rank}). Currently ${stance}. Persuasion odds: ${Math.round(chance)}%.`;
  }

  private persuader(): { persuasion: number; rank: number; followerCount: number } {
    return {
      persuasion: this.playerClass.persuasion,
      rank: this.playerClass.rank,
      followerCount: this.followerCount,
    };
  }

  befriend(npc: Npc): { success: boolean; chance: number } {
    if (npc.allegiance === "player") return { success: true, chance: 100 };
    const wasRival = npc.allegiance === "rival";
    const res = attemptBefriend(this.persuader(), npc, this.rng());
    if (res.success) {
      this.ticker(`${npc.name} joins your cause!${wasRival ? " Ishido curses your name." : ""}`, "good");
      this.bus.emit("npcAllegiance", { id: npc.id });
      this.bus.emit("followerChange", { count: this.followerCount });
      this.checkGatheringProgress();
    } else {
      this.ticker(`${npc.name} refuses you. (${Math.round(res.chance)}% odds)`, "bad");
    }
    return res;
  }

  bribe(npc: Npc): { ok: boolean; message: string } {
    if (npc.allegiance === "player") return { ok: false, message: "Already loyal to you." };
    const res = attemptBribe(this.gold, npc);
    if (res.outcome === "too_hostile") {
      return { ok: false, message: `${npc.name} spits at your gold.` };
    }
    if (res.outcome === "cannot_afford") {
      return { ok: false, message: `You need ${res.cost} koban to sway ${npc.name}.` };
    }
    this.gold -= res.cost;
    this.bus.emit("goldChange", { gold: this.gold });
    this.bus.emit("npcAllegiance", { id: npc.id });
    this.bus.emit("followerChange", { count: this.followerCount });
    this.ticker(`${npc.name} accepts ${res.cost} koban and joins you.`, "good");
    this.checkGatheringProgress();
    return { ok: true, message: `${npc.name} pockets ${res.cost} koban.` };
  }

  bribeCostFor(npc: Npc): number {
    return bribeCost(npc);
  }

  give(npc: Npc, item: Item): string {
    if (item.heldBy !== "player") return "You do not carry that.";
    if (item.kind === "sacred") return "You cannot part with an Imperial treasure.";
    item.heldBy = "npc";
    npc.carrying = item.id;
    if (item.kind === "koban") {
      const gain = giveGift(npc, item.value);
      return `${npc.name} accepts the koban. (+${gain} regard)`;
    }
    const gain = giveGift(npc, item.value);
    return `${npc.name} treasures the ${item.name}. (+${gain} regard)`;
  }

  takeItem(item: Item): string {
    if (item.kind === "koban") {
      item.heldBy = "npc"; // consumed; removed from world
      this.gold += item.value;
      this.bus.emit("goldChange", { gold: this.gold });
      this.bus.emit("itemTaken", { id: item.id });
      return `Picked up ${item.value} koban.`;
    }
    item.heldBy = "player";
    this.bus.emit("itemTaken", { id: item.id });
    if (item.kind === "weapon" && item.value > this.weaponBonus) {
      this.weaponBonus = item.value;
      return `You take the ${item.name}. Your strikes sharpen (+${item.value}).`;
    }
    if (item.kind === "sacred") {
      const left = SACRED_ITEM_COUNT - this.sacredCarried();
      this.ticker(`You recovered ${item.name}! ${left > 0 ? `${left} treasure(s) remain.` : "Return to the Emperor!"}`, "good");
      return `You take ${item.name}.`;
    }
    return `You take the ${item.name}.`;
  }

  dropItem(item: Item): void {
    if (item.heldBy !== "player") return;
    item.heldBy = "world";
    item.zx = this.zx;
    item.zy = this.zy;
    item.lx = this.lx;
    item.ly = this.ly;
    if (item.kind === "weapon") {
      this.weaponBonus = Math.max(
        0,
        ...this.inventory.filter((i) => i.kind === "weapon").map((i) => i.value),
      );
    }
    this.bus.emit("itemDropped", { id: item.id });
  }

  setOrder(npc: Npc, order: FollowerOrder): void {
    if (npc.allegiance !== "player") return;
    npc.order = order;
    const words: Record<FollowerOrder, string> = {
      follow: "falls in behind you",
      wait: "will wait here",
      guard: "stands guard over this district",
    };
    this.ticker(`${npc.name} ${words[order]}.`, "info");
  }

  // ---- combat outcomes (real-time loop applies damage; this handles state) ----

  damageNpc(npc: Npc, dmg: number): "dead" | "yielded" | "fighting" {
    npc.hp -= dmg;
    if (npc.hp <= 0) {
      npc.hp = 0;
      npc.alive = false;
      if (npc.allegiance === "player") {
        this.bus.emit("followerChange", { count: this.followerCount });
      }
      this.bus.emit("npcDied", { id: npc.id });
      this.ticker(`${npc.name} has been slain.`, "bad");
      this.checkPoolViability();
      return "dead";
    }
    if (npcShouldYield(npc)) {
      npc.yielded = true;
      npc.hostile = false;
      return "yielded";
    }
    return "fighting";
  }

  damagePlayer(dmg: number): void {
    this.hp = Math.max(0, this.hp - dmg);
    this.bus.emit("hpChange", { hp: this.hp, maxHp: this.maxHp });
    if (this.hp <= 0) this.onPlayerDefeated();
  }

  private onPlayerDefeated(): void {
    this.defeatCount++;
    this.bus.emit("playerDefeated", {});
    if (this.honorMode) {
      this.phase = "lost";
      this.bus.emit("phaseChange", { phase: this.phase });
      this.ticker("You have fallen. In the way of honour, there is no second life.", "bad");
      return;
    }
    // Mercy of the monks: ransomed back to life at the temple, at a price.
    const goldLost = Math.floor(this.gold * RANSOM_GOLD_FRACTION);
    this.gold -= goldLost;
    const fs = this.followers;
    const toLose = Math.floor(fs.length * RANSOM_FOLLOWER_FRACTION);
    for (const f of shuffled(this.rng, fs).slice(0, toLose)) {
      f.allegiance = "none";
      f.disposition = Math.min(f.disposition, 0);
    }
    this.hp = this.maxHp;
    this.zx = TEMPLE_ZX;
    this.zy = TEMPLE_ZY;
    const p = this.world.randomWalkableTile(this.zx, this.zy, this.rng);
    this.lx = p.lx;
    this.ly = p.ly;
    this.bus.emit("hpChange", { hp: this.hp, maxHp: this.maxHp });
    this.bus.emit("goldChange", { gold: this.gold });
    this.bus.emit("followerChange", { count: this.followerCount });
    this.bus.emit("zoneChange", { zx: this.zx, zy: this.zy, name: this.world.district(this.zx, this.zy).name });
    this.ticker(
      `Monks drag you from the field. Ransom: ${goldLost} koban${toLose > 0 ? ` and ${toLose} follower(s) desert` : ""}.`,
      "bad",
    );
  }

  // ---- quest flow ----

  sacredCarried(): number {
    return this.items.filter((i) => i.sacredIndex >= 0 && i.heldBy === "player").length;
  }

  private checkGatheringProgress(): void {
    if (this.phase === "gathering" && readyForAudience(this.followerCount)) {
      this.ticker(`Twenty souls march behind you. Seek the Emperor at the Imperial Palace!`, "good");
    }
  }

  private checkPoolViability(): void {
    if (this.phase === "gathering" && this.recruitablePool < FOLLOWERS_TO_WIN) {
      this.phase = "lost";
      this.bus.emit("phaseChange", { phase: this.phase });
      this.ticker("Too few souls remain in Japan to raise an army. Your ambition dies here.", "bad");
    }
  }

  atPalaceThrone(): boolean {
    return this.zx === PALACE_ZX && this.zy === PALACE_ZY;
  }

  visitEmperor(): string {
    if (this.phase === "gathering") {
      if (!readyForAudience(this.followerCount)) {
        return `The Emperor's guards turn you away. Return with ${FOLLOWERS_TO_WIN} followers (you have ${this.followerCount}).`;
      }
      this.phase = "quest";
      this.emperorMet = true;
      this.placeSacredItems();
      this.bus.emit("phaseChange", { phase: this.phase });
      this.ticker("The Emperor speaks: recover the four Imperial Treasures and the Shogunate is yours!", "good");
      return "The Emperor grants you audience. Four sacred treasures lie scattered across Japan — bring all four back at once.";
    }
    if (this.phase === "quest") {
      if (!questComplete(this.items)) {
        return `The Emperor waits. You carry ${this.sacredCarried()} of ${SACRED_ITEM_COUNT} treasures.`;
      }
      this.phase = "won";
      this.score = finalScore({
        followers: this.followerCount,
        gold: this.gold,
        sacredDelivered: SACRED_ITEM_COUNT,
        elapsedSeconds: this.elapsed,
        classMultiplier: this.playerClass.scoreMultiplier,
      });
      this.bus.emit("phaseChange", { phase: this.phase });
      this.bus.emit("victory", { score: this.score });
      return "The Emperor names you SHOGUN of all Japan!";
    }
    return "";
  }

  sacredHint(): string | null {
    const lost = this.items.filter((i) => i.sacredIndex >= 0 && i.heldBy === "world");
    if (lost.length === 0) return null;
    const item = pick(this.rng, lost);
    const d = this.world.district(item.zx, item.zy);
    return `Rumour: ${item.name} was seen near ${d.name}.`;
  }
}
