# groupDetail/monthRows/

Builds the group detail screen's per-month row list — one row per month in
the fund, each rendered differently depending on whether that month is
closed, currently open, or hasn't started yet — plus the collection-trend
data (`{ m, pct, color }` per month) that [`../statsCard.js`](../statsCard.js)'s
sparkline consumes. Split out of `groupDetail.js` itself for the same
reason as the rest of `groupDetail/`: each month state's markup was
getting long enough to be its own concern. See
[`../README.md`](../README.md) for how this folder fits into the wider
`groupDetail/` split.

## Files

| File | Exports | Responsibility |
|---|---|---|
| `index.js` | `renderMonthRows` | **Orchestrator.** Loops every month 1..`durationMonths`, calls `monthFinances()` once per elapsed month, and dispatches to whichever row renderer matches that month's state. Collects each one's `html` and `trend` entry. |
| `closedRow.js` | `renderClosedMonthRow` | A month that's been closed out — winner(s), who paid the payout, any still-unpaid members. |
| `openRow.js` | `renderOpenMonthRow` | The current month — live collection progress, and once a winner's picked, the payout-in-progress state. |
| `upcomingRow.js` | `renderUpcomingMonthRow` | A month that hasn't started yet — dashed, faded, just the scheduled payout figure. |
| `shared.js` | `adminAmountSpan`, `rightMoneyColumn`, `lifecycleBadge`, `payoutStatusPill`, `unpaidPill` | Small pieces reused by both `closedRow.js` and `openRow.js` (an admin's colored dot+label, the right-hand profit/collected/payout column) plus the status badges — `payoutStatusPill` is the same not-started/partway/done color language as the winner card's own pill (`monthDetail/summary.js`), kept in one place so a month row and a winner card never disagree about what "payout pending" looks like. |

## Dependency direction

`index.js` calls into `closedRow.js`/`openRow.js`/`upcomingRow.js`; none of
the three row files import each other. All three may import from
`shared.js` here, and from [`../shared.js`](../shared.js) (`signed`) one
level up.

## Where do I make my change?

- **How a closed month's row looks** (winner line, paid-by, unpaid
  warning) → `closedRow.js`.
- **How the current month's row looks** (collection bar, payout-in-progress
  styling) → `openRow.js`.
- **How a not-yet-started month's row looks** → `upcomingRow.js`.
- **A helper used by more than one row state** → `shared.js`.
- **The loop itself, or what counts as closed/open/upcoming** → `index.js`.

## Adding a new file

Same convention as the rest of the app: named exports, relative imports —
three levels up for `helpers.js`/`icons.js`/`finance.js`, one level up for
this folder's own `shared.js` and the parent `groupDetail/shared.js`.
Register a new top-level file in
[`public/index.html`](../../../../index.html)'s `modulepreload` list.
