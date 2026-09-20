# Roadmap

## Done

Grouped study-then-drill, the map, and the theme toggle all shipped. See
`CLAUDE.md` for how they fit together, and treat these as settled decisions:

- **Groups** are the nine US Census divisions (3-8 states, geographically
  contiguous, so a group reads as a region on the map).
- **The drill restarts the whole group on any wrong answer**, after revealing
  the correct one. No restart limit, no way back to Study mid-drill.
- **The order reshuffles on every attempt**, so you learn the pairs and not the
  sequence.
- **Real state outlines**, not a tile grid. The map is a headline feature, so it
  is not a place to economise on bytes (~155 kB of path data, ~62 kB gzipped for
  the whole app).

## Possible next

Nothing here is agreed — ask before building any of it.

- Per-group stats beyond a cleared/not-cleared marker: best attempt count, which
  states cost the most restarts.
- A "hardest states" group assembled from the states that caused restarts.
- More decks. The `Deck`/`Group` types are already subject-agnostic, so this is
  a data change plus a deck picker.
- Keyboard-only flow for the study pass.

## Non-goals

Accounts, sync, and spaced repetition across sessions. The abstractions allow
them later; nothing should be added to serve them today.
