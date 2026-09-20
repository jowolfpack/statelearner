/**
 * Generates src/data/nyc-map.ts.
 *
 *   npm run build:nyc-map
 *
 * No open dataset has neighborhood boundaries at the granularity Not For
 * Tourists uses, so this builds them:
 *
 *   1. Take the real land silhouette -- NYC Open Data for the boroughs,
 *      OpenStreetMap (ODbL) for the two New Jersey municipalities.
 *   2. Rotate into the Manhattan street grid, which runs 27.6 degrees east of
 *      north. Every cut is then parallel or perpendicular to the avenues, so
 *      boundaries meet at right angles the way the city does.
 *   3. Cut each neighborhood out as a rectangle in that frame, trimmed to land.
 *
 * Boundaries are declared below as two corners each, given as real street
 * intersections in [lat, lon]. Moving one is a one-line edit.
 */
import { readFileSync, writeFileSync } from "node:fs";
import polygonClipping from "polygon-clipping";

const SOURCE = "https://data.cityofnewyork.us/api/geospatial/9nt8-h7nd?method=export&format=GeoJSON";
const OUT = new URL("../src/data/nyc-map.ts", import.meta.url);
const NJ = JSON.parse(readFileSync(new URL("./nj-boundaries.json", import.meta.url), "utf-8"));

const WIDTH = 900;
const HEIGHT = 1300;
const PRECISION = 1;

/** Measured off Fifth Avenue: the avenues bear 27.64 degrees east of north. */
const GRID = (27.64 * Math.PI) / 180;
const COS = Math.cos(GRID);
const SIN = Math.sin(GRID);
const M_LON = 111320 * Math.cos((40.75 * Math.PI) / 180);
const M_LAT = 110574;

/** Into the grid frame: u runs across the avenues, v runs along them. */
const rot = ([lon, lat]) => {
  const x = lon * M_LON;
  const y = lat * M_LAT;
  return [x * COS - y * SIN, x * SIN + y * COS];
};

const unrot = ([u, v]) => [(u * COS + v * SIN) / M_LON, (-u * SIN + v * COS) / M_LAT];

/** An ordinary lat/lon rectangle. The viewport has no reason to follow the grid. */
function latLonBox([latA, lonA], [latB, lonB]) {
  const [lat0, lat1] = [Math.min(latA, latB), Math.max(latA, latB)];
  const [lon0, lon1] = [Math.min(lonA, lonB), Math.max(lonA, lonB)];
  return [
    [
      [
        [lon0, lat0],
        [lon1, lat0],
        [lon1, lat1],
        [lon0, lat1],
        [lon0, lat0],
      ],
    ],
  ];
}

/**
 * The grid, in metres from Fifth Avenue and 42nd Street, measured off real
 * intersections. `u` runs east across the avenues, `v` north along them.
 * Everything Manhattan is declared against these, so a boundary moves by
 * changing one number.
 */
const ORIGIN = rot([-73.9822, 40.7532]);
const U = {
  farWest: -3000,
  tenth: -1331,
  ninth: -1067,
  eighth: -771,
  seventh: -510,
  sixth: -259,
  fifth: 0,
  madison: 200,
  park: 440,
  lex: 640,
  third: 886,
  second: 1101,
  first: 1307,
  farEast: 3000,
  // Downtown runs on its own angle, so these are cuts, not avenues.
  westSide: -450,
  broadway: 150,
  bowery: 1100,
  lafayette: 481,
  villageWest: -380,
  parkSouth: 350,
  lexSouth: 900,
  eighthSouth: -900,
  seventhSouth: -300,
  harlemWest: -700,
  fifthNorth: 300,
};
const V = {
  south: -7000,
  chambers: -4850,
  canal: -4125,
  houston: -3234,
  astor: -2685,
  fourteenth: -2019,
  twentyThird: -1479,
  thirtyFourth: -607,
  fortySecond: 96,
  fiftyNinth: 1430,
  seventySecond: 2703,
  seventyNinth: 3396,
  ninetySixth: 4620,
  oneTenth: 5491,
  oneTwentyFifth: 6590,
  oneFortyFifth: 8351,
  oneEightyFirst: 11348,
  dyckman: 13062,
  north: 16000,
};

