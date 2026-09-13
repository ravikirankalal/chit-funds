# Firebase project & deployment notes

The Chit Funds web app (Firebase Auth + Firestore, no build step, in `public/`) is backed by a real Firebase project named **LocalBC**, project ID `localbc-41b52`.

- Live app: https://localbc-41b52.web.app
- Console: https://console.firebase.google.com/project/localbc-41b52/overview
- GitHub repo (private): https://github.com/ravikirankalal/chit-funds (`main` branch, remote `origin`, SSH protocol)

## What's set up

- Web app registered in the project; config wired into `public/firebase-config.js`.
- Firestore API enabled and database created (region `asia-south1` / Mumbai).
- Firestore security rules deployed (`firestore.rules`).
- Google sign-in enabled as an Auth provider.
- Hosting deployed (`firebase deploy --only hosting`).

## Admin email mapping — currently a temporary testing setup

Not the final real configuration. The user asked to log in as Suresh using their own account for testing:

- `ADMINS.A` (Ramesh): still the placeholder `ramesh@gmail.com` — **not a real email yet**.
- `ADMINS.B` (Suresh): set to `ravikiran.kalal@gmail.com`.
- `SUPER_ADMIN`: also `ravikiran.kalal@gmail.com`.

The app's admin lookup checks Ramesh → Suresh → super-admin and returns the first match, so signing in with `ravikiran.kalal@gmail.com` **always resolves to Suresh** (full financial admin), not super-admin — the super-admin role is currently unreachable on that account. This is a known, deliberate tradeoff for testing, not a bug.

## Updating the admin config later

When Ramesh's real email is available, or if super-admin access should be restored on a separate account, update **both** of these together, then redeploy:

1. `public/firebase-config.js` — `ADMINS` and `SUPER_ADMIN`
2. `firestore.rules` — `isFinancialAdmin()` and `isSuperAdmin()`

```bash
firebase deploy --only firestore:rules,hosting --project localbc-41b52
```

See also [dev-tools-auth.md](dev-tools-auth.md) for how the CLIs used to set this up are authenticated.
