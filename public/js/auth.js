// Google sign-in, the admin allowlist check, and wiring auth state changes
// to navigation + the Firestore listeners.

import {
  GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { auth, db } from './firebase.js';
import { state } from './store.js';
import { mergeAdmins } from './helpers.js';
import { goTo, getRestorableSnapshot } from './router.js';
import { render } from './render.js';
import { startListeners, stopListeners } from './listeners.js';

function findAdminIdByEmail(email, admins) {
  if (!email) return null;
  email = email.toLowerCase();
  if (admins.A.email.toLowerCase() === email) return 'A';
  if (admins.B.email.toLowerCase() === email) return 'B';
  if (admins.SUPER.email.toLowerCase() === email) return 'SUPER';
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
  // config/app's admins field can override the hardcoded emails in
  // firebase-config.js (see store.js and helpers.js's mergeAdmins) — but
  // WHO is signing in has to be known before startListeners() begins the
  // live version of that same doc, so this is a one-off fetch rather than
  // waiting on the listener. firestore.rules still only grants read/write
  // access by the emails hardcoded there, unchanged by this doc — so if an
  // admin's email was changed here without also updating firestore.rules,
  // that new email has no Firestore access at all and this fetch itself
  // fails, landing in the catch below.
  getDoc(doc(db, 'config', 'app')).then(function (snap) {
    var admins = mergeAdmins(snap.exists() ? snap.data().admins : null);
    var adminId = findAdminIdByEmail(user.email, admins);
    if (!adminId) {
      state.authError = 'The Google account "' + user.email + '" is not authorized for this app.';
      signOut(auth);
      return;
    }
    state.currentAdmin = adminId;
    // Seeds state.config.admins immediately so the very first render (before
    // startListeners()'s own live listener delivers its first snapshot)
    // already shows the right names, not a one-frame flash of the defaults.
    state.config.admins = admins;
    startListeners();
    var restorable = getRestorableSnapshot();
    if (restorable) goTo(restorable.screen, { activeGroupId: restorable.activeGroupId, viewMonth: restorable.viewMonth, viewMemberId: restorable.viewMemberId });
    else goTo('dashboard');
  }).catch(function (err) {
    state.authError = 'Could not verify admin access: ' + err.message;
    signOut(auth);
  });
});
