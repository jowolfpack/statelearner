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

/** A block bounded by two cross-streets and two avenues. */
function gridBlock(south, north, west, east) {
  const [u0, u1] = [U[west], U[east]];
  const [v0, v1] = [V[south], V[north]];
  if (u0 === undefined || u1 === undefined || v0 === undefined || v1 === undefined) {
    throw new Error(`Unknown grid line in ${south}/${north}/${west}/${east}`);
  }
  return [
    [[unrot([u0, v0]), unrot([u1, v0]), unrot([u1, v1]), unrot([u0, v1]), unrot([u0, v0])]],
  ];
}

/** Manhattan, as the book's rows: [id, south street, north street, west ave, east ave]. */
const MANHATTAN = [
  ["financial-district", "southEnd", "chambers", "farWest", "farEast"],
  ["tribeca", "chambers", "houston", "farWest", "sixth"],
  ["city-hall-chinatown", "chambers", "houston", "sixth", "third"],
  ["lower-east-side", "chambers", "houston", "third", "farEast"],
  ["west-village", "houston", "fourteenth", "farWest", "sixth"],
  ["washington-sq", "houston", "fourteenth", "sixth", "third"],
  ["east-village", "houston", "fourteenth", "third", "farEast"],
  ["chelsea", "fourteenth", "thirtyFourth", "farWest", "sixth"],
  ["flatiron", "fourteenth", "thirtyFourth", "sixth", "park"],
  ["murray-hill-gramercy", "fourteenth", "thirtyFourth", "park", "farEast"],
  ["hells-kitchen", "thirtyFourth", "fiftyNinth", "farWest", "eighth"],
  ["midtown", "thirtyFourth", "fiftyNinth", "eighth", "park"],
  ["east-midtown", "thirtyFourth", "fiftyNinth", "park", "farEast"],
  // Central Park fills eighth..fifth between 59th and 110th, and is cut out below.
  ["uws-lower", "fiftyNinth", "eightySixth", "farWest", "eighth"],
  ["ues-lower", "fiftyNinth", "eightySixth", "fifth", "farEast"],
  ["uws-upper", "eightySixth", "oneTenth", "farWest", "eighth"],
  ["ues-east-harlem", "eightySixth", "oneTenth", "fifth", "farEast"],
  ["morningside-heights", "oneTenth", "oneTwentyFifth", "farWest", "eighth"],
  ["harlem-lower", "oneTenth", "oneTwentyFifth", "eighth", "third"],
  ["el-barrio", "oneTenth", "oneTwentyFifth", "third", "farEast"],
  ["manhattanville", "oneTwentyFifth", "oneFortyFifth", "farWest", "eighth"],
  ["harlem-upper", "oneTwentyFifth", "oneFortyFifth", "eighth", "farEast"],
  ["washington-heights", "oneFortyFifth", "oneEightyFirst", "farWest", "farEast"],
  ["fort-george", "oneEightyFirst", "dyckman", "farWest", "farEast"],
  ["inwood", "dyckman", "northEnd", "farWest", "farEast"],
];

/** Across the rivers, where the Manhattan grid does not apply: corner pairs. */
const OUTER = [
  ["astoria", [40.755, -73.945], [40.79, -73.895]],
  ["long-island-city", [40.735, -73.965], [40.762, -73.925]],
  ["greenpoint", [40.719, -73.965], [40.74, -73.93]],
  ["williamsburg", [40.699, -73.975], [40.722, -73.93]],
  ["brooklyn-heights", [40.688, -74.015], [40.706, -73.985]],
  ["fort-greene", [40.68, -73.985], [40.7, -73.96]],
  ["bococa", [40.665, -74.03], [40.688, -73.988]],
  ["park-slope", [40.655, -73.988], [40.682, -73.96]],
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
const njPieces = ["hoboken", "jersey-city"].map((id) =>
  polygonClipping.intersection(clean(NJ.polygons[id]), VIEWPORT),
);
const silhouette = polygonClipping.union(nycLand, ...njPieces);

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
for (const [id, shape, land] of shapes) {
  // Cut the block out of real land, then take the park back out, so Central
  // Park reads as a hole in the grid rather than being paved over.
  const onLand = polygonClipping.intersection(land, shape);
  const piece = polygonClipping.difference(onLand, park);
  if (piece.length === 0) throw new Error(`${id} does not land on any land`);
  regions.push([id, piece]);
}

// The two New Jersey areas are whole municipalities, so they need no cutting.
for (const [index, id] of ["hoboken", "jersey-city"].entries()) {
  const piece = njPieces[index];
  if (piece.length === 0) throw new Error(`${id} fell outside the viewport`);
  regions.push([id, piece]);
}

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