/** A block bounded by two cross-streets and two avenues, by name. */
function gridBlock(south, north, west, east) {
  const u0 = ORIGIN[0] + U[west];
  const u1 = ORIGIN[0] + U[east];
  const v0 = ORIGIN[1] + V[south];
  const v1 = ORIGIN[1] + V[north];
  if ([u0, u1, v0, v1].some(Number.isNaN)) {
    throw new Error(`Unknown grid line in ${south}/${north}/${west}/${east}`);
  }
  return [
    [[unrot([u0, v0]), unrot([u1, v0]), unrot([u1, v1]), unrot([u0, v1]), unrot([u0, v0])]],
  ];
}

/**
 * Manhattan, by the names New Yorkers use rather than the book's rows.
 * Order matters: each block is trimmed against everything already claimed, so
 * a small area listed early keeps its ground and the larger one around it
 * takes the remainder.
 */
const MANHATTAN = [
  // Downtown
  ["battery-park-city", "south", "chambers", "farWest", "westSide"],
  ["financial-district", "south", "chambers", "westSide", "farEast"],
  ["tribeca", "chambers", "canal", "farWest", "broadway"],
  ["chinatown", "chambers", "canal", "broadway", "farEast"],
  ["hudson-square", "canal", "houston", "farWest", "westSide"],
  ["soho", "canal", "houston", "westSide", "lafayette"],
  ["little-italy", "canal", "houston", "lafayette", "bowery"],
  ["lower-east-side", "canal", "houston", "bowery", "farEast"],
  ["noho", "houston", "astor", "broadway", "bowery"],
  ["west-village", "houston", "fourteenth", "farWest", "villageWest"],
  ["greenwich-village", "houston", "fourteenth", "villageWest", "broadway"],
  ["east-village", "houston", "fourteenth", "broadway", "farEast"],
  // Midtown
  ["chelsea", "fourteenth", "thirtyFourth", "farWest", "villageWest"],
  ["flatiron", "fourteenth", "thirtyFourth", "villageWest", "parkSouth"],
  ["gramercy", "fourteenth", "thirtyFourth", "parkSouth", "lexSouth"],
  ["kips-bay", "fourteenth", "thirtyFourth", "lexSouth", "farEast"],
  ["hudson-yards", "thirtyFourth", "fortySecond", "farWest", "eighthSouth"],
  ["garment-district", "thirtyFourth", "fortySecond", "eighthSouth", "parkSouth"],
  ["murray-hill", "thirtyFourth", "fortySecond", "parkSouth", "farEast"],
  ["hells-kitchen", "thirtyFourth", "fiftyNinth", "farWest", "eighthSouth"],
  ["theater-district", "fortySecond", "fiftyNinth", "eighthSouth", "seventhSouth"],
  ["midtown-east", "fortySecond", "fiftyNinth", "seventhSouth", "farEast"],
  // Uptown -- Central Park is cut back out of these below
  ["lincoln-square", "fiftyNinth", "seventySecond", "farWest", "seventhSouth"],
  ["lenox-hill", "fiftyNinth", "seventyNinth", "fifthNorth", "farEast"],
  ["upper-west-side", "seventySecond", "ninetySixth", "farWest", "seventhSouth"],
  ["carnegie-hill", "seventyNinth", "ninetySixth", "fifthNorth", "lexSouth"],
  ["yorkville", "seventyNinth", "ninetySixth", "lexSouth", "farEast"],
  ["manhattan-valley", "ninetySixth", "oneTenth", "farWest", "seventhSouth"],
  ["east-harlem", "ninetySixth", "oneTwentyFifth", "fifthNorth", "farEast"],
  // Harlem and above
  ["morningside-heights", "oneTenth", "oneTwentyFifth", "farWest", "harlemWest"],
  ["hamilton-heights", "oneTwentyFifth", "oneFortyFifth", "farWest", "harlemWest"],
  ["central-harlem", "oneTenth", "oneFortyFifth", "harlemWest", "farEast"],
  ["washington-heights", "oneFortyFifth", "oneEightyFirst", "farWest", "farEast"],
  ["fort-george", "oneEightyFirst", "dyckman", "farWest", "farEast"],
  ["inwood", "dyckman", "north", "farWest", "farEast"],
];

