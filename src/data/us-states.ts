import type { Deck, Group } from "./types";
import table from "./us-states.json";

/** [state, capital, postal code], shared with scripts/build-map.mjs. */
const STATES: ReadonlyArray<readonly [string, string, string]> = (table as string[][]).map(
  (row) => {
    const [state, capital, code] = row;
    if (state === undefined || capital === undefined || code === undefined) {
      throw new Error(`Malformed row in us-states.json: ${JSON.stringify(row)}`);
    }
    return [state, capital, code] as const;
  },
);

/**
 * US Census divisions. Small (3-8 states) and geographically contiguous, so a
 * group reads as a region on the map rather than an arbitrary slice.
 */
const DIVISIONS: ReadonlyArray<readonly [string, string, string[]]> = [
  ["new-england", "New England", ["CT", "ME", "MA", "NH", "RI", "VT"]],
  ["middle-atlantic", "Middle Atlantic", ["NJ", "NY", "PA"]],
  ["east-north-central", "East North Central", ["IL", "IN", "MI", "OH", "WI"]],
  ["west-north-central", "West North Central", ["IA", "KS", "MN", "MO", "NE", "ND", "SD"]],
  ["south-atlantic", "South Atlantic", ["DE", "FL", "GA", "MD", "NC", "SC", "VA", "WV"]],
  ["east-south-central", "East South Central", ["AL", "KY", "MS", "TN"]],
  ["west-south-central", "West South Central", ["AR", "LA", "OK", "TX"]],
  ["mountain", "Mountain", ["AZ", "CO", "ID", "MT", "NV", "NM", "UT", "WY"]],
  ["pacific", "Pacific", ["AK", "CA", "HI", "OR", "WA"]],
];

const groups: Group[] = DIVISIONS.map(([id, name, codes]) => ({
  id,
  name,
  cardIds: codes.map((code) => code.toLowerCase()),
}));

export const usStatesDeck: Deck = {
  id: "us-states",
  name: "US States & Capitals",
  frontLabel: "State",
  backLabel: "Capital",
  cards: STATES.map(([state, capital, code]) => ({
    id: code.toLowerCase(),
    front: state,
    back: capital,
    // Typing the postal code counts when the state is the answer.
    frontAliases: [code],
  })),
  groups,
};
