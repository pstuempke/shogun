// Minimal typed event bus decoupling the simulation from UI/renderer.

type Handler<T> = (payload: T) => void;

export interface GameEvents {
  ticker: { text: string; kind: "info" | "good" | "bad" | "rumor" };
  followerChange: { count: number };
  goldChange: { gold: number };
  hpChange: { hp: number; maxHp: number };
  phaseChange: { phase: string };
  zoneChange: { zx: number; zy: number; name: string };
  npcDied: { id: number };
  npcAllegiance: { id: number };
  itemTaken: { id: number };
  itemDropped: { id: number };
  combatStart: { npcId: number };
  combatEnd: { npcId: number };
  playerDefeated: Record<string, never>;
  victory: { score: number };
}

export class Bus {
  private handlers = new Map<string, Set<Handler<unknown>>>();

  on<K extends keyof GameEvents>(event: K, fn: Handler<GameEvents[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn as Handler<unknown>);
    return () => set!.delete(fn as Handler<unknown>);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    this.handlers.get(event)?.forEach((fn) => fn(payload));
  }
}