/**
 * Jersey City's neighbourhoods. OpenStreetMap has these only as points, and
 * they are not official boundaries, so these boxes are an approximation --
 * unlike the ten municipalities, which are real. Axis-aligned on purpose:
 * Jersey City is not on the Manhattan grid.
 */
const JERSEY_CITY_PARTS = [
  ["jc-heights", [40.735, -74.07], [40.775, -74.02]],
  ["jc-journal-square", [40.722, -74.075], [40.74, -74.05]],
  ["jc-downtown", [40.708, -74.05], [40.733, -74.02]],
  ["jc-west-side", [40.706, -74.1], [40.74, -74.072]],
  ["jc-bergen-lafayette", [40.695, -74.085], [40.72, -74.045]],
  ["jc-greenville", [40.655, -74.11], [40.7, -74.05]],
];

/** The eight added municipalities, drawn from their real boundaries. */
const NJ_TOWNS = [
  "weehawken",
  "union-city",
  "west-new-york",
  "guttenberg",
  "north-bergen",
  "edgewater",
  "fort-lee",
  "cliffside-park",
];

/**
 * Across the rivers the book's areas line up well with NYC Open Data's own
 * polygons, so each is a union of those rather than a rectangle: real
 * boundaries, the same as the New Jersey municipalities.
 */
const OUTER_PARTS = [
  [
    "astoria",
    [
      "Astoria (Central)",
      "Astoria (North)-Ditmars-Steinway",
      "Astoria (East)-Woodside (North)",
      "Astoria Park",
      "Old Astoria-Hallets Point",
    ],
  ],
  [
    "long-island-city",
    [
      "Long Island City-Hunters Point",
      "Queensbridge-Ravenswood-Dutch Kills",
      "Sunnyside Yards (North)",
      "Sunnyside Yards (South)",
    ],
  ],
  ["greenpoint", ["Greenpoint"]],
  ["williamsburg", ["Williamsburg", "South Williamsburg", "East Williamsburg"]],
  // Boerum Hill belongs to BoCoCa in the book, but the city merges it into
  // Downtown Brooklyn, and splitting it would mean inventing a line again.
  [
    "brooklyn-heights",
    ["Brooklyn Heights", "Downtown Brooklyn-DUMBO-Boerum Hill", "Brooklyn Navy Yard"],
  ],
  ["fort-greene", ["Fort Greene", "Clinton Hill"]],
  ["bococa", ["Carroll Gardens-Cobble Hill-Gowanus-Red Hook"]],
  ["park-slope", ["Park Slope", "Prospect Heights", "Windsor Terrace-South Slope"]],
];

/**
 * The New Jersey waterfront, south to north. Municipal boundaries there run out
 * into the Hudson to the state line, which is how Jersey City swallowed Ellis
 * and Liberty Islands and painted over Hoboken's waterfront. NYC Open Data
 * stops at the state border, so this shoreline is authored; everything inland
 * of it is the real municipal boundary.
 */
