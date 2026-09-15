# actions/winners/

Picking a month's winner(s) and recording each admin's own contribution
toward a winner's payout. Split out of `actions/winners.js` itself for the
same reason the rest of `actions/` was split — see
[`../README.md`](../README.md) for how this folder fits into the wider
`actions/` split.

## Files

| File | Exports | Responsibility |
|---|---|---|
| `index.js` | re-exports everything below | Barrel, same reasoning as [`../index.js`](../index.js). |
| `picker.js` | `openWinnerPicker`, `closeWinnerPicker`, `addWinner`, `removeWinner`, `setWinnerAmount` | Choosing who won a month (a list, not a single winner — see `getMonthWinners` in `finance.js`) and editing a not-yet-started payout's amount. |
| `payout.js` | `openPayoutModal`, `closePayoutModal`, `setPayoutContribution` | Recording an admin's own contribution toward one winner's payout — `setPayoutContribution` is also what closes the month once every winner is fully covered. |

## Dependency direction

`index.js` re-exports from `picker.js` and `payout.js`; neither imports the
other. Both import `setBusy` from [`../shared.js`](../shared.js).

## Where do I make my change?

- **Who won, or a payout amount before any money has moved toward it** →
  `picker.js`.
- **An admin's own payout contribution, or the close-month logic** →
  `payout.js`.

## Adding a new file

Named exports, relative imports two levels up for `store.js`/`helpers.js`/
`finance.js`/`router.js`/`render.js`/`firebase.js`, one level up for
`actions/shared.js`. Register the file in
[`public/index.html`](../../../index.html)'s `modulepreload` list, and add
its exports to this folder's `index.js` (and, if needed outside
`actions/`, to `actions/index.js` too).
