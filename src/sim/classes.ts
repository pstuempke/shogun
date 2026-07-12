import type { PlayerClass } from "../core/types";

// Class choice is the difficulty slider: low rank = weak persuasion and
// purse, but the biggest score multiplier if you still manage to win.
export const PLAYER_CLASSES: readonly PlayerClass[] = [
  {
    id: "peasant",
    label: "Peasant",
    rank: 0,
    persuasion: 18,
    gold: 30,
    attack: 9,
    hp: 90,
    scoreMultiplier: 5,
    blurb: "Nothing but a rice sickle and ambition. The hardest road — and the greatest glory.",
  },
  {
    id: "merchant",
    label: "Merchant",
    rank: 1,
    persuasion: 26,
    gold: 260,
    attack: 10,
    hp: 95,
    scoreMultiplier: 3.5,
    blurb: "Weak of arm, heavy of purse. Gold opens doors that words cannot.",
  },
  {
    id: "ronin",
    label: "Ronin",
    rank: 2,
    persuasion: 32,
    gold: 90,
    attack: 16,
    hp: 115,
    scoreMultiplier: 2.5,
    blurb: "A masterless sword. Feared in a duel, distrusted at court.",
  },
  {
    id: "samurai",
    label: "Samurai",
    rank: 3,
    persuasion: 42,
    gold: 130,
    attack: 15,
    hp: 110,
    scoreMultiplier: 1.5,
    blurb: "Honour and steel. A respected name makes persuasion far easier.",
  },
  {
    id: "noble",
    label: "Noble",
    rank: 4,
    persuasion: 55,
    gold: 200,
    attack: 12,
    hp: 100,
    scoreMultiplier: 1,
    blurb: "Born near the throne. The gentlest path to the Shogunate.",
  },
];

export function getClass(id: string): PlayerClass {
  const c = PLAYER_CLASSES.find((c) => c.id === id);
  if (!c) throw new Error(`unknown class: ${id}`);
  return c;
}
