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
one group at a time:

1. **Study** — click through every state in the group with its capital shown.
2. **Drill** — a state appears, you type the capital. Right, and you move on.
   Wrong, and it shows you the correct answer and puts you back at the start of
   the group, reshuffled.

A group is cleared only by getting every state right in one unbroken run. There
is no restart limit on purpose.

A US map marks the state being asked, and can be switched off. When the state is
what you are being asked *for*, the map stays blank until you have answered, so
it never gives the answer away.

Answers are matched loosely: case, accents and punctuation are ignored, `St.`
and `Saint` are interchangeable, and a state's postal code (`WY`) counts when
the state is the answer.

Mode (State→Capital, Capital→State, Mixed), theme (System/Light/Dark), the map
toggle and cleared groups are all remembered locally.

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
