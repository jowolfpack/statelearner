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

/** A grid-aligned quad spanning two corners, each given as [lat, lon]. */
function block([latA, lonA], [latB, lonB]) {
  const a = rot([lonA, latA]);
  const b = rot([lonB, latB]);
  const u0 = Math.min(a[0], b[0]);
  const u1 = Math.max(a[0], b[0]);
  const v0 = Math.min(a[1], b[1]);
  const v1 = Math.max(a[1], b[1]);
  // Two corners lying along one grid axis collapse the block to a sliver, which
  // then silently clips away to nothing. Catch it here instead.
  if (u1 - u0 < 120 || v1 - v0 < 120) {
    throw new Error(
      `Block corners are nearly parallel to the grid: ${Math.round(u1 - u0)}m across ` +
        `by ${Math.round(v1 - v0)}m along. Pick corners that differ on both axes.`,
    );
  }
  return [
    [[unrot([u0, v0]), unrot([u1, v0]), unrot([u1, v1]), unrot([u0, v1]), unrot([u0, v0])]],
  ];
}

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
 * Reference points on real avenues and cross-streets. Because the cuts run in
 * the grid frame, every point on one avenue shares a `u`, and every point on
 * one cross-street shares a `v` -- so one point names the whole line.
 */
const AVENUE_POINTS = {
  eighth: [40.7573, -73.9897],
  seventh: [40.756, -73.9871],
  sixth: [40.7546, -73.9847],
  fifth: [40.7532, -73.9822],
  park: [40.7519, -73.9772],
  third: [40.7505, -73.9722],
};

const STREET_POINTS = {
  chambers: [40.7148, -74.0075],
  houston: [40.7255, -73.9955],
  fourteenth: [40.7367, -73.9925],
  thirtyFourth: [40.7484, -73.9857],
  fiftyNinth: [40.7644, -73.9737],
  eightySixth: [40.7794, -73.9594],
  oneTenth: [40.796, -73.949],
  oneTwentyFifth: [40.8045, -73.9422],
  oneFortyFifth: [40.8202, -73.9365],
  oneEightyFirst: [40.85, -73.9345],
  dyckman: [40.8645, -73.927],
};

const U = Object.fromEntries(
  Object.entries(AVENUE_POINTS).map(([k, [lat, lon]]) => [k, rot([lon, lat])[0]]),
);
const V = Object.fromEntries(
  Object.entries(STREET_POINTS).map(([k, [lat, lon]]) => [k, rot([lon, lat])[1]]),
);
// Blocks that run to the water are given edges well past it; land does the rest.
U.farWest = Math.min(...Object.values(U)) - 6000;
U.farEast = Math.max(...Object.values(U)) + 6000;
V.southEnd = Math.min(...Object.values(V)) - 6000;
V.northEnd = Math.max(...Object.values(V)) + 6000;

/**
 * A grid line, named or given as a [lat, lon] point on it. Named lines are
 * measured uptown; extended far enough south they drift off the streets they
 * are named after, because downtown does not follow the Commissioners' grid.
 * Blocks down there name their own points instead.
 */
const uOf = (ref) => (Array.isArray(ref) ? rot([ref[1], ref[0]])[0] : U[ref]);
const vOf = (ref) => (Array.isArray(ref) ? rot([ref[1], ref[0]])[1] : V[ref]);

/** A block bounded by two cross-streets and two avenues. */
function gridBlock(south, north, west, east) {
  const [u0, u1] = [uOf(west), uOf(east)];
  const [v0, v1] = [vOf(south), vOf(north)];
  if (u0 === undefined || u1 === undefined || v0 === undefined || v1 === undefined) {
    throw new Error(`Unknown grid line in a block definition`);
  }
  return [
    [[unrot([u0, v0]), unrot([u1, v0]), unrot([u1, v1]), unrot([u0, v1]), unrot([u0, v0])]],
  ];
}