const NJ_SHORELINE = [
  [-74.075, 40.66],
  [-74.068, 40.672],
  [-74.062, 40.685],
  [-74.056, 40.695],
  [-74.052, 40.702],
  [-74.0465, 40.706],
  [-74.043, 40.7105],
  [-74.039, 40.7135],
  [-74.0335, 40.7165],
  [-74.03, 40.722],
  [-74.027, 40.73],
  [-74.0255, 40.736],
  [-74.024, 40.745],
  [-74.0235, 40.752],
  // North of here the line is set from Manhattan's own west edge, measured off
  // the borough polygons, less the river's width -- which narrows from about
  // 2km at Weehawken to 1.3km at the George Washington Bridge.
  [-74.0235, 40.76],
  [-74.0191, 40.77],
  [-74.014, 40.78],
  [-74.01, 40.79],
  [-74.003, 40.8],
  [-73.995, 40.81],
  [-73.985, 40.82],
  [-73.977, 40.83],
  [-73.968, 40.84],
  [-73.964, 40.85],
  [-73.957, 40.86],
  [-73.95, 40.87],
  [-73.944, 40.88],
  [-73.942, 40.89],
];

/** Land west of that shoreline. */
const NJ_LAND = [
  [[[-74.14, 40.658], ...NJ_SHORELINE, [-74.14, 40.895], [-74.14, 40.658]]],
];

/** Everything drawn, so far Brooklyn and Queens stay off the map. */
const VIEWPORT = latLonBox([40.648, -74.102], [40.895, -73.892]);

function toMultiPolygon(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  throw new Error(`Unexpected geometry ${geometry.type}`);
}

/** Rounding damps the floating-point noise that upsets the sweep-line clipper. */
function clean(multi) {
  const r = (v) => Math.round(v * 1e6) / 1e6;
  return multi.map((poly) => poly.map((ring) => ring.map(([x, y]) => [r(x), r(y)])));
}

function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return Math.abs(sum / 2);
}

/**
 * The single biggest polygon. Manhattan borough also contains Governors,
 * Ellis, Liberty, Randall's and Roosevelt Islands plus Marble Hill, none of
 * which the book names -- and a block cut against them produces stray shapes
 * floating in the harbour.
 */
function largestPolygon(multi) {
  let best = null;
  let bestArea = -1;
  for (const polygon of multi) {
    const area = ringArea(polygon[0]);
    if (area > bestArea) {
      bestArea = area;
      best = polygon;
    }
  }
  return best === null ? [] : [best];
}

function bboxOf(multi) {
  const pts = multi.flat(2);
  return [
    Math.min(...pts.map((p) => p[0])),
    Math.min(...pts.map((p) => p[1])),
    Math.max(...pts.map((p) => p[0])),
    Math.max(...pts.map((p) => p[1])),
  ];
}

const overlaps = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/**
 * Trimming each piece to the viewport before unioning keeps the inputs small;
 * unioning every Brooklyn and Queens polygon at once overwhelms the clipper.
 */
function unionWithin(features, bounds) {
  const box = bboxOf(bounds);
  const pieces = [];
  for (const feature of features) {
    const multi = clean(toMultiPolygon(feature.geometry));
    if (!overlaps(bboxOf(multi), box)) continue;
    const trimmed = polygonClipping.intersection(multi, bounds);
    if (trimmed.length > 0) pieces.push(trimmed);
  }
  if (pieces.length === 0) return [];
  return polygonClipping.union(pieces[0], ...pieces.slice(1));
}

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`${SOURCE} -> HTTP ${response.status}`);
const nta = await response.json();

const inBorough = (name) => nta.features.filter((f) => f.properties.boroname === name);

