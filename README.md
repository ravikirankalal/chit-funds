# Chit Funds

A lightweight web app (installable as a home-screen PWA) for a two-admin team
to run a chit fund: collect monthly member payments, pick a winner, close out
months, and track who's holding how much money — with Google sign-in and a
live Firestore backend. No build step, no native app, no framework — just
static HTML/JS/CSS talking to Firebase.

## One-time setup

You need a free Firebase project. This takes about 10 minutes.

### 1. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project (the free "Spark" plan is enough for this app).
2. In **Build → Authentication → Sign-in method**, enable the **Google** provider.
3. In **Build → Firestore Database**, click **Create database** (production mode, any region close to you).
4. In **Project settings → General → Your apps**, click the `</>` (web) icon to register a new web app. Skip Firebase Hosting setup in that wizard (we'll do it via CLI below). Copy the `firebaseConfig` object it shows you.

### 2. Configure the app

Open [`public/firebase-config.js`](public/firebase-config.js) and fill in:

- `firebaseConfig` — paste the object from step 1.4.
- `ADMINS.A.email` / `ADMINS.B.email` — the two Google account emails that collect payments and hold funds (e.g. Ramesh's and Suresh's real Gmail addresses).
- `SUPER_ADMIN.email` — your own Google account, for view-only oversight across everything (never a fund custodian, can't record payments/winners/transfers).

These three emails are the **only** Google accounts allowed to sign in. They're also duplicated in [`firestore.rules`](firestore.rules) (security rules can't import JS) — **update both files** if you ever change an email.

### 3. Install the Firebase CLI and deploy

```bash
npm install -g firebase-tools
firebase login
```

From this project's root directory:

```bash
firebase use --add
```

Pick the project you created in step 1 and give it the alias `default` (this fills in `.firebaserc`, which currently points at a placeholder `demo-chitfunds` project).

Then deploy the security rules and the site:

```bash
firebase deploy --only firestore:rules,hosting
```

Firebase will print a live URL like `https://your-project.web.app` — that's the app. Open it, sign in with one of the three configured Google accounts, and you're running.

### 4. Add it to your phone's home screen

Open the deployed URL in Chrome (Android) or Safari (iOS) and use "Add to Home Screen" — it installs like an app with its own icon, no app store needed.

## Making changes later

This has no build step — edit files under `public/` directly and redeploy:

```bash
firebase deploy --only hosting
```

If you ever change `firestore.rules`, redeploy rules too:

```bash
firebase deploy --only firestore:rules
```

## Project layout

```
public/
  index.html            page shell
  style.css             all styling
  app.js                the entire app: Firebase wiring, state, rendering
  firebase-config.js     ← your Firebase project + admin emails go here
  manifest.json          PWA metadata (installable icon/name)
firestore.rules          security rules (only the 3 configured emails; the
                          two financial admins can write, the super admin
                          is read-only)
firebase.json             hosting + emulator config
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
without touching your real Firebase project.

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
