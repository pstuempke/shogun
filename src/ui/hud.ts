import { FOLLOWERS_TO_WIN, TICKER_MAX_LINES, WORLD_H, WORLD_W } from "../core/constants";
import type { Game } from "../sim/game";
import type { Biome } from "../core/types";

const BIOME_COLORS: Record<Biome, string> = {
  village: "#c9a86a",
  forest: "#2e5c36",
  sakura: "#d98cab",
  lake: "#4fa8c9",
  mountain: "#8d8a80",
  paddy: "#86b653",
  temple: "#b06a3c",
  palace: "#d4af37",
  plains: "#7ba955",
};

export interface ActionSpec {
  key: string;
  label: string;
  disabled?: boolean;
  onUse: () => void;
}

export class Hud {
  private el = (id: string): HTMLElement => document.getElementById(id)!;
  private toastTimer = 0;
  private zoneTimer = 0;
  private actions: ActionSpec[] = [];

  show(): void {
    this.el("hud").hidden = false;
  }

  hide(): void {
    this.el("hud").hidden = true;
  }

  setClass(label: string, mult: number): void {
    this.el("stat-class").textContent = `${label} ×${mult}`;
  }

  setHp(hp: number, maxHp: number): void {
    const frac = Math.max(0, hp / maxHp);
    this.el("hp-bar").style.width = `${frac * 100}%`;
    this.el("hp-bar").style.background =
      frac > 0.5 ? "linear-gradient(90deg,#6ecb74,#4aa851)" : frac > 0.25 ? "#e0b13e" : "#d64545";
    this.el("hp-text").textContent = `${Math.ceil(hp)}`;
  }

  setGold(gold: number): void {
    this.el("stat-gold").textContent = `⛁ ${gold} koban`;
  }

  setFollowers(count: number): void {
    this.el("stat-followers").textContent = `⛩ ${count}/${FOLLOWERS_TO_WIN} followers`;
  }

  setObjective(text: string): void {
    this.el("objective").textContent = text;
  }

  ticker(text: string, kind: string): void {
    const box = this.el("ticker");
    const line = document.createElement("div");
    line.className = `line ${kind}`;
    line.textContent = text;
    box.appendChild(line);
    while (box.children.length > TICKER_MAX_LINES) box.removeChild(box.firstChild!);
    [...box.children].forEach((c, i) => {
      c.classList.toggle("old", i < box.children.length - 2);
    });
  }

  toast(text: string, seconds = 3): void {
    const t = this.el("toast");
    t.textContent = text;
    t.hidden = false;
    this.toastTimer = seconds;
  }

  zoneName(name: string): void {
    const z = this.el("zone-name");
    z.textContent = name.toUpperCase();
    z.classList.add("show");
    this.zoneTimer = 2.6;
  }

  setActions(actions: ActionSpec[]): void {
    const same =
      actions.length === this.actions.length &&
      actions.every((a, i) => a.label === this.actions[i].label && a.disabled === this.actions[i].disabled);
    this.actions = actions;
    if (same) return;
    const bar = this.el("actionbar");
    bar.innerHTML = "";
    for (const a of actions) {
      const b = document.createElement("button");
      b.innerHTML = `<span class="key">${a.key}</span>${a.label}`;
      b.disabled = !!a.disabled;
      b.onclick = () => a.onUse();
      bar.appendChild(b);
    }
  }

  triggerAction(key: string): boolean {
    const a = this.actions.find((a) => a.key.toLowerCase() === key.toLowerCase());
    if (a && !a.disabled) {
      a.onUse();
      return true;
    }
    return false;
  }

  updateInventory(game: Game): void {
    const inv = this.el("inventory");
    const items = game.inventory;
    let html = `<div class="inv-title">Satchel</div>`;
    if (items.length === 0) html += `<div class="inv-item">— empty —</div>`;
    for (const i of items) {
      html += `<div class="inv-item ${i.kind}">${i.kind === "sacred" ? "✦ " : ""}${i.name}</div>`;
    }
    inv.innerHTML = html;
  }

  drawMinimap(game: Game): void {
    const canvas = this.el("minimap") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d")!;
    const cell = canvas.width / WORLD_W;
    for (let zy = 0; zy < WORLD_H; zy++) {
      for (let zx = 0; zx < WORLD_W; zx++) {
        const d = game.world.district(zx, zy);
        ctx.fillStyle = BIOME_COLORS[d.biome];
        ctx.fillRect(zx * cell, zy * cell, cell - 1, cell - 1);
      }
    }
    if (game.phase === "quest") {
      ctx.fillStyle = "#ffe9a0";
      for (const i of game.items) {
        if (i.sacredIndex >= 0 && i.heldBy === "world") {
          ctx.beginPath();
          ctx.arc((i.zx + 0.5) * cell, (i.zy + 0.5) * cell, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#7a5a10";
          ctx.stroke();
        }
      }
    }
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#1a1a2a";
    ctx.beginPath();
    ctx.arc((game.zx + 0.5) * cell, (game.zy + 0.5) * cell, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  tick(dt: number): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el("toast").hidden = true;
    }
    if (this.zoneTimer > 0) {
      this.zoneTimer -= dt;
      if (this.zoneTimer <= 0) this.el("zone-name").classList.remove("show");
    }
  }
}
