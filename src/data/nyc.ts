import type { Card, Deck, Group } from "./types";
import { NYC_LANDMARKS, NYC_MAP_VIEWBOX, NYC_PATHS } from "./nyc-map";

/**
 * The neighborhoods as *Not For Tourists New York* classifies them, in the
 * book's own order and sections. `id` matches the region id in nyc-map.ts.
 */
const AREAS: ReadonlyArray<readonly [string, string, string[]]> = [
  // id, name as printed, extra spellings beyond the slash-separated parts
  ["financial-district", "Financial District", ["FiDi", "Wall Street"]],
  ["tribeca", "TriBeCa", []],
  ["city-hall-chinatown", "City Hall / Chinatown", []],
  ["lower-east-side", "Lower East Side", ["LES"]],
  ["west-village", "West Village", []],
  ["washington-sq", "Washington Sq / NYU / NoHo / SoHo", ["Washington Square"]],
  ["east-village", "East Village", []],

  ["chelsea", "Chelsea", []],
  ["flatiron", "Flatiron / Lower Midtown", []],
  ["murray-hill-gramercy", "Murray Hill / Gramercy", []],
  ["hells-kitchen", "Hell's Kitchen", ["Clinton"]],
  ["midtown", "Midtown", []],
  ["east-midtown", "East Midtown", []],

  ["uws-lower", "Upper West Side (Lower)", ["UWS Lower", "Lower Upper West Side"]],
  ["ues-lower", "Upper East Side (Lower)", ["UES Lower", "Lower Upper East Side"]],
  ["uws-upper", "Upper West Side (Upper)", ["UWS Upper", "Upper Upper West Side"]],
  ["ues-east-harlem", "Upper East Side / East Harlem", ["UES"]],
  ["morningside-heights", "Columbia / Morningside Heights", []],
  ["harlem-lower", "Harlem (Lower)", ["Lower Harlem"]],
  ["el-barrio", "El Barrio / East Harlem", []],

  ["manhattanville", "Manhattanville / Hamilton Heights", []],
  ["harlem-upper", "Harlem (Upper)", ["Upper Harlem"]],
  ["washington-heights", "Washington Heights", []],
  ["fort-george", "Fort George / Fort Tryon", []],
  ["inwood", "Inwood", []],

  ["astoria", "Astoria", []],
  ["long-island-city", "Long Island City", ["LIC"]],
  ["greenpoint", "Greenpoint", []],
  ["williamsburg", "Williamsburg", []],
  ["brooklyn-heights", "Brooklyn Heights / DUMBO / Downtown", ["Downtown Brooklyn"]],
  ["fort-greene", "Fort Greene / Clinton Hill", []],
  ["bococa", "BoCoCa / Red Hook", ["Boerum Hill", "Cobble Hill", "Carroll Gardens"]],
  ["park-slope", "Park Slope / Prospect Heights / Windsor Terrace", []],
  ["hoboken", "Hoboken", []],
  ["jersey-city", "Jersey City", []],
];

const SECTIONS: ReadonlyArray<readonly [string, string, string[]]> = [
  [
    "downtown",
    "Downtown",
    [
      "financial-district",
      "tribeca",
      "city-hall-chinatown",
      "lower-east-side",
      "west-village",
      "washington-sq",
      "east-village",
    ],
  ],
  [
    "midtown-section",
    "Midtown",
    [
      "chelsea",
      "flatiron",
      "murray-hill-gramercy",
      "hells-kitchen",
      "midtown",
      "east-midtown",
    ],
  ],
  [
    "uptown",
    "Uptown",
    [
      "uws-lower",
      "ues-lower",
      "uws-upper",
      "ues-east-harlem",
      "morningside-heights",
      "harlem-lower",
      "el-barrio",
    ],
  ],
  [
    "way-uptown",
    "Way Uptown",
    ["manhattanville", "harlem-upper", "washington-heights", "fort-george", "inwood"],
  ],
  [
    "leaving-manhattan",
    "Leaving Manhattan",
    [
      "astoria",
      "long-island-city",
      "greenpoint",
      "williamsburg",
      "brooklyn-heights",
      "fort-greene",
      "bococa",
      "park-slope",
      "hoboken",
      "jersey-city",
    ],
  ],
];

/**
 * Compound names are accepted a part at a time: typing "SoHo" answers
 * "Washington Sq / NYU / NoHo / SoHo". Learning the place matters, not the
 * punctuation between its names.
 */
function spellings(name: string, extra: string[]): string[] {
  const parts = name
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  return [...new Set([name, ...parts, ...extra])];
}

const cards: Card[] = AREAS.map(([id, name, extra]) => ({
  id,
  front: name,
  // The "back" of one of these cards is its place on the map, which the map
  // renders from the card id. There is no second written side.
  back: name,
  frontAliases: spellings(name, extra),
}));

const groups: Group[] = SECTIONS.map(([id, name, cardIds]) => ({ id, name, cardIds }));

const byId = new Map(groups.map((group) => [group.id, group]));

const regions: Group[] = [
  ["manhattan", "Manhattan", ["downtown", "midtown-section", "uptown", "way-uptown"]],
  ["across-the-rivers", "Across the Rivers", ["leaving-manhattan"]],
].map(([id, name, sectionIds]) => ({
  id: id as string,
  name: name as string,
  cardIds: (sectionIds as string[]).flatMap((sectionId) => {
    const section = byId.get(sectionId);
    if (section === undefined) throw new Error(`Unknown section ${sectionId}`);
    return section.cardIds;
  }),
}));

export const nycDeck: Deck = {
  id: "nyc",
  name: "NYC Neighborhoods",
  frontLabel: "Neighborhood",
  backLabel: "Location",
  backKind: "map",
  cards,
  groups,
  regions,
  map: {
    viewBox: NYC_MAP_VIEWBOX,
    paths: NYC_PATHS,
    landmarks: NYC_LANDMARKS,
    label: "Map of New York City neighborhoods",
  },
};