// Each set of blocks is cut against its own land, never against all of it.
const manhattanIsland = largestPolygon(unionWithin(inBorough("Manhattan"), VIEWPORT));
const outerLand = unionWithin([...inBorough("Brooklyn"), ...inBorough("Queens")], VIEWPORT);
// Staten Island is out of frame; the Bronx is kept as context to the north.
const nycLand = unionWithin(
  [...inBorough("Manhattan"), ...inBorough("Brooklyn"), ...inBorough("Queens"), ...inBorough("Bronx")],
  VIEWPORT,
);
// Municipal boundaries run out into the Hudson to the state line, so every one
// of them is trimmed to land first.
const njMask = polygonClipping.intersection(NJ_LAND, VIEWPORT);
const townLand = (id) => polygonClipping.intersection(clean(NJ.polygons[id]), njMask);
const jerseyCityLand = townLand("jersey-city");
// The whole Jersey bank is drawn as context, not just the named areas.
const silhouette = polygonClipping.union(nycLand, njMask);

/** The union of named city polygons, as one shape. */
function ntaShape(names) {
  const parts = names.map((name) => {
    const found = nta.features.filter((f) => f.properties.ntaname === name);
    if (found.length === 0) throw new Error(`No city polygon named "${name}"`);
    return clean(found.flatMap((f) => toMultiPolygon(f.geometry)));
  });
  return parts.reduce((all, part) => polygonClipping.union(all, part));
}

const park = polygonClipping.intersection(
  clean(
    nta.features
      .filter((f) => f.properties.ntaname === "Central Park")
      .flatMap((f) => toMultiPolygon(f.geometry)),
  ),
  VIEWPORT,
);
if (park.length === 0) throw new Error("Central Park not found in the source");

// Prospect Park is labelled on the book's map too, so it gets the same
// treatment: drawn as a landmark and cut out of the areas around it.
const prospect = polygonClipping.intersection(ntaShape(["Prospect Park"]), VIEWPORT);
if (prospect.length === 0) throw new Error("Prospect Park not found in the source");

const regions = [];
const shapes = [
  ...MANHATTAN.map(([id, s2, n, w, e]) => [id, gridBlock(s2, n, w, e), manhattanIsland]),
  ...OUTER_PARTS.map(([id, names]) => [id, ntaShape(names), outerLand]),
  // Whole municipalities: their own boundary is the shape, land does the rest.
  ["hoboken", clean(NJ.polygons.hoboken), njMask],
  ...NJ_TOWNS.map((id) => [id, clean(NJ.polygons[id]), njMask]),
  // Jersey City is cut into its neighbourhoods, which have no official lines.
  ...JERSEY_CITY_PARTS.map(([id, a, b]) => [id, latLonBox(a, b), jerseyCityLand]),
];
// Claimed ground, so no two areas can cover the same block. Across the rivers
// the blocks are drawn generously and would otherwise overlap, leaving whichever
// happened to be drawn last painted over its neighbour.
let claimed = [];
for (const [id, shape, land] of shapes) {
  // Cut the block out of real land, then take the park back out, so Central
  // Park reads as a hole in the grid rather than being paved over.
  const onLand = polygonClipping.intersection(land, shape);
  const unclaimed =
    claimed.length === 0 ? onLand : polygonClipping.difference(onLand, claimed);
  const piece = polygonClipping.difference(unclaimed, park, prospect);
  if (piece.length === 0) throw new Error(`${id} does not land on any land`);
  regions.push([id, piece]);
  claimed = claimed.length === 0 ? piece : polygonClipping.union(claimed, piece);
}

/**
 * A real point inside each area *as the book draws it* -- not the centre of the
 * neighborhood's full real extent, which sometimes spills past the book's row.
 * A block that does not contain its own landmark is in the wrong place, which
 * is easiest to get wrong across the rivers, where the grid does not apply.
 */
