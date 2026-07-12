import {
  GATE_INSET_TILES,
  PALACE_ZX,
  PALACE_ZY,
  PLAN_TIMEOUT_TICKS,
  TILE,
  WORLD_H,
  WORLD_W,
  ZONE_SIZE,
  ZONE_TILES,
} from "../core/constants";
import type { Npc, TravelPlan, Waypoint } from "../core/types";

const GATE_CENTER = (Math.floor(ZONE_TILES / 2) + 0.5) * TILE;
const INSET = GATE_INSET_TILES * TILE;

export interface WorldPoint {
  zx: number;
  zy: number;
  lx: number;
  ly: number;
}

export function worldX(p: WorldPoint): number {
  return p.zx * ZONE_SIZE + p.lx;
}

export function worldY(p: WorldPoint): number {
  return p.zy * ZONE_SIZE + p.ly;
}

// Re-express a position in the frame of the district that contains it.
export function normalizeZone(p: WorldPoint): void {
  const wx = worldX(p);
  const wy = worldY(p);
  p.zx = Math.min(Math.max(Math.floor(wx / ZONE_SIZE), 0), WORLD_W - 1);
  p.zy = Math.min(Math.max(Math.floor(wy / ZONE_SIZE), 0), WORLD_H - 1);
  p.lx = wx - p.zx * ZONE_SIZE;
  p.ly = wy - p.zy * ZONE_SIZE;
}

// BFS over the district grid. Every adjacent pair of districts is connected
// through the wide gate carved at the middle of their shared edge. The
// palace district is avoided as a through-route unless it is the destination.
function districtRoute(
  fromZx: number,
  fromZy: number,
  toZx: number,
  toZy: number,
): { zx: number; zy: number }[] {
  if (fromZx === toZx && fromZy === toZy) return [{ zx: fromZx, zy: fromZy }];
  const key = (zx: number, zy: number): number => zy * WORLD_W + zx;
  const prev = new Map<number, number>();
  const queue: [number, number][] = [[fromZx, fromZy]];
  prev.set(key(fromZx, fromZy), -1);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  while (queue.length > 0) {
    const [zx, zy] = queue.shift()!;
    if (zx === toZx && zy === toZy) break;
    for (const [dx, dy] of dirs) {
      const nx = zx + dx;
      const ny = zy + dy;
      if (nx < 0 || nx >= WORLD_W || ny < 0 || ny >= WORLD_H) continue;
      const isPalace = nx === PALACE_ZX && ny === PALACE_ZY;
      const isDest = nx === toZx && ny === toZy;
      if (isPalace && !isDest) continue;
      const k = key(nx, ny);
      if (prev.has(k)) continue;
      prev.set(k, key(zx, zy));
      queue.push([nx, ny]);
    }
  }
  const chain: { zx: number; zy: number }[] = [];
  let cur = key(toZx, toZy);
  if (!prev.has(cur)) return [{ zx: fromZx, zy: fromZy }]; // unreachable (cannot happen on this grid)
  while (cur !== -1) {
    chain.push({ zx: cur % WORLD_W, zy: Math.floor(cur / WORLD_W) });
    cur = prev.get(cur)!;
  }
  chain.reverse();
  return chain;
}

// Two waypoints per district crossing: just inside the exit gate, then just
// inside the entry gate on the neighbor's side.
function gateWaypoints(a: { zx: number; zy: number }, b: { zx: number; zy: number }): [Waypoint, Waypoint] {
  if (b.zx > a.zx) {
    return [
      { zx: a.zx, zy: a.zy, lx: ZONE_SIZE - INSET, ly: GATE_CENTER },
      { zx: b.zx, zy: b.zy, lx: INSET, ly: GATE_CENTER },
    ];
  }
  if (b.zx < a.zx) {
    return [
      { zx: a.zx, zy: a.zy, lx: INSET, ly: GATE_CENTER },
      { zx: b.zx, zy: b.zy, lx: ZONE_SIZE - INSET, ly: GATE_CENTER },
    ];
  }
  if (b.zy > a.zy) {
    return [
      { zx: a.zx, zy: a.zy, lx: GATE_CENTER, ly: ZONE_SIZE - INSET },
      { zx: b.zx, zy: b.zy, lx: GATE_CENTER, ly: INSET },
    ];
  }
  return [
    { zx: a.zx, zy: a.zy, lx: GATE_CENTER, ly: INSET },
    { zx: b.zx, zy: b.zy, lx: GATE_CENTER, ly: ZONE_SIZE - INSET },
  ];
}

export function planRoute(
  from: WorldPoint,
  toZx: number,
  toZy: number,
  toLx: number,
  toLy: number,
): TravelPlan {
  const chain = districtRoute(from.zx, from.zy, toZx, toZy);
  const waypoints: Waypoint[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const [exit, entry] = gateWaypoints(chain[i], chain[i + 1]);
    waypoints.push(exit, entry);
  }
  waypoints.push({ zx: toZx, zy: toZy, lx: toLx, ly: toLy });
  return { waypoints, idx: 0, ticksLeft: PLAN_TIMEOUT_TICKS };
}

// Walk the NPC `dist` world-units along its plan (straight lines between
// waypoints, no collision — used for off-screen travel). Position is always
// re-normalized into the containing district. Clears the plan on arrival.
export function advancePlan(npc: Npc, dist: number): void {
  const plan = npc.plan;
  if (!plan) return;
  let budget = dist;
  while (budget > 0 && plan.idx < plan.waypoints.length) {
    const wp = plan.waypoints[plan.idx];
    const dx = worldX(wp) - worldX(npc);
    const dy = worldY(wp) - worldY(npc);
    const d = Math.hypot(dx, dy);
    if (d <= budget) {
      npc.zx = wp.zx;
      npc.zy = wp.zy;
      npc.lx = wp.lx;
      npc.ly = wp.ly;
      budget -= d;
      plan.idx++;
    } else {
      const wx = worldX(npc) + (dx / d) * budget;
      const wy = worldY(npc) + (dy / d) * budget;
      npc.lx = wx - npc.zx * ZONE_SIZE;
      npc.ly = wy - npc.zy * ZONE_SIZE;
      normalizeZone(npc);
      budget = 0;
    }
  }
  if (plan.idx >= plan.waypoints.length) npc.plan = null;
}
