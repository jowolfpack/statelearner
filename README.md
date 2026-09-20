# StateLearner

A drill site for memorising the 50 US states and their capitals.

## Running it

Double-click **`start.cmd`** (or the StateLearner shortcut on the Desktop). It
installs dependencies if they are missing, starts the dev server and opens the
browser. Closing the console window stops it.

From a terminal:

```sh
npm install
npm run dev      # starts and opens http://localhost:5173
npm test
npm run build    # static output in dist/
```

## How it works

States are split into the nine US Census divisions, 3-8 states each. You learn
one group at a time.

Picking a group starts the **drill** straight away: a state appears, you type
the capital. Right, and you move on. Wrong, and it shows you the correct answer
and puts you back at the start of the group, reshuffled.

For a group you have not seen before, the **Study** button next to it walks you
through every state with its capital shown first, then drops you into the drill.

The picker offers three sizes. **All 50 States** at the top, then **East / Mid /
West** for a larger chunk at once (21, 16 and 13 states), then the nine
divisions. Each region is an exact union of divisions, so the three sizes nest.

All 50 States is the same drill over the whole
country. The restart rule is unchanged at every size, so a single slip at state
49 puts you back at state 1 — the bigger runs are a test of the lot, not a
gentler mode.

A group is cleared only by getting every state right in one unbroken run. There
is no restart limit on purpose.

A US map marks the state being asked, and can be switched off. When the state is
what you are being asked *for*, the map stays blank until you have answered, so
it never gives the answer away.

Answers are matched loosely: case, accents and punctuation are ignored, `St.`
and `Saint` are interchangeable, and a state's postal code (`WY`) counts when
the state is the answer.

## Pronunciation

Names are read aloud by the browser's built-in speech synthesis — no audio files
and nothing to download. **Sound is off by default**; switch it on and the answer
is spoken as soon as it is on screen, whether you got it right or were just
corrected. Speaker buttons sit
next to every word on screen and work whether the switch is on or off; a speaker
never appears for an answer you have not been shown yet.

Generic speech engines mispronounce a few place names, so `SPOKEN` in
`src/data/us-states.ts` maps those to respellings (`Pierre` → `peer`). The table
is deliberately short, since an override on a name the engine already says
correctly makes it worse. Engines differ between devices, so if something sounds
wrong on yours, that table is where to fix it.

Mode (State→Capital, Capital→State, Mixed), theme (dark by default, switchable
to light), the sound and map toggles, and cleared groups are all remembered
locally.

## Map data

`src/data/us-map.ts` is generated from the public-domain
[us-atlas](https://github.com/topojson/us-atlas) state boundaries (US Census
Bureau cartographic files) and committed, so nothing but `npm run build:map`
needs network access.

## Deploying

Pushing to `main` builds and publishes to GitHub Pages via
`.github/workflows/deploy.yml`. The workflow runs the tests first, so a broken
build never reaches the live site.

First-time setup on a new repo: **Settings -> Pages -> Source -> "GitHub
Actions"**. Without that the first deploy fails.

Note that settings and progress live in `localStorage`, which is per-origin, so
the local copy and the published one keep separate progress.

## NYC Neighborhoods deck

A second deck: 58 areas, asked either way round — a neighborhood is highlighted
and you type it, or it is named and you click it on the map.

Manhattan uses the names New Yorkers actually use rather than *Not For
Tourists*' rows, which carried labels like "Upper East Side (Lower)" whose
halves nothing distinguishes. Across the rivers the book's grouping is kept.
New Jersey goes beyond the book entirely.

Boundaries come from real data wherever it exists: NYC Open Data for the
boroughs, OpenStreetMap for the New Jersey municipalities, and the Census
Bureau's hydrography for the waterline on the Jersey side. Jersey City's six areas are its six wards, which the city publishes and which
are named for them. Only Manhattan is cut by hand, because no dataset has
boundaries at that granularity — Manhattan's are rectangles in the street grid,
declared in `scripts/build-nyc-map.mjs` as metres from Fifth Avenue and 42nd
Street.

Three assertions guard `npm run build:nyc-map`: every area must contain a real
point inside it, no two areas may overlap, and no area may pick up land across
a river.
