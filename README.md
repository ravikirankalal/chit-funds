# Chit Funds

A lightweight web app (installable as a home-screen PWA) for a two-admin team
to run a chit fund: collect monthly member payments, pick a winner, close out
months, and track who's holding how much money — with Google sign-in and a
live Firestore backend. No build step, no native app, no framework — just
static HTML/JS/CSS talking to Firebase.

- **Live app:** https://localbc-41b52.web.app
- **Repo:** https://github.com/ravikirankalal/chit-funds (public, MIT licensed)
- **Firebase project:** `localbc-41b52` ("LocalBC")

## Prerequisites

To do anything beyond reading the code, you'll need:

- **Node.js + npm** — used to run the Firebase CLI (via `npx`/`npm install -g`). No build step for the app itself.
- **Firebase CLI**, logged in with access to the `localbc-41b52` project:
  ```bash
  npm install -g firebase-tools
  firebase login
  firebase use --add   # pick localbc-41b52, alias it "default"
  ```
  Deploying from local needs **Editor** (or Firebase Admin) access on the project; ask to be added as a project member in the Firebase console if you don't have it.
- **git**, plus push access to the GitHub repo if you're not just reading.
- **GitHub CLI (`gh`)** — only needed for repo administration (branch protection, secrets, opening PRs from the terminal), not for day-to-day deploys:
  ```bash
  gh auth login
  ```
- **gcloud CLI** — only needed for one-time GCP-level provisioning (enabling APIs, creating service accounts) — not needed for day-to-day deploys or even for `firebase deploy`. See [`docs/dev-tools-auth.md`](docs/dev-tools-auth.md) if you need to redo any of that.

None of the above needs to be installed via Homebrew — see [`docs/dev-tools-auth.md`](docs/dev-tools-auth.md) for standalone install steps if Homebrew casks give you trouble (e.g. requiring `sudo xcodebuild -license accept`).

## Branching & workflow

- **`develop`** — the default branch, and where day-to-day work happens. Branch off it, open a PR back into it, merge. Protected: no direct pushes (including for admins), no force-push, no deletion — everything goes through a PR. No CI runs here; deploy manually from local while iterating (below).
- **`main`** — also protected the same way. Only updated via a merged PR from `develop`, at milestones. Every push to `main` triggers the CI/CD deploy automatically (below).

Typical flow for a change:

```bash
git checkout develop && git pull
git checkout -b my-change
# ...edit, commit...
git push -u origin my-change
gh pr create --base develop
# review, then merge on GitHub
```

When a milestone is ready to ship:

```bash
gh pr create --base main --head develop --title "Release: <milestone>"
# merge on GitHub → CI deploys + tags automatically
```

## Deploying

### From local (while working on `develop`)

```bash
firebase deploy --only hosting,firestore:rules --project localbc-41b52
```

Just the site (no rules changes):

```bash
firebase deploy --only hosting --project localbc-41b52
```

Just the security rules:

```bash
firebase deploy --only firestore:rules --project localbc-41b52
```

