import { MEMORY_CAPACITY } from "../core/constants";
import { PLAYER_ID, type Memory, type Npc } from "../core/types";
import type { World } from "./world";
import { SACRED_NAMES } from "./quest";

function sameEvent(a: Memory, b: Memory): boolean {
  return (
    a.kind === b.kind && a.subjectId === b.subjectId && a.objectId === b.objectId && a.zx === b.zx && a.zy === b.zy
  );
}

// Add a memory to an NPC's bounded buffer. Duplicates are ignored; when
// full, the oldest non-treasure memory is evicted first (treasure sightings
// are the most valuable news in the game).
export function remember(npc: Npc, m: Memory): boolean {
  if (npc.memories.some((old) => sameEvent(old, m))) return false;
  npc.memories.push(m);
  if (npc.memories.length > MEMORY_CAPACITY) {
    const idx = npc.memories.findIndex((old) => old.kind !== "treasure");
    npc.memories.splice(idx === -1 ? 0 : idx, 1);
  }
  return true;
}

// Mutual news exchange: each side passes its freshest memory the other
// doesn't know yet. Returns how many memories actually transferred.
export function gossip(a: Npc, b: Npc): number {
  let shared = 0;
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as const) {
    for (let i = from.memories.length - 1; i >= 0; i--) {
      const m = from.memories[i];
      if (remember(to, { ...m, secondhand: true })) {
        shared++;
        break;
      }
    }
  }
  return shared;
}

function nameOf(id: number, npcs: Npc[]): string {
  if (id === PLAYER_ID) return "you";
  return npcs[id]?.name ?? "a stranger";
}

function whenOf(m: Memory, today: number): string {
  const ago = today - m.day;
  if (ago <= 0) return "today";
  if (ago === 1) return "yesterday";
  return `${ago} days ago`;
}

export function narrateMemory(m: Memory, npcs: Npc[], world: World, today: number): string {
  const prefix = m.secondhand ? "I heard that" : "I saw";
  const place = world.district(m.zx, m.zy).name;
  const when = whenOf(m, today);
  switch (m.kind) {
    case "fight":
      return `${prefix} ${nameOf(m.subjectId, npcs)} attacked ${nameOf(m.objectId, npcs)} in ${place}, ${when}.`;
    case "death":
      return `${prefix} ${nameOf(m.subjectId, npcs)} cut down ${nameOf(m.objectId, npcs)} in ${place}, ${when}.`;
    case "recruit":
      return `${prefix} ${nameOf(m.objectId, npcs)} swore service to ${nameOf(m.subjectId, npcs)}, ${when}.`;
    case "treasure":
      return `${prefix} ${SACRED_NAMES[m.objectId]} rests somewhere in ${place}.`;
  }
}
