// Device-biometric confirmation, built on the WebAuthn platform-authenticator
// API — the only standard way for a web page to trigger the phone's own
// lock-screen check (fingerprint, Face ID, PIN, pattern, whatever the OS is
// already configured to use). Deliberately generic and not tied to payments:
// confirmWithBiometrics() is meant to gate ANY sensitive action in the app
// (recording a payment today; a payout save, a member edit, etc. later) —
// callers just await it and check `.ok` before proceeding.
//
// No server-side verification happens anywhere (this app has no backend
// beyond Firestore + static hosting) — a successful assertion just proves
// THIS device's own OS-level check passed, the same trust level as an admin
// unlocking their phone to open the app in the first place. That's the
// deliberate scope: a speed bump against "the phone was left unlocked and
// unattended," not a cryptographic identity system.
//
// Each admin registers a platform credential once per device/browser — the
// credential id is remembered in that browser's own localStorage (not
// Firestore: WebAuthn credentials are already device-bound at the hardware
// level, and a *local* record sidesteps the ambiguity where a stale global
// list can't tell "never registered on this device" apart from "user just
// declined the prompt," since WebAuthn deliberately doesn't distinguish
// those two for privacy reasons). If storage is cleared or this is a new
// device, the next confirmWithBiometrics() call just registers again —
// low-friction, and no less secure than the first time.

import { state } from './store.js';

var STORAGE_PREFIX = 'chitfunds:biometricCredentialId:';

function storageKey(adminId) { return STORAGE_PREFIX + adminId; }

function getStoredCredentialId(adminId) {
  try { return localStorage.getItem(storageKey(adminId)); } catch (e) { return null; }
}
function setStoredCredentialId(adminId, id) {
  try { localStorage.setItem(storageKey(adminId), id); } catch (e) {}
}
function clearStoredCredentialId(adminId) {
  try { localStorage.removeItem(storageKey(adminId)); } catch (e) {}
}

var BIOMETRIC_TIMEOUT_MS = 30000;

// A hard backstop against a hung WebAuthn call. Browsers vary in how
// reliably they honor the `signal`/`timeout` options below on their own —
// a call that never settles at all would leave the caller's "verifying" UI
// stuck forever, with no way to retry or even close the sheet (this is
// exactly what was reported: worked once, then stuck on "Confirming with
// biometrics..." from the second attempt on). Racing the real call against
// a plain timer guarantees SOME rejection by BIOMETRIC_TIMEOUT_MS regardless
// of whether the browser's own abort handling kicks in.
function withTimeout(run) {
  var controller = new AbortController();
  var abortTimer = setTimeout(function () { controller.abort(); }, BIOMETRIC_TIMEOUT_MS);
  var backstop = new Promise(function (resolve, reject) {
    setTimeout(function () { reject(new Error('Biometric confirmation timed out — try again.')); }, BIOMETRIC_TIMEOUT_MS + 1000);
  });
  return Promise.race([run(controller.signal), backstop]).finally(function () { clearTimeout(abortTimer); });
}

function randomBytes(len) {
  var bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return bytes;
}

function base64UrlToBytes(base64url) {
  var base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  var padLen = (4 - (base64.length % 4)) % 4;
  var padded = base64 + new Array(padLen + 1).join('=');
  var binary = atob(padded);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Whether this device/browser can actually do a platform-bound (not a
// roaming USB/NFC key) biometric or PIN check at all — false on most
// desktops without a fingerprint reader and on older browsers.
export async function isPlatformAuthenticatorAvailable() {
  try {
    if (!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (e) {
    return false;
  }
}

// The remote kill switch — a config/app Firestore doc's biometricAuthEnabled
// field, kept live by listeners.js. Callers can check this up front to skip
// showing biometric-related UI entirely while the feature is off.
export function isBiometricGateEnabled() {
  return !!state.config.biometricAuthEnabled;
}

// Creates this device's platform credential for adminId and remembers its
// id locally. The create() call itself requires the same OS-level biometric
// check as a later get() — so the very first confirmWithBiometrics() call
// on a new device only ever prompts once, not "register" then "verify" back
// to back.
function registerCredential(adminId, adminLabel) {
  return withTimeout(async function (signal) {
    var credential = await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: 'Chit Funds' },
        user: { id: randomBytes(16), name: adminLabel || adminId, displayName: adminLabel || adminId },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        attestation: 'none',
        timeout: BIOMETRIC_TIMEOUT_MS
      },
      signal: signal
    });
    if (!credential) throw new Error('Setup was cancelled.');
    setStoredCredentialId(adminId, credential.id);
  });
}

