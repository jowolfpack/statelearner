# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev                          # Vite dev server on :5173
npm test                             # vitest, single run
npm run test:watch                   # vitest in watch mode
npx vitest run src/app.test.ts       # one test file
npx vitest run -t "counts a skip"    # one test by name
npm run typecheck                    # tsc --noEmit
npm run build                        # typecheck, then static build into dist/
npm run build:map                    # regenerate src/data/us-map.ts (needs network)
```

`start.cmd` is the double-click entry point (also wired to a Desktop shortcut):
it installs if needed, then runs `npm run dev`, which opens a browser by itself
via `server.open` in `vite.config.ts`. Batch files are pinned to CRLF in
`.gitattributes` -- cmd.exe can mis-parse labels in LF-only files, so do not
"normalise" them.

Note that `vitest run … | tail` masks the exit code — check `$?` before the pipe,
or redirect to a file, when you need to know whether a run actually passed.

## Architecture

A flashcard drill site: vanilla TypeScript on Vite, no UI framework, no router,
no backend. State lives in a single `GroupSession`; the DOM is updated by one
`render()` in `src/main.ts` that redraws from session state on every event.

**Decks (`src/data/`)** — a `Deck` is a named pair of sides (`frontLabel`,
`backLabel`), its cards, its `groups`, and optionally its `map` geometry.
`decks.ts` is the registry; `main.ts` holds no deck of its own but swaps the
current one through `useDeck()`, which rebuilds the map, the whole-deck group,
the progress store and the mode labels together. Mode options are generated from
the deck's side labels, so they read correctly for any subject.

Progress is stored per deck under `statelearner:cleared:<deckId>`.
`migrateLegacyProgress()` moves the old global key onto the states deck once and
then deletes it, so a deck added later can never inherit it. Nothing downstream hardcodes "state"
or "capital"; UI labels come from the deck, so a new subject is a new `Deck` and
nothing else. The `[state, capital, postal code]` table lives in
`us-states.json` because `scripts/build-map.mjs` reads it too — the app and the
map generator must agree on the card ids.

**The learning loop (`src/group-session.ts`)** — pure, DOM-free, and the part
worth testing. A group has two phases:

- *Study*: every card in deck order with both sides visible. **Opt-in** — reached
  only via the per-group "Study" button in the picker (`skipStudy: false`).
- *Drill*: cards in shuffled order. Correct advances; **wrong reveals the answer
  and restarts the whole group with a fresh shuffle.** A group clears only on an
  unbroken run.

Picking a group goes straight to the drill; that is the default and the point of
the app.

The picker offers three tiers, widest first: a whole-deck run from
`wholeDeckGroup()` (`src/data/types.ts`), then `deck.regions` (East/Mid/West),
then `deck.groups` (the nine divisions).

Only `deck.groups` is a partition of the cards. The other two tiers are
deliberately kept out of it, so the coverage test and anything walking
`deck.groups` keep working unchanged. `deck.regions` is built in
`us-states.ts` by concatenating whole divisions — never restate a state list, or
the tiers drift apart. Anything iterating groups must not assume the session's
group is one of them: `nextInSameTier()` in `main.ts` walks whichever tier the
group came from, and returns undefined for the whole-deck run.

This mechanic is deliberate and load-bearing. There is intentionally no restart
limit, no way back to Study once the drill starts, and reshuffling on every
attempt is required so the user learns pairs rather than an order. Do not soften
any of that without being asked to.

Sessions never advance on their own: the contract is `submit()` → show feedback
→ `next()`. `next()` no-ops while ungraded, and a second `submit()` for the same
question is ignored, so a revealed answer stays on screen. `rng` is injectable
for deterministic tests.

**Answer matching (`src/normalize.ts`)** — the single place grading happens.
`normalize` folds away case, accents, punctuation and `St.`/`Saint`; anything
beyond that (alternate names, abbreviations) belongs in a card's
`frontAliases`/`backAliases`, not in `normalize`.

**Map (`src/map.ts` + generated `src/data/us-map.ts`)** — all 50 states as
`<path>`s built once; highlighting is a class swap plus a re-append to paint over
neighbouring borders. `src/data/us-map.ts` is **generated — never hand-edit it**;
change `scripts/build-map.mjs` and rerun `npm run build:map`. It projects
us-atlas TopoJSON through `geoAlbersUsa` (which produces the AK/HI insets) and
frames the viewBox on the drawn bounds, because the stock d3 975x610 frame clips
Alaska's western Aleutians.

The map must never give the answer away: `highlightedCardId()` in `main.ts`
marks the state only when the state is the *prompt*, or after the question has
been graded.

**Speech (`src/speech.ts`)** — the only place audio happens. `createSpeaker()`
returns a `Speaker` backed by `window.speechSynthesis`, or a silent no-op one
where the API is missing; callers check `supported` to decide whether to render
controls at all. Every call is wrapped in try/catch — **audio must never break
the drill**. Swapping to recorded files later means reimplementing this
interface and nothing else.

Pronunciation fixes are data, not code: `SPOKEN` in `src/data/us-states.ts`
respells the handful of names generic engines get wrong, which reach the UI as
`frontSpoken`/`backSpoken` on the card and `promptSpoken`/`answerSpoken` on the
`Question`. Keep the table short — an override on a name the engine already
handles makes it worse, and engines differ between devices.

`mountSpeaker()` in `main.ts` enforces the same spoiler rule as the map: **a
speaker button may only ever speak text already on screen**, so the answer gets
one only once the question has been graded. The Sound switch governs auto-play
only, and is **off by default** so the app never talks unasked; the speaker
buttons work regardless.

**Persistence (`src/storage.ts`)** — direction, theme, map on/off and the set of
cleared group ids, all wrapped in try/catch because `localStorage` throws in some
privacy modes. Settings are never worth a crash.

**Theme** — dark is the default and there is no "follow the OS" option. Tokens
are declared twice in `style.css`: bare `:root` carries the dark palette, so the
very first paint is dark with no flash, and `:root[data-theme="light"]` overrides
it. Both blocks must define the same token set; adding a color to only one is the
usual bug. `prefers-color-scheme` is deliberately not consulted anywhere.

## Tests

`src/app.test.ts` boots the real `index.html` under jsdom and drives whole
groups through the UI; it is what catches wiring bugs (renamed id, screen that
never unhides, map leaking the answer) that the pure session tests cannot see.
It needs `vi.resetModules()` before re-importing `main.ts`, and must read
`index.html` via `process.cwd()` — under jsdom `import.meta.url` is an http URL,
not a file one. The forks pool times out starting a jsdom worker on Windows, so
`vitest.config.ts` pins `pool: "threads"`.

## Conventions

- `tsconfig.json` is strict plus `noUncheckedIndexedAccess`, so indexing an array
  yields `T | undefined` — handle it rather than widening the config.
- `verbatimModuleSyntax` is on: import types with `import type`.
- `vite.config.ts` sets `base: "./"` so `dist/` works from any subpath.
- UI text is English, always, including when the request was written in German.
- Pushing to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`).
  `base: "./"` is what makes the build work from the Pages subpath; leave it.
