import type { Deck, Group } from "./types";
import { MAP_VIEWBOX, STATE_PATHS } from "./us-map";
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

/**
 * Respellings for names a generic English speech engine gets wrong, keyed by
 * card id. Deliberately short: an override on a name the engine already says
 * correctly makes it worse, and engines differ between devices. Add one only
 * after hearing the name come out wrong.
 */
const SPOKEN: Record<string, { front?: string; back?: string }> = {
  sd: { back: "peer" }, // Pierre, not the French name
  id: { back: "boycee" }, // Boise: BOY-see, not "boyz"
  nh: { back: "conkerd" }, // Concord: CONK-erd
  vt: { back: "mont peelyer" }, // Montpelier: not the French Montpellier
  mt: { back: "hellena" }, // Helena: stress on the first syllable
  ia: { back: "duh moyn" }, // Des Moines
  ak: { back: "joono" }, // Juneau
  wy: { back: "shy ann" }, // Cheyenne
  la: { back: "batton roozh" }, // Baton Rouge
};

const groups: Group[] = DIVISIONS.map(([id, name, codes]) => ({
  id,
  name,
  cardIds: codes.map((code) => code.toLowerCase()),
}));

/**
 * Three coarse regions, each an exact union of divisions, so the hierarchy
 * nests: all 50 > region > division, with no second copy of any state list.
 * Sizes come out 21 / 16 / 13 -- uneven, but each one reads as a contiguous
 * block on the map, which matters more than equal counts.
 */
const REGIONS: ReadonlyArray<readonly [string, string, string[]]> = [
  ["east", "East", ["new-england", "middle-atlantic", "south-atlantic", "east-south-central"]],
  ["mid", "Mid", ["east-north-central", "west-north-central", "west-south-central"]],
  ["west", "West", ["mountain", "pacific"]],
];

const byId = new Map(groups.map((group) => [group.id, group]));

const regions: Group[] = REGIONS.map(([id, name, divisionIds]) => ({
  id,
  name,
  cardIds: divisionIds.flatMap((divisionId) => {
    const division = byId.get(divisionId);
    if (division === undefined) {
      throw new Error(`Region ${id} references unknown division ${divisionId}`);
    }
    return division.cardIds;
  }),
}));

export const usStatesDeck: Deck = {
  id: "us-states",
  name: "US States & Capitals",
  frontLabel: "State",
  backLabel: "Capital",
  cards: STATES.map(([state, capital, code]) => {
    const id = code.toLowerCase();
    const spoken = SPOKEN[id];
    return {
      id,
      front: state,
      back: capital,
      // Typing the postal code counts when the state is the answer.
      frontAliases: [code],
      ...(spoken?.front === undefined ? {} : { frontSpoken: spoken.front }),
      ...(spoken?.back === undefined ? {} : { backSpoken: spoken.back }),
    };
  }),
  groups,
  regions,
  map: { viewBox: MAP_VIEWBOX, paths: STATE_PATHS, label: "Map of the United States" },
};
