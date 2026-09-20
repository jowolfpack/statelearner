/** One prompt/answer pair. `front` and `back` are both askable directions. */
export interface Card {
  id: string;
  front: string;
  back: string;
  /** Extra spellings accepted when `front` is the answer. */
  frontAliases?: string[];
  /** Extra spellings accepted when `back` is the answer. */
  backAliases?: string[];
}

/** A small batch of cards that is studied and drilled as a unit. */
export interface Group {
  id: string;
  name: string;
  cardIds: string[];
}

/**
 * A set of cards plus the names of its two sides. Everything downstream
 * (session logic, UI labels) reads the side names from here, so adding a new
 * subject means adding a Deck and nothing else.
 */
export interface Deck {
  id: string;
  name: string;
  frontLabel: string;
  backLabel: string;
  cards: Card[];
  groups: Group[];
}

export function cardsOf(deck: Deck, group: Group): Card[] {
  return group.cardIds.map((id) => {
    const card = deck.cards.find((candidate) => candidate.id === id);
    if (card === undefined) throw new Error(`Group ${group.id} references unknown card ${id}`);
    return card;
  });
}

/**
 * One group holding every card in the deck, for a run at the whole thing. Kept
 * out of `deck.groups` so the real groups still partition the cards exactly
 * once.
 */
export function wholeDeckGroup(deck: Deck): Group {
  return {
    id: "all",
    name: `All ${deck.cards.length} ${deck.frontLabel}s`,
    cardIds: deck.cards.map((card) => card.id),
  };
}
