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
`backLabel`), its cards, and its `groups`. Nothing downstream hardcodes "state"
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

The picker also offers a whole-deck run built by `wholeDeckGroup()` in
`src/data/types.ts`. It is deliberately **not** in `deck.groups`, so the nine
divisions still partition the cards exactly once — code that walks `deck.groups`
(the "next group" button, the coverage test) keeps working unchanged. Anything
iterating groups must not assume the current session's group is one of them;
`divisionAfter()` in `main.ts` returns undefined for it.

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

**Persistence (`src/storage.ts`)** — direction, theme, map on/off and the set of
cleared group ids, all wrapped in try/catch because `localStorage` throws in some
privacy modes. Settings are never worth a crash.

**Theme** — tokens are declared three times in `style.css`: bare `:root` for
light, `@media (prefers-color-scheme: dark)` guarded by `:not([data-theme=light])`
for "system", and `:root[data-theme="dark"]` so the toggle wins in both
directions. Adding a color in only one of those blocks is the usual bug.

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