const LANDMARKS = {
  // Manhattan, from OpenStreetMap's own neighbourhood records.
  "battery-park-city": [40.711, -74.0169],
  "financial-district": [40.7077, -74.0093],
  tribeca: [40.7154, -74.0093],
  chinatown: [40.7165, -73.9963],
  "hudson-square": [40.7268, -74.008],
  soho: [40.7229, -73.9988],
  "little-italy": [40.7193, -73.9982],
  "lower-east-side": [40.7159, -73.9868],
  noho: [40.7259, -73.994],
  "west-village": [40.7342, -74.0056],
  // OSM's Greenwich Village record is a 7th Avenue South address, which is
  // really the West Village; Washington Square is the honest centre.
  "greenwich-village": [40.7308, -73.9973],
  "east-village": [40.7293, -73.9874],
  chelsea: [40.7465, -74.0015],
  flatiron: [40.7411, -73.9897],
  gramercy: [40.738, -73.9859],
  "kips-bay": [40.7395, -73.9771],
  "hudson-yards": [40.7559, -74.0005],
  "garment-district": [40.7537, -73.9905],
  "murray-hill": [40.7482, -73.9788],
  "hells-kitchen": [40.7644, -73.9924],
  "theater-district": [40.758, -73.9855],
  "midtown-east": [40.7535, -73.9689],
  "lincoln-square": [40.7723, -73.9844],
  "lenox-hill": [40.7664, -73.959],
  "upper-west-side": [40.787, -73.9754],
  "carnegie-hill": [40.7842, -73.9543],
  yorkville: [40.778, -73.9482],
  "manhattan-valley": [40.7998, -73.9678],
  "east-harlem": [40.7947, -73.9425],
  "morningside-heights": [40.81, -73.9625],
  "hamilton-heights": [40.8241, -73.9501],
  "central-harlem": [40.8079, -73.9455],
  "washington-heights": [40.8402, -73.9402],
  "fort-george": [40.8593, -73.9297],
  inwood: [40.8693, -73.9205],
  // Across the rivers
  astoria: [40.7644, -73.9235],
  "long-island-city": [40.7447, -73.9485],
  greenpoint: [40.7304, -73.9512],
  williamsburg: [40.7143, -73.9566],
  "brooklyn-heights": [40.6959, -73.9937],
  "fort-greene": [40.6892, -73.9742],
  bococa: [40.686, -73.997],
  "park-slope": [40.671, -73.978],
  // New Jersey: computed interior points, since a bounding-box centre on a
  // narrow waterfront strip lands in the river.
  hoboken: [40.7429, -74.0337],
  weehawken: [40.7673, -74.0232],
  "union-city": [40.7667, -74.0303],
  "west-new-york": [40.7877, -74.0159],
  guttenberg: [40.7956, -74.0126],
  "north-bergen": [40.7888, -74.0269],
  edgewater: [40.8385, -73.9695],
  "fort-lee": [40.8468, -73.9735],
  "cliffside-park": [40.8184, -73.9882],
  "jc-heights": [40.752, -74.0522],
  "jc-journal-square": [40.731, -74.0656],
  "jc-downtown": [40.7199, -74.0382],
  "jc-west-side": [40.7204, -74.086],
  "jc-bergen-lafayette": [40.7075, -74.072],
  "jc-greenville": [40.6844, -74.0859],
};


const dot = ([lat, lon]) => {
  const e = 2e-4;
  return [
    [
      [
        [lon - e, lat - e],
        [lon + e, lat - e],
        [lon + e, lat + e],
        [lon - e, lat + e],
        [lon - e, lat - e],
      ],
    ],
  ];
};

const misplaced = [];
for (const [id, geom] of regions) {
  const at = LANDMARKS[id];
  if (at === undefined) throw new Error(`No landmark declared for ${id}`);
  if (polygonClipping.intersection(geom, dot(at)).length === 0) misplaced.push(id);
}
if (misplaced.length > 0) {
  throw new Error(`These areas do not cover their own location: ${misplaced.join(", ")}`);
}

// Two areas covering the same ground means one is drawn over the other.
const clashes = [];
for (let i = 0; i < regions.length; i++) {
  for (let j = i + 1; j < regions.length; j++) {
    if (polygonClipping.intersection(regions[i][1], regions[j][1]).length > 0) {
      clashes.push(`${regions[i][0]}/${regions[j][0]}`);
    }
  }
}
if (clashes.length > 0) throw new Error(`Overlapping areas: ${clashes.join(", ")}`);

