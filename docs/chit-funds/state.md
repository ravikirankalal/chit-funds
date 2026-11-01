# Chit-funds app: current state

Last updated: 2026-11-01. Tasks live in [task.md](task.md).
Written from the README and git history; confirm details against the code before relying on them.

## What it is
Installable web app (PWA) for a two-admin team to run a chit fund: collect monthly member payments,
pick a winner, close months, and track who holds how much money. Google sign-in, live Firestore.
No build step, no framework: static HTML/JS/CSS under `public/`.

- Live: https://localbc-41b52.web.app
- Repo: https://github.com/ravikirankalal/chit-funds (public, MIT)
- Firebase project: `localbc-41b52` ("LocalBC")

## Code map (`public/js/`)
`main.js`, `router.js`, `store.js`, `listeners.js`, `events.js`, `auth.js`, `webauthn.js`,
`render.js`, `views/` (dashboard, createGroup, groupDetail, monthDetail, members, ledger, ...),
`actions/` (payments, members, handoffs, adminTransfers, winners, ...), `finance/`
(ledger, membership, monthFinances), plus `README.md` files inside `actions/` and `finance/`.
`firestore.rules`, `firestore.indexes.json` and `firebase.json` sit at the repo root and are
shared with the weddings app. `scripts/` has admin helpers (`manage-admins.js`,
`delete-group-by-name.js`, `dev-emulator.sh`).

## Branches and deploys
- `develop`: default and protected; work via PR. No CI. Deploy by hand while iterating.
- `main`: protected; a merged PR into it triggers `.github/workflows/deploy.yml`
  (Firebase hosting + Firestore rules, then tag `vN`).
- As of 2026-11-01, `main` is about 180 commits behind `develop` (last merge on `main` is
  PR #31). Live hosting currently reflects `develop` because it was deployed by hand
  (PRs #76-#78 shipped that way). `main` has not been brought up to date.
- Tags: `v1`, `v2` are CI release tags. `v0.1` is the manual weddings tag; CI's tag
  counter ignores it because it takes the numeric maximum.

## Recent work (newest first, from git log)
Winner-picker redesign with confirm step (#74), handoff biometrics and direction fixes (#73),
admin-transfer error message fix (#75, fixed twice), plus the weddings app (#76-#78, separate).

## Shared risks
- `firestore.rules` has a catch-all that the chit-funds admins rely on, including collection-group
  queries (months, payments, transferRequests, handoffRequests). Do not narrow it casually.
- Enforcing App Check would break this app.

## Known gaps
No test suite. See task.md.
