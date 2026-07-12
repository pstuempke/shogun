import { describe, expect, it } from "vitest";
import { gossip, narrateMemory, remember } from "../src/sim/memory";
import { getAffinity, seedAffinities, shiftAffinity } from "../src/sim/social";
import { Game } from "../src/sim/game";
import { Simulation } from "../src/sim/simulation";
import { mulberry32 } from "../src/core/rng";
import { MEMORY_CAPACITY, FOLLOWERS_TO_WIN, SACRED_ITEM_COUNT } from "../src/core/constants";
import { PLAYER_ID, type Memory, type Npc } from "../src/core/types";

function makeNpc(id: number, overrides: Partial<Npc> = {}): Npc {
  return {
    id,
    name: `Npc ${id}`,
    role: "peasant",
    rank: 0,
    zx: 0,
    zy: 0,
    lx: 10,
    ly: 10,
    hp: 70,
    maxHp: 70,
    attack: 5,
    disposition: 0,
    allegiance: "none",
    order: "follow",
    alive: true,
    hostile: false,
    yielded: false,
    isRivalLeader: false,
    carrying: null,
    plan: null,
    memories: [],
    traits: { brave: 0.5, gregarious: 0.5, greedy: 0.5, pious: 0.5 },
    needs: { rest: 0, social: 0, purpose: 0, safety: 0 },
    behavior: null,
    chatCooldown: 0,
    mission: null,
    ...overrides,
  };
}

function mem(day: number, kind: Memory["kind"], subjectId = 1, objectId = 2): Memory {
  return { day, kind, subjectId, objectId, zx: 2, zy: 3, secondhand: false };
}

describe("remember", () => {
  it("caps the buffer and evicts oldest non-treasure first", () => {
    const npc = makeNpc(0);
    remember(npc, mem(1, "treasure", 0, 0));
    for (let d = 2; d <= MEMORY_CAPACITY + 2; d++) {
      remember(npc, mem(d, "fight", d, d + 1));
    }
    expect(npc.memories).toHaveLength(MEMORY_CAPACITY);
    expect(npc.memories.some((m) => m.kind === "treasure")).toBe(true);
    expect(npc.memories.some((m) => m.day === 2)).toBe(false);
  });

  it("ignores duplicate events", () => {
    const npc = makeNpc(0);
    expect(remember(npc, mem(1, "fight"))).toBe(true);
    expect(remember(npc, { ...mem(1, "fight"), secondhand: true })).toBe(false);
    expect(npc.memories).toHaveLength(1);
  });
});

describe("gossip", () => {
  it("passes fresh news both ways, marked secondhand", () => {
    const a = makeNpc(0);
    const b = makeNpc(1);
    remember(a, mem(3, "fight", 5, 6));
    remember(b, mem(2, "recruit", 7, 8));
    const shared = gossip(a, b);
    expect(shared).toBe(2);
    expect(b.memories.find((m) => m.kind === "fight")?.secondhand).toBe(true);
    expect(a.memories.find((m) => m.kind === "recruit")?.secondhand).toBe(true);
  });

  it("does not re-share known news", () => {
    const a = makeNpc(0);
    const b = makeNpc(1);
    remember(a, mem(3, "fight"));
    gossip(a, b);
    expect(gossip(a, b)).toBe(0);
  });
});

describe("narrateMemory", () => {
  const g = new Game("samurai", false, 5);

  it("narrates witnessed and secondhand events with relative days", () => {
    const m = mem(1, "fight", 0, 1);
    const text = narrateMemory(m, g.npcs, g.world, 3);
    expect(text).toContain("I saw");
    expect(text).toContain(g.npcs[0].name);
    expect(text).toContain("2 days ago");
    const hearsay = narrateMemory({ ...m, secondhand: true }, g.npcs, g.world, 1);
    expect(hearsay).toContain("I heard that");
    expect(hearsay).toContain("today");
  });

  it("names the player in player-driven events", () => {
    const text = narrateMemory(mem(1, "death", PLAYER_ID, 3), g.npcs, g.world, 1);
    expect(text).toContain("you cut down");
  });
});

describe("affinities", () => {
  it("seeds role-based relationships symmetrically", () => {
    const npcs = [
      makeNpc(0, { role: "bandit" }),
      makeNpc(1, { role: "samurai" }),
      makeNpc(2, { role: "monk" }),
      makeNpc(3, { role: "monk" }),
    ];
    const map = seedAffinities(npcs, mulberry32(1));
    expect(getAffinity(map, 0, 1)).toBeLessThan(-30); // bandit vs samurai
    expect(getAffinity(map, 1, 2)).toBeGreaterThan(0); // monks are liked
    expect(getAffinity(map, 2, 3)).toBeGreaterThan(20); // same role + monk
    expect(getAffinity(map, 0, 1)).toBe(getAffinity(map, 1, 0));
  });

  it("shifts and clamps", () => {
    const npcs = [makeNpc(0), makeNpc(1)];
    const map = seedAffinities(npcs, mulberry32(1));
    shiftAffinity(map, 0, 1, 500);
    expect(getAffinity(map, 0, 1)).toBe(100);
  });
});

describe("Game news integration", () => {
  it("witnesses record recruit events in the player's district", () => {
    const g = new Game("noble", false, 7);
    const target = g.npcs.find((n) => n.rank === 0 && !n.hostile)!;
    const witness = g.npcs.find((n) => n !== target && n.alive)!;
    // co-locate everyone
    g.zx = target.zx = witness.zx = 2;
    g.zy = target.zy = witness.zy = 2;
    target.disposition = 100;
    let ok = false;
    for (let i = 0; i < 20 && !ok; i++) ok = g.befriend(target).success;
    expect(ok).toBe(true);
    expect(witness.memories.some((m) => m.kind === "recruit" && m.subjectId === PLAYER_ID)).toBe(true);
  });

  it("askNews narrates and reveals treasure locations", () => {
    const g = new Game("noble", false, 7);
    for (const n of g.npcs.filter((n) => !n.isRivalLeader).slice(0, FOLLOWERS_TO_WIN)) {
      n.allegiance = "player";
    }
    g.visitEmperor(); // phase 2: treasures placed, witnesses seeded
    const informed = g.npcs.find((n) => n.memories.some((m) => m.kind === "treasure"))!;
    informed.disposition = 50;
    const text = g.askNews(informed);
    expect(text).toContain("rests somewhere in");
    expect(g.knownTreasures.size).toBeGreaterThan(0);
  });

  it("hostile NPCs refuse to share news", () => {
    const g = new Game("noble", false, 7);
    const npc = g.npcs[0];
    npc.disposition = -50;
    expect(g.askNews(npc)).toContain("nothing to say");
  });

  it("treasure news spreads through the world by gossip", () => {
    const g = new Game("noble", false, 21);
    for (const n of g.npcs.filter((n) => !n.isRivalLeader).slice(0, FOLLOWERS_TO_WIN)) {
      n.allegiance = "player";
    }
    g.visitEmperor();
    const sim = new Simulation();
    for (let t = 0; t < 600; t++) sim.tick(g);
    const informed = g.npcs.filter((n) => n.memories.some((m) => m.kind === "treasure")).length;
    expect(informed).toBeGreaterThan(SACRED_ITEM_COUNT); // more know than the original witnesses
  });
});