/** Manhattan, as the book's rows: [id, south street, north street, west ave, east ave]. */
const MANHATTAN = [
  ["financial-district", "southEnd", "chambers", "farWest", "farEast"],
  // Below Houston the streets do not follow the uptown grid, so these name
  // points on the dividing streets themselves rather than uptown avenues.
  ["tribeca", "chambers", "houston", "farWest", [40.7215, -74.0045]],
  ["city-hall-chinatown", "chambers", "houston", [40.7215, -74.0045], [40.717, -73.9935]],
  ["lower-east-side", "chambers", "houston", [40.717, -73.9935], "farEast"],
  ["west-village", "houston", "fourteenth", "farWest", [40.7305, -74.0025]],
  ["washington-sq", "houston", "fourteenth", [40.7305, -74.0025], [40.7275, -73.989]],
  ["east-village", "houston", "fourteenth", [40.7275, -73.989], "farEast"],
  ["chelsea", "fourteenth", "thirtyFourth", "farWest", "sixth"],
  ["flatiron", "fourteenth", "thirtyFourth", "sixth", [40.7395, -73.986]],
  ["murray-hill-gramercy", "fourteenth", "thirtyFourth", [40.7395, -73.986], "farEast"],
  ["hells-kitchen", "thirtyFourth", "fiftyNinth", "farWest", "eighth"],
  ["midtown", "thirtyFourth", "fiftyNinth", "eighth", "park"],
  ["east-midtown", "thirtyFourth", "fiftyNinth", "park", "farEast"],
  // Central Park fills eighth..fifth between 59th and 110th, and is cut out below.
  ["uws-lower", "fiftyNinth", "eightySixth", "farWest", "eighth"],
  ["ues-lower", "fiftyNinth", "eightySixth", "fifth", "farEast"],
  ["uws-upper", "eightySixth", "oneTenth", "farWest", "eighth"],
  ["ues-east-harlem", "eightySixth", "oneTenth", "fifth", "farEast"],
  ["morningside-heights", "oneTenth", "oneTwentyFifth", "farWest", "eighth"],
  ["harlem-lower", "oneTenth", "oneTwentyFifth", "eighth", [40.8005, -73.938]],
  ["el-barrio", "oneTenth", "oneTwentyFifth", [40.8005, -73.938], "farEast"],
  ["manhattanville", "oneTwentyFifth", "oneFortyFifth", "farWest", "eighth"],
  ["harlem-upper", "oneTwentyFifth", "oneFortyFifth", "eighth", "farEast"],
  ["washington-heights", "oneFortyFifth", "oneEightyFirst", "farWest", "farEast"],
  ["fort-george", "oneEightyFirst", "dyckman", "farWest", "farEast"],
  ["inwood", "dyckman", "northEnd", "farWest", "farEast"],
];

/** Across the rivers, where the Manhattan grid does not apply: corner pairs. */
const OUTER = [
  // A chain down the waterfront, then inland. Each is trimmed against whatever
  // the ones above it already claimed, so the order here is the book's.
  ["astoria", [40.756, -73.94], [40.79, -73.895]],
  ["long-island-city", [40.74, -73.96], [40.762, -73.925]],
  ["greenpoint", [40.721, -73.962], [40.7395, -73.933]],
  ["williamsburg", [40.7, -73.972], [40.725, -73.933]],
  ["brooklyn-heights", [40.689, -74.01], [40.705, -73.985]],
  ["fort-greene", [40.68, -73.985], [40.7, -73.96]],
  ["bococa", [40.665, -74.025], [40.689, -73.988]],
  ["park-slope", [40.658, -73.995], [40.684, -73.965]],
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
  [-74.0215, 40.76],
  [-74.019, 40.77],
  [-74.016, 40.782],
  // North of Hoboken nothing is asked about, but the Palisades face Upper
  // Manhattan the whole way up and the map looks cut off without them.
  [-74.01, 40.792],
  [-74.002, 40.805],
  [-73.995, 40.818],
  [-73.988, 40.83],
  [-73.98, 40.842],
  [-73.973, 40.852],
  [-73.966, 40.864],
  [-73.958, 40.878],
  [-73.954, 40.89],
];

/** Land west of that shoreline. */
const NJ_LAND = [
  [[[-74.09, 40.658], ...NJ_SHORELINE, [-74.09, 40.895], [-74.09, 40.658]]],
];

