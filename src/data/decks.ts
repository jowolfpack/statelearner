import type { Deck } from "./types";
import { usStatesDeck } from "./us-states";

/** Every deck the app offers. Add new subjects here. */
export const decks: Deck[] = [usStatesDeck];

export function deckById(id: string | null): Deck {
  const found = decks.find((deck) => deck.id === id);
  if (found !== undefined) return found;
  const first = decks[0];
  if (first === undefined) throw new Error("No decks registered");
  return first;
}
