# monthDetail/

Renders the month detail screen — by far the busiest screen in the app
(winner selection, per-admin payout contributions, the tabbed member
payment list, hand-off requests, and two modals). Split into one file per
concern instead of one big view file, so each piece can be read and changed
in isolation. Every function moved here does exactly what it did before the
split — no behavior changed, only where the code lives.

## Files

| File | Exports | Responsibility |
|---|---|---|
| `index.js` | `renderMonthDetail` | **Orchestrator.** Screen-level state (open/closed/upcoming, the status pill), the loading skeleton, and assembly — decides which sections and overlays to render, in what order. Has no rendering logic of its own beyond the topbar/status pill. |
| `shared.js` | `signed`, `summaryStat`, `timelineRow`, `renderMemberPaymentStrip` | Small presentational helpers used by more than one section below. If you need a helper in two of the files below, it belongs here, not duplicated. |
| `summary.js` | `renderClosedSummary`, `renderOpenSummary`, `renderUpcomingNotice` | The top card(s): a per-winner card for each of `f.winners` (name, payout status, a Remove link while removable, and itself the tap target that opens `payout.js`'s modal), then collections/payout/profit stats, the "who's paid" strip, admin holdings. Same per-winner card in both open and closed months. |
| `paymentList.js` | `renderPaymentList` | The tabbed member payment list (Unpaid / admin A / admin B) below the summary card. |
| `handoffRequests.js` | `renderHandoffRequests` | Pending transfer hand-off cards shown above the summary, in both open and closed months. |
| `winner.js` | `renderWinnerPickerOverlay` | The picker sheet "Add another winner"/"Select Winner" opens (`index.js`) — the winner(s) themselves render on `summary.js`'s per-winner card, not here. |
| `payout.js` | `renderPayoutModalOverlay` | The per-admin contribution modal, opened by tapping a winner's card in `summary.js` — there's no separate "record payout" card of its own. |
| `paymentModal.js` | `renderPaymentModalOverlay` | The per-member payment detail/edit sheet, including its transfer-history timeline. |
| `transferBar.js` | `renderTransferBar` | The floating "N payments selected" bar shown during a hold-to-transfer selection. |

## Dependency direction

`index.js` imports from every other file here; nothing else imports from
`index.js`. `shared.js` imports nothing from its siblings (it's the
foundation). Everything else may import from `shared.js` but not from each
other — if you find yourself importing `winner.js` from `payout.js` (or
similar), that's a sign the shared piece belongs in `shared.js` instead.

All imports one level up (`../../store.js`, `../../helpers.js`, etc.) point
at the same app-wide modules every other view uses — nothing in this folder
is special-cased.

## Where do I make my change?

- **A new stat/figure on the summary card, or anything about the per-winner
  card's payout status/Remove link** → `summary.js` (and `shared.js` if it's
  a new reusable stat shape).
- **A new payment-list tab or row detail** → `paymentList.js`.
- **The picker sheet itself (who's eligible, tapping to add)** → `winner.js`.
- **The payout contribution modal itself** → `payout.js`; **what opens it** (the winner's own card) → `summary.js`.
- **The per-member payment sheet (mode, transfer history, mark unpaid)** →
  `paymentModal.js`.
- **Hand-off / transfer request cards or the floating selection bar** →
  `handoffRequests.js` / `transferBar.js`.
- **Screen-level stuff** (what shows when, the status pill, the loading
  skeleton) → `index.js`.
- **A brand-new section** (not listed above): give it its own file here,
  named for what it renders, and wire it into `index.js` the same way the
  others are.

## Adding a new file

Same import style as the rest of the app: named exports, relative imports
one level up for `store.js`/`helpers.js`/`finance.js`/`icons.js`, two levels
up for `firebase-config.js`. Two other places need to know about a new
top-level entry file too — check [`public/index.html`](../../../index.html)'s
`modulepreload` list and (only for a new orchestrator-level export)
[`public/js/render.js`](../../render.js).