function assertCredential(credentialId) {
  return withTimeout(async function (signal) {
    var assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ id: base64UrlToBytes(credentialId), type: 'public-key' }],
        userVerification: 'required',
        timeout: BIOMETRIC_TIMEOUT_MS
      },
      signal: signal
    });
    if (!assertion) throw new Error('Confirmation was cancelled.');
  });
}

// A browser only ever allows ONE WebAuthn ceremony in flight per tab —
// this is enforced by the browser/OS itself, not something our own
// AbortController reliably overrides (aborting the JS-side wait doesn't
// always dismiss a native biometric sheet still on screen, especially
// after the tab was backgrounded while it was showing, which throttles
// our own timeout right when it matters most). If an earlier attempt is
// still wedged there when we start a new one, the browser rejects
// immediately with a "request is already pending" style error — reusable
// detection since it means retrying with EITHER assertCredential or
// registerCredential right now is doomed the same way.
function isAlreadyPendingError(err) {
  return !!err && /already\s+pending/i.test(err.message || '');
}

var inFlight = false;

// The one function callers actually need. Resolves { ok: true } immediately
// if the feature is off; otherwise runs (or sets up) this device's platform
// biometric check and resolves { ok: false, reason, message } on anything
// short of success — unsupported hardware/browser, the OS prompt being
// cancelled or timing out, a stale/removed credential, or an earlier
// attempt still wedged at the browser level. Callers should treat any
// non-ok result as "do not proceed," matching this app's fail-closed
// choice for devices that can't do the check at all.
export async function confirmWithBiometrics(adminId, adminLabel) {
  if (!isBiometricGateEnabled()) return { ok: true };
  // Covers the common "tapped Save again while still waiting" case without
  // even attempting a second browser-level call we already know is
  // pointless — the message-sniffing below is the fallback for when the
  // FIRST call already gave up (our own timeout fired) but the browser's
  // ceremony is still wedged from an even earlier, already-abandoned
  // attempt.
  if (inFlight) return { ok: false, reason: 'busy', message: 'Still waiting on an earlier biometric check — reload the page if this does not clear in a few seconds.' };
  var available = await isPlatformAuthenticatorAvailable();
  if (!available) return { ok: false, reason: 'unsupported', message: 'This device does not support biometric confirmation.' };
  var storedId = getStoredCredentialId(adminId);
  inFlight = true;
  try {
    try {
      if (storedId) await assertCredential(storedId);
      else await registerCredential(adminId, adminLabel);
      return { ok: true };
    } catch (err) {
      if (isAlreadyPendingError(err)) {
        return { ok: false, reason: 'busy', message: 'A biometric prompt from an earlier attempt is still stuck — reload the page and try again.' };
      }
      if (!storedId) return { ok: false, reason: 'denied', message: (err && err.message) || 'Biometric confirmation failed.' };
      // The remembered credential no longer works on THIS device — cleared
      // passkeys, a stale id, whatever — and unlike a desktop, an admin on
      // their phone has no way to fix that themselves (no devtools to
      // clear localStorage). Rather than leaving every future save stuck
      // the same way, drop the bad id and register fresh: one extra
      // prompt, but no dead end. A genuine cancel just gets asked again
      // immediately, same as most apps' own "didn't quite catch that, try
      // again" pattern.
      clearStoredCredentialId(adminId);
      try {
        await registerCredential(adminId, adminLabel);
        return { ok: true };
      } catch (err2) {
        if (isAlreadyPendingError(err2)) {
          return { ok: false, reason: 'busy', message: 'A biometric prompt from an earlier attempt is still stuck — reload the page and try again.' };
        }
        return { ok: false, reason: 'denied', message: (err2 && err2.message) || 'Biometric confirmation failed.' };
      }
    }
  } finally {
    inFlight = false;
  }
}
