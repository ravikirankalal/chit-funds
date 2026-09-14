#!/usr/bin/env bash
# Helper for developing against the local Firebase Emulator Suite instead of
# production. public/js/firebase.js auto-detects the emulator at runtime
# (localhost/127.0.0.1 + the Auth emulator actually answering) — there is no
# flag in firebase-config.js to flip anymore, in either direction.
#
# Usage:
#   scripts/dev-emulator.sh up      # start emulators (foreground)
#   scripts/dev-emulator.sh seed    # seed a demo group into the running emulator
#   scripts/dev-emulator.sh signin  # print a browser-console snippet to sign in without the Google popup
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT=localbc-41b52
BASE="http://127.0.0.1:8080/v1/projects/$PROJECT/databases/(default)/documents"

cmd_up() {
  echo "Starting emulators — auth :9099, firestore :8080, hosting :5050 (Ctrl+C to stop)..."
  echo "public/js/firebase.js will pick these up automatically once they're reachable — nothing to edit."
  firebase emulators:start --only auth,firestore,hosting --project "$PROJECT"
}

# Firestore emulator writes/reads normally go through firestore.rules like a
# real client — "Authorization: Bearer owner" is the emulator's magic admin
# token that bypasses rules entirely, the local equivalent of the production
# IAM-bearer-token trick documented in memory (chit-funds-firebase-project).
cmd_seed() {
  put() { curl -sf -H "Authorization: Bearer owner" -X PATCH "$BASE/$1" -d "$2" > /dev/null; }

  echo "Seeding demo fixture into the local Firestore emulator..."

  put "members/m1" '{"fields":{"name":{"stringValue":"Alice Test"}}}'
  put "members/m2" '{"fields":{"name":{"stringValue":"Bob Test"}}}'
  put "members/m3" '{"fields":{"name":{"stringValue":"Carol Test"}}}'
  put "members/m4" '{"fields":{"name":{"stringValue":"Dave Test"}}}'

  # Deliberately omits totalMembers — real group docs never have that field
  # (see the profit-margin-showed-zero bug in memory); any fixture that adds
  # it back would mask the same class of bug again.
  put "groups/testgrp1" '{
    "fields": {
      "name": {"stringValue": "Test Unpaid Fund"},
      "durationMonths": {"integerValue": "4"},
      "monthlyDeposit": {"integerValue": "10000"},
      "payoutSchedule": {"arrayValue": {"values": [
        {"integerValue": "38000"}, {"integerValue": "37000"}, {"integerValue": "36000"}, {"integerValue": "35000"}
      ]}},
      "memberIds": {"arrayValue": {"values": [
        {"stringValue": "m1"}, {"stringValue": "m2"}, {"stringValue": "m3"}, {"stringValue": "m4"}
      ]}},
      "currentMonth": {"integerValue": "2"},
      "status": {"stringValue": "active"},
      "startYear": {"integerValue": "2026"},
      "startMonthIndex": {"integerValue": "0"},
      "createdBy": {"stringValue": "B"}
    }
  }'

  # Month 1: closed, but only 3 of 4 members paid — a closed month with
  # unpaid dues, the exact case the amber warning/reopen-to-pay UI covers.
  put "groups/testgrp1/months/1" '{
    "fields": {
      "status": {"stringValue": "closed"},
      "winnerId": {"stringValue": "m1"},
      "payoutAdmin": {"stringValue": "B"},
      "closedLabel": {"stringValue": "Jan 2026"},
      "transferNet": {"integerValue": "0"}
    }
  }'
  for mid in m1 m2 m3; do
    put "groups/testgrp1/months/1/payments/$mid" '{
      "fields": {"paid": {"booleanValue": true}, "collectedBy": {"stringValue": "B"}, "mode": {"stringValue": "cash"}}
    }'
  done

  # Month 2: open, nothing collected yet.
  put "groups/testgrp1/months/2" '{"fields": {"status": {"stringValue": "open"}, "transferNet": {"integerValue": "0"}}}'

  echo "Done: 'Test Unpaid Fund' (testgrp1) — month 1 closed with 1/4 unpaid, month 2 open."
}

# signInWithPopup(GoogleAuthProvider) cannot complete in a sandboxed/automated
# browser (real Google: popup blocked; the Auth Emulator's fake IDP widget:
# "No matching frame", because the click navigates the tab in place instead
# of opening a true child window). This bypasses the popup/widget UI
# entirely by reusing the app's own already-initialized Auth instance and
# signing in with email/password — the emulator accepts that regardless of
# which providers the production app actually exposes.
cmd_signin() {
  cat <<'JS'
Paste into the browser console on the running app tab (http://localhost:5050),
after 'scripts/dev-emulator.sh up' is running, to sign in without the Google
popup:

const authMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
const appMod = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
const auth = authMod.getAuth(appMod.getApp());
const EMAIL = 'ravikiran.kalal@gmail.com'; // must match ADMINS/SUPER_ADMIN in firebase-config.js
const PASSWORD = 'testpass123';
try { await authMod.createUserWithEmailAndPassword(auth, EMAIL, PASSWORD); } catch (e) {}
await authMod.signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
JS
}

case "${1:-}" in
  up) cmd_up ;;
  seed) cmd_seed ;;
  signin) cmd_signin ;;
  down)
    echo "Nothing to revert — the emulator is auto-detected at runtime now, no flag to flip back."
    ;;
  *)
    echo "Usage: $0 {up|seed|signin}" >&2
    exit 1
    ;;
esac