(Omit `--project localbc-41b52` if you've already run `firebase use --add` locally and aliased it `default`.)

### Via GitHub (automatic, on merge to `main`)

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on every push to `main` — i.e. every merged PR:

1. Deploys Hosting + Firestore rules to `localbc-41b52`, authenticated as a scoped service account (`github-ci-deployer@localbc-41b52.iam.gserviceaccount.com`; roles limited to `firebasehosting.admin` + `firebaserules.admin` — it can't touch anything else in the project). The key lives only as the `FIREBASE_SERVICE_ACCOUNT` GitHub Actions secret.
2. Tags the deployed commit `deploy-<UTC timestamp>`.

No manual step needed — check the repo's **Actions** tab to watch a run, and the **Tags** list for the resulting `deploy-*` tag.

## Adding it to your phone's home screen

Open the deployed URL in Chrome (Android) or Safari (iOS) and use "Add to Home Screen" — it installs like an app with its own icon, no app store needed.

## Setting this up somewhere new

If you're standing up a fresh Firebase project (a fork, a different environment) rather than using the existing `localbc-41b52`:

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project (the free "Spark" plan is enough).
2. In **Build → Authentication**, click **Get started**, then under **Sign-in method** enable the **Google** provider.
3. In **Build → Firestore Database**, click **Create database** (production mode, any region close to you).
4. In **Project settings → General → Your apps**, click the `</>` (web) icon to register a new web app. Copy the `firebaseConfig` object it shows you.
5. Open [`public/firebase-config.js`](public/firebase-config.js) and fill in:
   - `firebaseConfig` — the object from step 4.
   - `ADMINS.A.email` / `ADMINS.B.email` — the two Google accounts that collect payments and hold funds.
   - `SUPER_ADMIN.email` — a view-only oversight account (never a fund custodian).

   These three emails are the **only** accounts allowed to sign in, and are also duplicated in [`firestore.rules`](firestore.rules) (rules can't import JS) — **update both files** together.
6. `firebase use --add`, pick the new project, then `firebase deploy --only firestore:rules,hosting`.

See [`docs/firebase-project-setup.md`](docs/firebase-project-setup.md) for the current project's specifics (region, admin email mapping, service account), and [`docs/dev-tools-auth.md`](docs/dev-tools-auth.md) for CLI install/auth notes.

## Project layout

```
public/
  index.html            page shell
  style.css             all styling
  app.js                the entire app: Firebase wiring, state, rendering
  firebase-config.js     ← Firebase project + admin emails go here
  manifest.json          PWA metadata (installable icon/name)
firestore.rules          security rules (only the 3 configured emails; the
                          two financial admins can write, the super admin
                          is read-only)
firebase.json             hosting + emulator config
.github/workflows/deploy.yml   CI/CD: deploy + tag on merge to main
docs/                     dev-tool auth notes, Firebase project notes
```

## Data model (Firestore)

```
groups/{groupId}                          name, memberCount, durationMonths,
                                           monthlyDeposit, payoutSchedule[],
                                           currentMonth, status, startYear/
                                           startMonthIndex, createdBy
groups/{groupId}/members/{memberId}       name, order
groups/{groupId}/months/{monthNumber}     status, winnerId, payoutAdmin,
                                           transferNet, closedAt, closedLabel
groups/{groupId}/months/{n}/payments/{memberId}
                                           paid, collectedBy, mode, paidAt
groups/{groupId}/transferRequests/{monthNumber}
                                           direction, amount, requestedBy
                                           (deleted on accept/decline/cancel)
```

Admin balances, the ledger, and each month's fund split are **derived**
client-side from this data (never stored redundantly) — see `monthFinances()`
and `recompute()` in `app.js` if you're changing the money logic.

## Local testing with the Firebase Emulator Suite (optional)

`firebase.json` already has emulator config for Auth + Firestore + Hosting.
Set `USE_EMULATORS = true` in `public/firebase-config.js`, then:

```bash
firebase emulators:start --only auth,firestore,hosting
```

Open the printed hosting URL (port `5050`) and the Auth emulator lets you
"sign in" as any email without a real Google account — handy for testing
without touching the real Firebase project.

**Known emulator quirk:** on some Macs, the Firestore emulator (a Java
process) can hit the OS's default per-user thread limit (`ulimit -u`) under
sustained use and start failing with `ERR_EMPTY_RESPONSE` / hung requests —
this is a limitation of the local emulator's JVM, not the app. If you hit
it, try raising the limit before starting the emulator:

```bash
ulimit -u 4096
firebase emulators:start --only auth,firestore,hosting
```

This doesn't affect the real deployed app in any way — production Firestore
has no such constraint.

Remember to set `USE_EMULATORS` back to `false` before deploying for real.
