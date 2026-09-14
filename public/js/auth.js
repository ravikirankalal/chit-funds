// Google sign-in, the admin allowlist check, and wiring auth state changes
// to navigation + the Firestore listeners.

import {
  GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { auth } from './firebase.js';
import { ADMINS, SUPER_ADMIN } from '../firebase-config.js';
import { state } from './store.js';
import { goTo, getRestorableSnapshot } from './router.js';
import { render } from './render.js';
import { startListeners, stopListeners } from './listeners.js';

function findAdminIdByEmail(email) {
  if (!email) return null;
  email = email.toLowerCase();
  if (ADMINS.A.email.toLowerCase() === email) return 'A';
  if (ADMINS.B.email.toLowerCase() === email) return 'B';
  if (SUPER_ADMIN.email.toLowerCase() === email) return 'SUPER';
  return null;
}

export function signInGoogle() {
  state.authError = null;
  var provider = new GoogleAuthProvider();
  // popup avoids signInWithRedirect's cross-origin storage handoff between
  // the hosting domain and authDomain, which silently fails to link back in
  // some browsers (consent completes, but the app never sees the user)
  signInWithPopup(auth, provider).catch(function (err) {
    if (err && (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request')) return;
    state.authError = 'Sign-in failed: ' + err.message;
    render();
  });
}

export function doLogout() { signOut(auth); }

onAuthStateChanged(auth, function (user) {
  if (!user) {
    stopListeners();
    goTo('login');
    return;
  }
  var adminId = findAdminIdByEmail(user.email);
  if (!adminId) {
    state.authError = 'The Google account "' + user.email + '" is not authorized for this app.';
    signOut(auth);
    return;
  }
  state.currentAdmin = adminId;
  startListeners();
  var snap = getRestorableSnapshot();
  if (snap) goTo(snap.screen, { activeGroupId: snap.activeGroupId, viewMonth: snap.viewMonth });
  else goTo('dashboard');
});
