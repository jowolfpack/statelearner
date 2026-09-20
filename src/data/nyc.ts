import type { Card, Deck, Group } from "./types";
import { NYC_LANDMARKS, NYC_MAP_VIEWBOX, NYC_PATHS } from "./nyc-map";

/**
 * Manhattan by the names New Yorkers actually use. The book was the starting
 * point, but its rows carried labels like "Upper East Side (Lower)" whose
 * halves nothing distinguishes, so these are the real neighborhoods instead.
 * Across the rivers the book's own grouping is kept.
 */
const AREAS: ReadonlyArray<readonly [string, string, string[]]> = [
  // id, name, extra spellings beyond the slash-separated parts
  ["battery-park-city", "Battery Park City", ["BPC"]],
  ["financial-district", "Financial District", ["FiDi", "Wall Street", "Seaport"]],
  ["tribeca", "TriBeCa", []],
  ["chinatown", "Chinatown", ["Two Bridges", "Civic Center"]],
  ["hudson-square", "Hudson Square", []],
  ["soho", "SoHo", ["South of Houston"]],
  ["little-italy", "Little Italy", ["Nolita", "NoLIta"]],
  ["lower-east-side", "Lower East Side", ["LES"]],
  ["noho", "NoHo", []],
  ["west-village", "West Village", ["Meatpacking District", "Meatpacking"]],
  ["greenwich-village", "Greenwich Village", ["The Village", "Washington Square"]],
  ["east-village", "East Village", ["Alphabet City"]],

  ["chelsea", "Chelsea", []],
  ["flatiron", "Flatiron District", ["Flatiron", "Union Square", "NoMad"]],
  ["gramercy", "Gramercy", ["Gramercy Park", "Rose Hill"]],
  ["kips-bay", "Kips Bay", []],
  ["hudson-yards", "Hudson Yards", []],
  ["garment-district", "Garment District", ["Koreatown", "Herald Square"]],
  ["murray-hill", "Murray Hill", []],
  ["hells-kitchen", "Hell's Kitchen", ["Clinton"]],
  ["theater-district", "Theater District", ["Times Square", "Theatre District"]],
  ["midtown-east", "Midtown East", ["Turtle Bay", "Sutton Place", "Tudor City"]],

  ["lincoln-square", "Lincoln Square", ["Columbus Circle"]],
  ["lenox-hill", "Lenox Hill", []],
  ["upper-west-side", "Upper West Side", ["UWS"]],
  ["carnegie-hill", "Carnegie Hill", []],
  ["yorkville", "Yorkville", []],
  ["manhattan-valley", "Manhattan Valley", []],
  ["east-harlem", "East Harlem", ["El Barrio", "Spanish Harlem"]],

  ["morningside-heights", "Morningside Heights", ["Columbia"]],
  ["hamilton-heights", "Hamilton Heights", ["Sugar Hill", "Manhattanville"]],
  ["central-harlem", "Central Harlem", ["Harlem"]],
  ["washington-heights", "Washington Heights", ["Hudson Heights"]],
  ["fort-george", "Fort George", ["Fort Tryon"]],
  ["inwood", "Inwood", []],

  // Across the rivers, as the book has them
  ["astoria", "Astoria", []],
  ["long-island-city", "Long Island City", ["LIC"]],
  ["greenpoint", "Greenpoint", []],
  ["williamsburg", "Williamsburg", []],
  ["brooklyn-heights", "Brooklyn Heights / DUMBO / Downtown", ["Downtown Brooklyn"]],
  ["fort-greene", "Fort Greene / Clinton Hill", []],
  ["bococa", "BoCoCa / Red Hook", ["Boerum Hill", "Cobble Hill", "Carroll Gardens"]],
  ["park-slope", "Park Slope / Prospect Heights / Windsor Terrace", []],
];

/**
 * Beyond the book, which stops at Hoboken and Jersey City. The towns are real
 * municipalities; the six Jersey City areas are its neighbourhoods, which have
 * no official boundaries.
 */
const NEW_JERSEY: ReadonlyArray<readonly [string, string, string[]]> = [
  ["hoboken", "Hoboken", []],
  ["jc-downtown", "Downtown Jersey City", ["Downtown JC", "Downtown"]],
  ["jc-journal-square", "Journal Square", []],
  ["jc-heights", "Jersey City Heights", ["The Heights", "Heights"]],
  ["jc-bergen-lafayette", "Bergen-Lafayette", ["Bergen Lafayette", "Lafayette"]],
  ["jc-west-side", "West Side (Jersey City)", ["West Side", "West Bergen"]],
  ["jc-greenville", "Greenville", []],
  ["weehawken", "Weehawken", []],
  ["union-city", "Union City", []],
  ["west-new-york", "West New York", ["WNY"]],
  ["guttenberg", "Guttenberg", []],
  ["north-bergen", "North Bergen", []],
  ["cliffside-park", "Cliffside Park", []],
  ["edgewater", "Edgewater", []],
  ["fort-lee", "Fort Lee", []],
];

const SECTIONS: ReadonlyArray<readonly [string, string, string[]]> = [
  [
    "downtown",
    "Downtown",
    [
      "battery-park-city",
      "financial-district",
      "tribeca",
      "chinatown",
      "hudson-square",
      "soho",
      "little-italy",
      "lower-east-side",
      "noho",
      "west-village",
      "greenwich-village",
      "east-village",
    ],
  ],
  [
    "midtown-section",
    "Midtown",
    [
      "chelsea",
      "flatiron",
      "gramercy",
      "kips-bay",
      "hudson-yards",
      "garment-district",
      "murray-hill",
      "hells-kitchen",
      "theater-district",
      "midtown-east",
    ],
  ],
  [
    "uptown",
    "Uptown",
    [
      "lincoln-square",
      "lenox-hill",
      "upper-west-side",
      "carnegie-hill",
      "yorkville",
      "manhattan-valley",
      "east-harlem",
    ],
  ],
  [
    "harlem",
    "Harlem & Above",
    [
      "morningside-heights",
      "hamilton-heights",
      "central-harlem",
      "washington-heights",
      "fort-george",
      "inwood",
    ],
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
    ],
  ],
  ["new-jersey", "New Jersey", NEW_JERSEY.map(([id]) => id)],
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

const cards: Card[] = [...AREAS, ...NEW_JERSEY].map(([id, name, extra]) => ({
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
  ["manhattan", "Manhattan", ["downtown", "midtown-section", "uptown", "harlem"]],
  ["across-the-rivers", "Across the Rivers", ["leaving-manhattan", "new-jersey"]],
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
