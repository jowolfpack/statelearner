/**
 * Generates src/data/nyc-map.ts.
 *
 *   npm run build:nyc-map
 *
 * No open dataset has neighborhood boundaries at the granularity Not For
 * Tourists uses -- the city's own polygons merge "Tribeca-Civic Center" and
 * "SoHo-Little Italy-Hudson Square", and OpenStreetMap stores these names as
 * points, not shapes. So the coastlines come from open data, which is fact, and
 * the subdivisions are generated here:
 *
 *   1. Take the real landmass (NYC Open Data NTAs, unioned).
 *   2. Drop one seed point per neighborhood at roughly its real centre.
 *   3. Cut the landmass into Voronoi cells around those seeds.
 *
 * Correcting a boundary means nudging a seed in SEEDS below, not editing path
 * data. Boundaries between neighborhoods are approximations and always will be
 * -- where SoHo ends and Hudson Square begins is not a fact.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Delaunay } from "d3-delaunay";
import polygonClipping from "polygon-clipping";

const SOURCE = "https://data.cityofnewyork.us/api/geospatial/9nt8-h7nd?method=export&format=GeoJSON";
const OUT = new URL("../src/data/nyc-map.ts", import.meta.url);
const WIDTH = 900;
const HEIGHT = 1200;
const PRECISION = 1;

/** Longitude degrees are shorter than latitude ones here; equalise before Voronoi. */
const LON_SCALE = Math.cos((40.75 * Math.PI) / 180);

/** [id, latitude, longitude, landmass] -- nudge these to move a boundary. */
const SEEDS = [
  // Downtown
  ["financial-district", 40.7075, -74.011, "manhattan"],
  ["tribeca", 40.7185, -74.008, "manhattan"],
  ["city-hall-chinatown", 40.7145, -73.9985, "manhattan"],
  ["lower-east-side", 40.7185, -73.9855, "manhattan"],
  ["west-village", 40.7345, -74.0045, "manhattan"],
  ["washington-sq", 40.7275, -73.9975, "manhattan"],
  ["east-village", 40.7275, -73.9825, "manhattan"],
  // Midtown
  ["chelsea", 40.7455, -74.0015, "manhattan"],
  ["flatiron", 40.7405, -73.99, "manhattan"],
  ["murray-hill-gramercy", 40.7455, -73.979, "manhattan"],
  ["hells-kitchen", 40.7625, -73.992, "manhattan"],
  ["midtown", 40.7555, -73.982, "manhattan"],
  ["east-midtown", 40.7555, -73.97, "manhattan"],
  // Uptown
  ["uws-lower", 40.7775, -73.9815, "manhattan"],
  ["ues-lower", 40.7695, -73.9625, "manhattan"],
  ["uws-upper", 40.7935, -73.9705, "manhattan"],
  ["ues-east-harlem", 40.7855, -73.951, "manhattan"],
  ["morningside-heights", 40.8085, -73.9625, "manhattan"],
  ["harlem-lower", 40.8065, -73.9455, "manhattan"],
  ["el-barrio", 40.7945, -73.937, "manhattan"],
  // Way Uptown
  ["manhattanville", 40.8245, -73.9495, "manhattan"],
  ["harlem-upper", 40.8185, -73.937, "manhattan"],
  ["washington-heights", 40.8465, -73.9375, "manhattan"],
  ["fort-george", 40.8605, -73.928, "manhattan"],
  ["inwood", 40.869, -73.9205, "manhattan"],
  // Leaving Manhattan
  ["astoria", 40.7665, -73.923, "outer"],
  ["long-island-city", 40.7465, -73.947, "outer"],
  ["greenpoint", 40.7295, -73.951, "outer"],
  ["williamsburg", 40.7135, -73.957, "outer"],
  ["brooklyn-heights", 40.696, -73.993, "outer"],
  ["fort-greene", 40.6905, -73.9735, "outer"],
  ["bococa", 40.6815, -74.0, "outer"],
  ["park-slope", 40.6715, -73.978, "outer"],
  ["hoboken", 40.744, -74.032, "nj"],
  ["jersey-city", 40.718, -74.045, "nj"],
];

/**
 * The Hudson County waterfront. New Jersey is not in the NYC dataset, so this
 * outline is authored: the eastern edge follows the Hudson shoreline, the rest
 * bounds how far inland the two areas are drawn.
 */
const NJ_LAND = [
  [
    [
      [-74.0265, 40.7555],
      [-74.0175, 40.7505],
      [-74.0125, 40.7295],
      [-74.0195, 40.7115],
      [-74.0345, 40.6955],
      [-74.0665, 40.6925],
      [-74.0845, 40.7225],
      [-74.0735, 40.7545],
      [-74.0265, 40.7555],
    ],
  ],
];

/** How far from Manhattan the outer-borough areas are drawn. */
const OUTER_BOUNDS = [
  [
    [
      [-74.035, 40.655],
      [-73.895, 40.655],
      [-73.895, 40.795],
      [-74.035, 40.795],
      [-74.035, 40.655],
    ],
  ],
];

