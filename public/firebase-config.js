// Fill these in from your Firebase project's console:
// Project settings -> General -> Your apps -> Web app -> SDK setup and configuration
export const firebaseConfig = {
  apiKey: "AIzaSyAJr9yvtgtt7e21RSgLkXFfrsdDxZWO88c",
  authDomain: "localbc-41b52.firebaseapp.com",
  projectId: "localbc-41b52",
  storageBucket: "localbc-41b52.firebasestorage.app",
  messagingSenderId: "626888021222",
  appId: "1:626888021222:web:89911e33e91338b2bf9727"
};

// The two financial admins — they collect payments, hold the cash, and are
// the only two parties in the balance/transfer system. Keys are internal
// admin ids used everywhere in the app; "email" must be the exact Google
// account email.
// IMPORTANT: these emails are also duplicated in firestore.rules (rules
// can't import this file) — if you change one here, change it there too.
export const ADMINS = {
  A: { email: "ramesh@gmail.com", name: "Ramesh" },
  B: { email: "ravikiran.kalal@gmail.com", name: "Suresh" }
};

// A third account with view-only oversight: can sign in and see every group,
// month, and the ledger, but is not a fund custodian — never selectable as
// "collected by" / "paid out by", and cannot record payments, pick winners,
// close months, create groups, or take part in transfers.
// IMPORTANT: also duplicated in firestore.rules.
export const SUPER_ADMIN = { email: "ravikiran.kalal@gmail.com", name: "Ravikiran" };

// Set to true while developing against the local Firebase Emulator Suite
// (see README.md). Leave false for the real deployed app.
export const USE_EMULATORS = false;
