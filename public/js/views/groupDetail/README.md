# groupDetail/

Renders the group detail screen — a stats card (deposit, member count,
running collections/payouts/profit, each admin's holdings, and a
collection-trend sparkline) followed by a scrollable list of every month in
the fund. Split by concern instead of one file, following the same pattern
as [`../monthDetail/`](../monthDetail/README.md). No behavior changed —
the month-row and stats-card logic moved out of one large function into
focused ones, but every line of markup/logic is the same as before the
split.

## Files

| File | Exports | Responsibility |
|---|---|---|
| `index.js` | `renderGroupDetail`, `scrollToActiveMonth` | **Orchestrator.** Computes the running totals (collected/payout/holds so far), the loading skeleton, and assembly — calls `monthRows.js` and `statsCard.js` and wires their output into the topbar + content shell. |
| `shared.js` | `signed` | Small presentational helper reused by both `statsCard.js` and `monthRows.js`. |
| `statsCard.js` | `renderStatsCard` | The top stats card — deposit/members, collections/payouts/profit, admin holdings, and the collection-trend sparkline. Takes the `trend` array `monthRows.js` produces as an input. |
| [`monthRows/`](monthRows/README.md) | `renderMonthRows` | Builds the full per-month row list (closed/open/upcoming states) **and** the collection-trend data in the same pass, since every month contributes to both from the same `monthFinances()` call. Returns `{ rowsHtml, trend }`. Split into its own folder — see its README. |

## Dependency direction

`index.js` imports from `statsCard.js` and `monthRows.js`; neither of those
imports from the other or from `index.js`. Both may import from `shared.js`.
`monthRows.js`'s `trend` output feeds `statsCard.js`'s sparkline — that's
the one intentional data dependency between siblings, threaded through
`index.js` rather than one sibling importing the other directly.

## Where do I make my change?

- **A new figure on the stats card, or the collection-trend sparkline** →
  `statsCard.js`.
- **Anything about how a single month's row looks** (closed/open/upcoming
  styling, the winner/payout summary within a row) → `monthRows/` (see its
  own README for which specific file).
- **The running totals fed into the stats card, or the loading skeleton** →
  `index.js`.
- **A genuinely new section of the screen** → give it its own file here,
  named for what it renders, and wire it into `index.js`.

## Adding a new file

Same convention as [`../monthDetail/README.md`](../monthDetail/README.md):
named exports, relative imports one level up for
`store.js`/`helpers.js`/`finance.js`/`icons.js`/`skeleton.js`. Register a
new top-level file in [`public/index.html`](../../../index.html)'s
`modulepreload` list, and if it adds a new orchestrator-level export, also
in [`public/js/render.js`](../../render.js).
