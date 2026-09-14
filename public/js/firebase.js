// Firebase SDK initialization — the one place that talks to the CDN and
// reads firebase-config.js. Everything else imports `auth`/`db` from here.

import { firebaseConfig } from '../firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initializeFirestore, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// experimentalAutoDetectLongPolling: some networks/sandboxes don't support the
// streaming WebChannel connection Firestore prefers; this transparently falls
// back to long-polling when it detects that, with no effect where streaming
// works fine — the recommended setting for broad compatibility.
export const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });

// Emulator use is detected at runtime instead of a hand-flipped constant —
// there's nothing to remember to set back to false before deploying, and
// no way to accidentally ship a build still pointed at the emulator.
//
// Only even considered on localhost/127.0.0.1 (never true for a real
// deployed domain), and only acted on if the Auth emulator actually
// answers within a short timeout — so a plain `firebase emulators:start
// --only hosting` preview (no auth/firestore emulator running) still
// falls through to the real project, exactly as it would if this file
// didn't exist.
const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

async function authEmulatorReachable() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, 350);
    await fetch('http://localhost:9099/emulator/v1/projects/' + firebaseConfig.projectId + '/config', { signal: ctrl.signal, mode: 'no-cors' });
    clearTimeout(timer);
    return true;
  } catch (e) {
    return false;
  }
}

// getAuth() above already kicked off an async restore of any persisted
// session (read from IndexedDB) the moment this module started running.
// connectAuthEmulator() throws auth/emulator-config-failed if it's called
// after that restore has progressed — a race this file loses on every
// reload once a session exists to restore, since the `await` below always
// gives that restore a turn first. Caching the previous detection result
// (per tab) lets a repeat visit skip the `await` entirely and call
// connectAuthEmulator in the same synchronous tick as getAuth(), which
// wins the race; only the very first visit in a tab — when there's no
// persisted session yet to race against — needs the real async probe.
const EMULATOR_CACHE_KEY = 'chitfunds:useEmulator';
var useEmulator = false;
if (isLocalHost) {
  var cached = sessionStorage.getItem(EMULATOR_CACHE_KEY);
  if (cached === '1') useEmulator = true;
  else if (cached !== '0') useEmulator = await authEmulatorReachable();
  sessionStorage.setItem(EMULATOR_CACHE_KEY, useEmulator ? '1' : '0');
}

if (useEmulator) {
  // Belt-and-braces: if the race is somehow still lost (e.g. a slow tab),
  // fall back loudly rather than silently proceeding against production —
  // silently talking to prod during "local" testing could mean writes land
  // in real data without anyone noticing.
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, 'localhost', 8080);
  } catch (e) {
    console.error('[firebase] Failed to connect to local emulators — this session may be talking to PRODUCTION Firebase instead. Reload to retry.', e);
  }
}
