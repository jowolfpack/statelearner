import type { Card, Deck } from "./data/types";

/** Which side of the card is shown; `mixed` picks per card. */
export type Direction = "front-to-back" | "back-to-front" | "mixed";

export interface Question {
  cardId: string;
  prompt: string;
  promptLabel: string;
  answerLabel: string;
  /** The canonical answer, shown when the user gets it wrong. */
  answer: string;
  /** Every spelling that counts as correct. */
  accepted: string[];
}

function askBack(deck: Deck, card: Card): Question {
  return {
    cardId: card.id,
    prompt: card.front,
    promptLabel: deck.frontLabel,
    answerLabel: deck.backLabel,
    answer: card.back,
    accepted: [card.back, ...(card.backAliases ?? [])],
  };
}

function askFront(deck: Deck, card: Card): Question {
  return {
    cardId: card.id,
    prompt: card.back,
    promptLabel: deck.backLabel,
    answerLabel: deck.frontLabel,
    answer: card.front,
    accepted: [card.front, ...(card.frontAliases ?? [])],
  };
}

/** Builds the question for one card. `mixed` rolls a direction per card. */
export function questionFor(
  deck: Deck,
  card: Card,
  direction: Direction,
  rng: () => number,
): Question {
  switch (direction) {
    case "front-to-back":
      return askBack(deck, card);
    case "back-to-front":
      return askFront(deck, card);
    case "mixed":
      return rng() < 0.5 ? askBack(deck, card) : askFront(deck, card);
  }
}

export function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
