# actions/

Every function here either mutates `state` and calls `render()`, or writes
to Firestore (writes flow back into the UI via the listeners in
[`listeners.js`](../listeners.js), not by mutating local caches directly).
Split by concern from the original single `actions.js`, following the
pattern used by [`../views/groupDetail/`](../views/groupDetail/README.md)
and [`../views/monthDetail/`](../views/monthDetail/README.md) — but unlike
those view folders, this one has a single external consumer:
[`../events.js`](../events.js), which needs nearly every export across
every cluster (it's "deliberately the only module that imports both
actions and auth" — see its own header comment). That's why `index.js`
here is a plain re-export barrel rather than an orchestrator with its own
logic — it exists purely so `events.js` keeps one import statement instead
of six.

## Files

| File | Exports | Responsibility |
|---|---|---|
| `index.js` | re-exports everything below | Barrel — the only file anything outside `actions/` imports from. |
| `shared.js` | `setBusy`, `isPendingHandoff` | Cross-cutting helpers used by more than one cluster. `setBusy` isn't re-exported by `index.js` — nothing outside `actions/` calls it directly. |
| `navigation.js` | `openGroupDetail`, `openGroupMembers`, `openMemberPayments`, `openMonth`, `selectPaymentTab`, `setLedgerFilter` | Plain screen navigation and small synchronous UI toggles — nothing here touches Firestore. |
| `groupCreation.js` | `startCreateGroup`, `createGroupStep2`, `addDraftMember`, `addExistingDraftMember`, `removeDraftMember`, `submitCreateGroup` | The multi-step create-group flow, ending in the batched write that creates the group + its first month doc. |
| `members.js` | `openMemberForm`, `closeMemberForm`, `saveMemberForm`, `openAddMemberToGroup`, `closeAddMemberToGroup`, `addExistingMemberToGroup`, `createAndAddMemberToGroup`, `removeMemberFromGroup` | The shared member directory (add/edit a person) and adding/removing a member from one group. |
| `payments.js` | `openPaymentModal`, `closePaymentModal`, `setModalMode`, `savePaymentModal`, `markUnpaidFromModal`, `togglePaymentSelection`, `cancelTransferSelection` | Recording/undoing one member's payment for a month, and selecting already-collected payments for a hand-off (the selection itself — the request/accept/decline flow is `handoffs.js`). |
| `handoffs.js` | `confirmTransfer`, `acceptHandoffRequest`, `declineHandoffRequest`, `cancelHandoffRequest` | Hand-off requests for specific already-collected payments moving from one admin to the other. |
| [`winners/`](winners/README.md) | `openWinnerPicker`, `closeWinnerPicker`, `addWinner`, `removeWinner`, `openPayoutModal`, `closePayoutModal`, `setPayoutContribution` | Picking a month's winner(s) and recording each admin's own contribution toward a winner's payout — `setPayoutContribution` is also what closes a month out once every winner is fully covered. Split into its own folder — see its README. |
| `adminTransfers.js` | `requestTransferToB`, `requestTransferToA`, `acceptTransferRequest`, `declineTransferRequest`, `cancelTransferRequest` | Whole-month admin-to-admin holdings transfers — a running imbalance between the two admins' totals, distinct from a hand-off of one specific payment (`handoffs.js`). |

## Dependency direction

`index.js` re-exports from every other file; none of those import `index.js`
back. `navigation.js`, `groupCreation.js`, `members.js`, `payments.js`,
`handoffs.js`, `winners.js`, and `adminTransfers.js` are all siblings — none
import from each other, only from `shared.js` (and each has its own
imports from `../store.js`, `../helpers.js`, `../finance.js`,
`../router.js`, `../render.js`, `../firebase.js` as needed).

## Where do I make my change?

- **A new screen-navigation action, or a trivial UI toggle with no
  Firestore write** → `navigation.js`.
- **Anything about creating a group** → `groupCreation.js`.
- **Anything about the member directory, or adding/removing someone from a
  group** → `members.js`.
- **Recording or undoing one member's payment** → `payments.js`.
- **Handing a specific already-collected payment to the other admin** →
  `handoffs.js`.
- **Winner selection or payout recording, including what closes a month**
  → `winners/` (see its own README for which specific file).
- **A whole-month running-balance transfer between the two admins** →
  `adminTransfers.js`.
- **A helper more than one cluster needs** → `shared.js`.

## Adding a new file

Named exports, relative imports one level up for `store.js`/`helpers.js`/
`finance.js`/`router.js`/`render.js`/`firebase.js`. Register the file in
[`public/index.html`](../../index.html)'s `modulepreload` list, and add its
exports to `index.js`'s re-export list if `events.js` (or any future
consumer) needs to call them.