/** Everything drawn, so far Brooklyn and Queens stay off the map. */
const VIEWPORT = latLonBox([40.648, -74.072], [40.895, -73.892]);

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
// Trim each municipality to land, then keep Hoboken whole: the two boundaries
// overlap out in the river, and Jersey City is drawn second.
const hobokenLand = polygonClipping.intersection(
  clean(NJ.polygons.hoboken),
  VIEWPORT,
  NJ_LAND,
);
const jerseyLand = polygonClipping.difference(
  polygonClipping.intersection(clean(NJ.polygons["jersey-city"]), VIEWPORT, NJ_LAND),
  hobokenLand,
);
const njPieces = [hobokenLand, jerseyLand];
if (polygonClipping.intersection(hobokenLand, jerseyLand).length > 0) {
  throw new Error("Hoboken and Jersey City still overlap");
}
// The whole Jersey bank is drawn as context, not just the two named areas.
const njSilhouette = polygonClipping.intersection(NJ_LAND, VIEWPORT);
const silhouette = polygonClipping.union(nycLand, njSilhouette);

const park = polygonClipping.intersection(
  clean(
    nta.features
      .filter((f) => f.properties.ntaname === "Central Park")
      .flatMap((f) => toMultiPolygon(f.geometry)),
  ),
  VIEWPORT,
);
if (park.length === 0) throw new Error("Central Park not found in the source");

const regions = [];
const shapes = [
  ...MANHATTAN.map(([id, s2, n, w, e]) => [id, gridBlock(s2, n, w, e), manhattanIsland]),
  ...OUTER.map(([id, a, b]) => [id, block(a, b), outerLand]),
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
  const piece = polygonClipping.difference(unclaimed, park);
  if (piece.length === 0) throw new Error(`${id} does not land on any land`);
  regions.push([id, piece]);
  claimed = claimed.length === 0 ? piece : polygonClipping.union(claimed, piece);
}

// The two New Jersey areas are whole municipalities, so they need no cutting.
for (const [index, id] of ["hoboken", "jersey-city"].entries()) {
  const piece = njPieces[index];
  if (piece.length === 0) throw new Error(`${id} fell outside the viewport`);
  regions.push([id, piece]);
}

/**
 * A real point inside each area *as the book draws it* -- not the centre of the
 * neighborhood's full real extent, which sometimes spills past the book's row.
 * A block that does not contain its own landmark is in the wrong place, which
 * is easiest to get wrong across the rivers, where the grid does not apply.
 */
const LANDMARKS = {
  "financial-district": [40.7075, -74.0113],
  tribeca: [40.7163, -74.0086],
  "city-hall-chinatown": [40.7157, -73.9971],
  "lower-east-side": [40.7185, -73.9865],
  "west-village": [40.7358, -74.0036],
  "washington-sq": [40.7295, -73.9965],
  "east-village": [40.7265, -73.9815],
  chelsea: [40.7465, -74.0014],
  flatiron: [40.7411, -73.9897],
  // Gramercy/Kips Bay: Murray Hill proper runs north of 34th, but the book puts
  // this area in the 14th-34th row, so the landmark is where the two agree.
  "murray-hill-gramercy": [40.74, -73.98],
  "hells-kitchen": [40.7621, -73.9918],
  midtown: [40.7549, -73.9840],
  "east-midtown": [40.7546, -73.9707],
  "uws-lower": [40.7769, -73.9814],
  "ues-lower": [40.7700, -73.9600],
  "uws-upper": [40.7910, -73.9720],
  "ues-east-harlem": [40.7880, -73.9480],
  "morningside-heights": [40.8075, -73.9626],
  // Around 121st: Lower Harlem reaches past 125th in life, not in the book's row.
  "harlem-lower": [40.806, -73.948],
  "el-barrio": [40.7957, -73.9389],
  manhattanville: [40.8190, -73.9540],
  "harlem-upper": [40.8180, -73.9400],
  "washington-heights": [40.8417, -73.9393],
  "fort-george": [40.8593, -73.9297],
  inwood: [40.8677, -73.9212],
  astoria: [40.7644, -73.9235],
  "long-island-city": [40.7447, -73.9485],
  greenpoint: [40.7304, -73.9512],
  williamsburg: [40.7143, -73.9566],
  "brooklyn-heights": [40.6959, -73.9937],
  "fort-greene": [40.6892, -73.9742],
  bococa: [40.6860, -73.9970],
  "park-slope": [40.6710, -73.9780],
  hoboken: [40.7440, -74.0324],
  "jersey-city": [40.7178, -74.0431],
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
};
`,
  "utf-8",
);

const bytes = paths.reduce((sum, [, d]) => sum + d.length, 0);
console.log(`Wrote ${paths.length} regions, ${(bytes / 1024).toFixed(1)} kB of path data`);
