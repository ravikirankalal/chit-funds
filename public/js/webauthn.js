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
function transportsKey(adminId) { return STORAGE_PREFIX + adminId + ':transports'; }

function getStoredCredentialId(adminId) {
  try { return localStorage.getItem(storageKey(adminId)); } catch (e) { return null; }
}
// The transports hint recorded when this credential was created — see the
// comment on assertCredential() below for why this is the actual fix for
// the "stuck at Confirming biometrics" reports, not just another timeout
// tweak. Every credential this module has ever created came from
// registerCredential()'s platform-only request, so 'internal' is always
// the correct default for a stored id that predates this field.
function getStoredTransports(adminId) {
  try {
    var parsed = JSON.parse(localStorage.getItem(transportsKey(adminId)));
    return (Array.isArray(parsed) && parsed.length) ? parsed : ['internal'];
  } catch (e) { return ['internal']; }
}
function setStoredCredential(adminId, id, transports) {
  try {
    localStorage.setItem(storageKey(adminId), id);
    localStorage.setItem(transportsKey(adminId), JSON.stringify((transports && transports.length) ? transports : ['internal']));
  } catch (e) {}
}
function clearStoredCredentialId(adminId) {
  try {
    localStorage.removeItem(storageKey(adminId));
    localStorage.removeItem(transportsKey(adminId));
  } catch (e) {}
}

var BIOMETRIC_TIMEOUT_MS = 30000;
var FOREGROUND_GRACE_MS = 1500;

// A hard backstop against a hung WebAuthn call. Two independent triggers
// call controller.abort(), because neither alone is reliable:
//
// 1. A plain BIOMETRIC_TIMEOUT_MS timer — fine while the tab stays in the
//    foreground, but this is exactly the timer mobile browsers throttle
//    (sometimes to the point of never firing at all) once a native
//    biometric sheet takes focus and backgrounds the tab. If THIS is the
//    only trigger, a hang while backgrounded means abort() may simply
//    never run — which also explains why a page reload sometimes doesn't
//    clear a stuck ceremony: if we never actually told the browser to
//    cancel anything, there was nothing for the reload to have released.
// 2. A `visibilitychange` listener — fires as soon as the browser brings
//    the tab back to the foreground (a real event dispatched by the
//    browser itself, not a queued JS timer, so background throttling
//    can't delay it). If the tab is visible again but our call still
//    hasn't settled, that means the native sheet closed one way or
//    another with no result ever delivered to us — so we wait a short
//    FOREGROUND_GRACE_MS (foreground timers run at full speed) for a
//    just-arriving result, then abort. This is the trigger that actually
//    fires in the reported failure mode, where the fixed timer above
//    got starved the whole time the tab was backgrounded.
//
// Aborting an already-settled request is a harmless no-op, so both can
// safely race against the real outcome.
function withTimeout(run) {
  var controller = new AbortController();
  function abortNow() { try { controller.abort(); } catch (e) {} }
  var abortTimer = setTimeout(abortNow, BIOMETRIC_TIMEOUT_MS);
  var foregroundTimer = null;
  function onVisibilityChange() {
    if (document.visibilityState !== 'visible') return;
    clearTimeout(foregroundTimer);
    foregroundTimer = setTimeout(abortNow, FOREGROUND_GRACE_MS);
  }
  document.addEventListener('visibilitychange', onVisibilityChange);
  var backstop = new Promise(function (resolve, reject) {
    setTimeout(function () { reject(new Error('Biometric confirmation timed out — try again.')); }, BIOMETRIC_TIMEOUT_MS + 1000);
  });
  return Promise.race([run(controller.signal), backstop]).finally(function () {
    clearTimeout(abortTimer);
    clearTimeout(foregroundTimer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  });
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
    // getTransports() reports how THIS credential is actually reachable
    // (['internal'] for a platform authenticator, always the case here).
    // Recording it now is what lets assertCredential() below pass it back
    // on every future check — see that function's comment for why that
    // hint is not optional on Android. navigator.credentials.create() is
    // typed to return the generic Credential, and PublicKeyCredential's
    // own .response is typed as the base AuthenticatorResponse (no
    // getTransports) — two narrowing steps down to the concrete
    // AuthenticatorAttestationResponse .create() actually returns are what
    // the type checker needs, even though both are always true at runtime
    // for this call (passing `publicKey` guarantees both).
    var transports = (credential instanceof PublicKeyCredential && credential.response instanceof AuthenticatorAttestationResponse)
      ? credential.response.getTransports() : ['internal'];
    setStoredCredential(adminId, credential.id, transports);
  });
}

function assertCredential(credentialId, transports) {
  return withTimeout(async function (signal) {
    var assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        // transports is a routing hint, not a security check — Chrome on
        // Android is documented (dfinity/internet-identity#4334) to hang
        // for 25-45s and then throw ("Transport smart-card not
        // supported") when it's omitted, because Play Services' Credential
        // Manager has to itself figure out how to reach the credential
        // with no hint at all. This is almost certainly the actual cause
        // behind every "stuck at Confirming biometrics" / "already
        // pending" report so far — every earlier fix here (timeouts,
        // abort-on-visibilitychange) only shortened the hang, since none
        // of them addressed why the browser was hanging in the first
        // place.
        allowCredentials: [{ id: base64UrlToBytes(credentialId), type: 'public-key', transports: transports }],
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
      if (storedId) await assertCredential(storedId, getStoredTransports(adminId));
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
