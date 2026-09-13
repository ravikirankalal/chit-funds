// Firebase SDK initialization — the one place that talks to the CDN and
// reads firebase-config.js. Everything else imports `auth`/`db` from here.

import { firebaseConfig, USE_EMULATORS } from '../firebase-config.js';
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

if (USE_EMULATORS) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
}
