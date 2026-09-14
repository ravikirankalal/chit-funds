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

if (isLocalHost && (await authEmulatorReachable())) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
}
