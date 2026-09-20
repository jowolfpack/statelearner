/** One prompt/answer pair. `front` and `back` are both askable directions. */
export interface Card {
  id: string;
  front: string;
  back: string;
  /** Extra spellings accepted when `front` is the answer. */
  frontAliases?: string[];
  /** Extra spellings accepted when `back` is the answer. */
  backAliases?: string[];
  /** Respelling fed to the speech engine when `front` is mispronounced. */
  frontSpoken?: string;
  /** Respelling fed to the speech engine when `back` is mispronounced. */
  backSpoken?: string;
}

/** A small batch of cards that is studied and drilled as a unit. */
export interface Group {
  id: string;
  name: string;
  cardIds: string[];
}

export type SideKind = "text" | "map";

/** Geometry for decks whose cards live on a map, keyed by card id. */
export interface DeckMap {
  viewBox: string;
  paths: Record<string, string>;
  /** For the rendered SVG's accessible name, e.g. "Map of the United States". */
  label: string;
  /** Drawn for orientation but never asked about, e.g. Central Park. */
  landmarks?: Record<string, string>;
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
  /**
   * Optional coarser groupings, each the union of several `groups`, for
   * learning more at once. Kept separate so `groups` stays a clean partition
   * of the cards.
   */
  regions?: Group[];
  /** Supplied by decks that show their cards on a map. */
  map?: DeckMap;
  /**
   * What the back of a card is. "map" means the card's place on the map rather
   * than a second written side: it is shown by highlighting and answered by
   * clicking. Defaults to "text".
   */
  backKind?: SideKind;
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