function toMultiPolygon(geometry) {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  throw new Error(`Unexpected geometry ${geometry.type}`);
}

function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return Math.abs(sum / 2);
}

/** The single biggest polygon, used to drop Marble Hill and the small islands. */
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
  return [best];
}

/** Rounding damps the floating-point noise that upsets the sweep-line clipper. */
function clean(multi) {
  const r = (v) => Math.round(v * 1e6) / 1e6;
  return multi.map((poly) => poly.map((ring) => ring.map(([x, y]) => [r(x), r(y)])));
}

function unionOf(features) {
  const parts = features.flatMap((f) => clean(toMultiPolygon(f.geometry)));
  return parts.length === 0 ? [] : polygonClipping.union(parts[0], ...parts.slice(1));
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
 * Unioning every Brooklyn and Queens polygon at once overwhelms the clipper.
 * Trimming each piece to the area of interest first keeps the inputs small and
 * drops far-east Queens entirely.
 */
function unionNear(features, bounds) {
  const box = bboxOf(bounds);
  const pieces = [];
  for (const feature of features) {
    const multi = clean(toMultiPolygon(feature.geometry));
    if (!overlaps(bboxOf(multi), box)) continue;
    const trimmed = polygonClipping.intersection(multi, bounds);
    if (trimmed.length > 0) pieces.push(trimmed);
  }
  return pieces.length === 0 ? [] : polygonClipping.union(pieces[0], ...pieces.slice(1));
}

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`${SOURCE} -> HTTP ${response.status}`);
const nta = await response.json();
const inBorough = (name) => nta.features.filter((f) => f.properties.boroname === name);

const manhattanLand = largestPolygon(unionOf(inBorough("Manhattan")));
const outerLand = unionNear([...inBorough("Brooklyn"), ...inBorough("Queens")], OUTER_BOUNDS);
const LANDMASSES = { manhattan: manhattanLand, outer: outerLand, nj: NJ_LAND };

const centralPark = unionOf(
  nta.features.filter((f) => f.properties.ntaname === "Central Park"),
);
if (centralPark.length === 0) throw new Error("Central Park not found in the source");

/** Cuts one landmass into a cell per seed, then trims each cell to the land. */
function subdivide(landId) {
  const land = LANDMASSES[landId];
  const seeds = SEEDS.filter(([, , , mass]) => mass === landId);

  const points = seeds.map(([, lat, lon]) => [lon * LON_SCALE, lat]);
  const xs = land.flat(2).map(([lon]) => lon * LON_SCALE);
  const ys = land.flat(2).map(([, lat]) => lat);
  const pad = 0.05;
  const bounds = [
    Math.min(...xs) - pad,
    Math.min(...ys) - pad,
    Math.max(...xs) + pad,
    Math.max(...ys) + pad,
  ];

  const voronoi = Delaunay.from(points).voronoi(bounds);
  const out = [];
  for (const [index, [id]] of seeds.entries()) {
    const cell = voronoi.cellPolygon(index);
    if (cell === null) throw new Error(`No Voronoi cell for ${id}`);
    const unscaled = [[cell.map(([x, y]) => [x / LON_SCALE, y])]];
    const piece = polygonClipping.intersection(land, unscaled);
    if (piece.length === 0) throw new Error(`${id} does not touch its landmass`);
    out.push([id, piece]);
  }
  return out;
}

const regions = [
  ...subdivide("manhattan"),
  ...subdivide("outer"),
  ...subdivide("nj"),
];

// Project planar-Mercator by hand. d3-geo treats polygons as spherical, where a
// ring wound the wrong way means "the whole globe except this", and every path
// ends up covering the canvas. At city scale none of that machinery earns its
// keep, and doing the arithmetic here removes the failure mode entirely.
const R = 6378137;
const project = ([lon, lat]) => [
  (lon * Math.PI * R) / 180,
  R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
];

const projected = regions.map(([id, geom]) => [
  id,
  geom.map((poly) => poly.map((ring) => ring.map(project))),
]);
const parkProjected = centralPark.map((poly) => poly.map((ring) => ring.map(project)));

const every = [...projected.flatMap(([, g]) => g), ...parkProjected].flat(2);
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
const parkPath = draw(parkProjected);

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
// Coastlines from NYC Open Data (${SOURCE.split("?")[0]}); New Jersey's outline
// and every neighborhood boundary are generated from the seed points in that
// script. Move a seed to move a boundary.

export const NYC_MAP_VIEWBOX = "${viewBox}";

/** Card id -> SVG path data. */
export const NYC_PATHS: Record<string, string> = {
${paths.map(([id, d]) => `  ${JSON.stringify(id)}: ${JSON.stringify(d)},`).join("\n")}
};

/** Drawn for orientation, never asked about. */
export const NYC_LANDMARKS: Record<string, string> = {
  "central-park": ${JSON.stringify(parkPath)},
};
`,
  "utf-8",
);

const bytes = paths.reduce((sum, [, d]) => sum + d.length, 0);
console.log(`Wrote ${paths.length} regions, ${(bytes / 1024).toFixed(1)} kB of path data`);