// A Manhattan block must never pick up land across a river: cutting against the
// wrong landmass is what put Governors Island inside the Financial District.
for (const [id, , land] of shapes) {
  const other = land === manhattanIsland ? outerLand : manhattanIsland;
  const region = regions.find(([regionId]) => regionId === id)?.[1] ?? [];
  const strays = polygonClipping.intersection(region, other);
  if (strays.length > 0) {
    throw new Error(`${id} picked up land from the wrong side of the water`);
  }
}

// Project planar-Mercator by hand. d3-geo treats polygons as spherical, where a
// ring wound the wrong way means "the whole globe except this", and every path
// ends up covering the canvas.
const R = 6378137;
const project = ([lon, lat]) => [
  (lon * Math.PI * R) / 180,
  R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
];
const projectAll = (multi) => multi.map((poly) => poly.map((ring) => ring.map(project)));

const projected = regions.map(([id, geom]) => [id, projectAll(geom)]);
const silhouetteXY = projectAll(silhouette);
const parkXY = projectAll(park);
const prospectXY = projectAll(prospect);

const every = [...projected.flatMap(([, g]) => g), ...silhouetteXY].flat(2);
const minX = Math.min(...every.map(([x]) => x));
const maxX = Math.max(...every.map(([x]) => x));
const minY = Math.min(...every.map(([, y]) => y));
const maxY = Math.max(...every.map(([, y]) => y));
const scale = Math.min(WIDTH / (maxX - minX), HEIGHT / (maxY - minY));

// Mercator y grows northward; SVG y grows downward.
const toCanvas = ([x, y]) => [(x - minX) * scale, (maxY - y) * scale];

const round = (value) => {
  let text = value.toFixed(PRECISION);
  if (text.includes(".")) text = text.replace(/\.?0+$/, "");
  return text === "-0" ? "0" : text;
};

function draw(multi) {
  let out = "";
  for (const polygon of multi) {
    for (const ring of polygon) {
      // polygon-clipping repeats the first point last; SVG's Z closes for us.
      const points = ring.slice(0, -1).map(toCanvas);
      if (points.length < 3) continue;
      out += points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${round(x)},${round(y)}`).join("");
      out += "Z";
    }
  }
  return out;
}

const paths = projected.map(([id, geom]) => {
  const d = draw(geom);
  if (d === "") throw new Error(`${id} produced an empty path`);
  return [id, d];
});

const PAD = 6;
const viewBox = [
  -PAD,
  -PAD,
  Math.round((maxX - minX) * scale * 10) / 10 + PAD * 2,
  Math.round((maxY - minY) * scale * 10) / 10 + PAD * 2,
].join(" ");

writeFileSync(
  OUT,
  `// Generated by scripts/build-nyc-map.mjs -- do not edit by hand.
// Land from NYC Open Data and, for New Jersey, OpenStreetMap (ODbL).
// Neighborhood boundaries are rectangles in the Manhattan street grid, declared
// as corner intersections in that script. Move a corner to move a boundary.

export const NYC_MAP_VIEWBOX = "${viewBox}";

/** Card id -> SVG path data. */
export const NYC_PATHS: Record<string, string> = {
${paths.map(([id, d]) => `  ${JSON.stringify(id)}: ${JSON.stringify(d)},`).join("\n")}
};

/** Drawn for orientation, never asked about. */
export const NYC_LANDMARKS: Record<string, string> = {
  land: ${JSON.stringify(draw(silhouetteXY))},
  "central-park": ${JSON.stringify(draw(parkXY))},
  "prospect-park": ${JSON.stringify(draw(prospectXY))},
};
`,
  "utf-8",
);

const bytes = paths.reduce((sum, [, d]) => sum + d.length, 0);
console.log(`Wrote ${paths.length} regions, ${(bytes / 1024).toFixed(1)} kB of path data`);
