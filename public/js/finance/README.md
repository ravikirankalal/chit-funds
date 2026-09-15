# finance/

All the money math lives here, in one place, so the rules for "who's
holding what" are never duplicated between the ledger, group detail's
months list, and month detail's fund-position card. Deliberately has no
knowledge of rendering — it only reads the caches ([`../store.js`](../store.js))
and writes derived numbers back onto `state`. Whoever calls `recompute()`
([`../listeners.js`](../listeners.js)) is responsible for re-rendering
afterwards; that keeps this folder from ever needing to import `render.js`.

Split by concern from the original single `finance.js`, following the same
pattern as [`../actions/`](../actions/README.md) — a flat utility module
with several independent external call sites rather than one entry point,
so (per that same carve-out) there's no barrel `index.js` here: callers
import directly from whichever file owns the function they need.

## Files

| File | Exports | Responsibility |
|---|---|---|
| `shared.js` | `getMonthWinners`, `payoutByLabel` | Small, reused-across-files helpers: reconstructing a month's winners list (including the old single-`winnerId` back-compat case) and formatting the "paid by" admin label. |
| `monthFinances.js` | `monthFinances` | **The single source of truth.** Derives, for one month, who holds what — raw collections, net transfers, each admin's own payout contributions. Everything else in this folder and beyond is built from its output. |
| `ledger.js` | `recompute` | Rebuilds `state.balances` / `state.ledgerEntries` / `state.pendingApprovals` from the caches, by calling `monthFinances` once per elapsed month across every group. |
| `membership.js` | `memberHasPaidInGroup` | Whether a member has ever paid into a group — gates member removal. Standalone; doesn't depend on `monthFinances`. |

## Dependency direction

`monthFinances.js` imports `getMonthWinners` from `shared.js`. `ledger.js`
imports `monthFinances` from `monthFinances.js` and `payoutByLabel` from
`shared.js` — a deliberate exception to "no sibling imports": `monthFinances`
is explicitly the foundational computation everything else is built from
(see its own comment), so `ledger.js` depending on it directly is a real,
necessary data dependency, not avoidable coupling. `membership.js` depends
on nothing in this folder.

## Where do I make my change?

- **A figure that's part of one month's fund position** (collections,
  transfers, payout contributions) → `monthFinances.js`.
- **How a ledger entry (collection/payout/transfer row) is built, or the
  running admin balances** → `ledger.js`.
- **The winners list back-compat logic, or the "paid by" label text** →
  `shared.js`.
- **Whether a member can be removed from a group** → `membership.js`.

## Adding a new file

Named exports, relative imports one level up for `store.js`/`helpers.js`.
Register the file in [`public/index.html`](../../index.html)'s
`modulepreload` list. Update every external caller's import path directly
(there's no barrel to update) — `find_referencing_symbols` (Serena) or a
repo-wide grep for the old `finance.js` path will find them all.
