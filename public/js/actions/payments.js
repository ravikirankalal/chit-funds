import { doc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../firebase.js';
import { state, groupsById, paymentsCache, monthKey } from '../store.js';
import { isSuper, adminName } from '../helpers.js';
import { pushNav } from '../router.js';
import { render } from '../render.js';
import { confirmWithBiometrics } from '../webauthn.js';
import { isPendingHandoff } from './shared.js';

export function openPaymentModal(memberId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  if (m > group.currentMonth) return;
  var existing = (paymentsCache.get(monthKey(gid, m)) || {})[memberId];
  var initialMode = (existing && existing.mode) || 'cash';
  state.ui.paymentModal = { memberId: memberId, mode: initialMode, originalMode: initialMode, isEditing: !!(existing && existing.paid) };
  render();
  pushNav();
}
export function closePaymentModal() {
  var pm = state.ui.paymentModal;
  // The sheet's own close button already omits data-action while a write
  // is actually in flight (paymentModal.js) so a click can't normally
  // reach here — this guard is just so nothing else that might call
  // closePaymentModal directly can pop the nav entry mid-write.
  //
  // Only 'saving' is blocked. 'verifying' (the biometric prompt) is left
  // open as the escape hatch for a hung WebAuthn call: mobile browsers
  // throttle JS timers while a native biometric sheet has focus, so
  // webauthn.js's own timeout can't be relied on to fire and unstick the
  // UI by itself — without this, a hang here left the admin with no way
  // out at all short of a page reload (reported in production). 'success'
  // is also left open, on purpose: the sheet no longer closes itself once
  // a save/mark-unpaid lands, so the admin reviews the result and closes
  // it manually from here.
  if (pm && pm.saveState === 'saving') return;
  history.back();
}
export function setModalMode(mode) { if (!state.ui.paymentModal) return; state.ui.paymentModal.mode = mode; render(); }

export async function savePaymentModal() {
  if (isSuper()) return;
  var pm = state.ui.paymentModal;
  if (!pm || pm.saveState === 'saving') return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var existing = (paymentsCache.get(monthKey(gid, m)) || {})[pm.memberId];
  // Only the collector currently holding the amount may change its mode,
  // and only before it's been handed off to the other admin (either
  // already-transferred, or a hand-off request against it is pending).
  if (existing && existing.paid && (existing.collectedBy !== state.currentAdmin || existing.transferred)) return;
  if (existing && isPendingHandoff(gid, m, pm.memberId)) return;
  // Drives the sheet's own saving/success/error states (paymentModal.js)
  // instead of the app-wide busy overlay — that overlay blanked the whole
  // screen behind a dark scrim for the length of the write, reading as
  // the page reloading rather than this one sheet doing something.
  // pendingAction tells the sheet which of its two buttons (this one, or
  // markUnpaidFromModal's) is the one actually in flight, since both
  // write through the same pm.saveState.
  pm.pendingAction = 'save-payment';
  // A no-op { ok: true } when the feature is off (webauthn.js's own
  // config check) — otherwise this is the actual device fingerprint/Face
  // ID/PIN prompt, and the write below never runs unless it succeeds.
  pm.saveState = 'verifying';
  pm.saveError = null;
  render();
  var confirmation = await confirmWithBiometrics(state.currentAdmin, adminName(state.currentAdmin));
  if (!confirmation.ok) {
    pm.saveState = 'error';
    pm.saveError = confirmation.message;
    render();
    return;
  }
  pm.saveState = 'saving';
  render();
  try {
    var ref = doc(db, 'groups', gid, 'months', String(m), 'payments', pm.memberId);
    await setDoc(ref, {
      paid: true, collectedBy: (existing && existing.paid) ? existing.collectedBy : state.currentAdmin, mode: pm.mode,
      transferred: !!(existing && existing.transferred),
      paidAt: (existing && existing.paidAt) || serverTimestamp()
    });
    // Left on screen — the admin just confirmed this with their own
    // fingerprint and should see that it actually landed, not have the
    // sheet vanish out from under them. They close it themselves
    // (closePaymentModal, which now allows that from 'success') once
    // they've seen it.
    pm.saveState = 'success';
    render();
  } catch (err) {
    // Left open on failure, with the error shown inline (paymentModal.js)
    // instead of a blocking alert() — the admin can see what happened,
    // fix it (a flaky connection, a rules rejection) and press Save again
    // without having to reopen the sheet from scratch.
    pm.saveState = 'error';
    pm.saveError = err.message;
    render();
  }
}

export async function markUnpaidFromModal() {
  if (isSuper()) return;
  var pm = state.ui.paymentModal;
  if (!pm || pm.saveState === 'saving') return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var existing = (paymentsCache.get(monthKey(gid, m)) || {})[pm.memberId];
  // Only whoever currently holds the amount can undo the payment, and only
  // if it was never handed off — a payment received via transfer (or one
  // with a hand-off still pending against it) can no longer be marked
  // unpaid, same lock as editing its mode in savePaymentModal above.
  if (existing && (existing.collectedBy !== state.currentAdmin || existing.transferred)) return;
  if (existing && isPendingHandoff(gid, m, pm.memberId)) return;
  // Same sheet-scoped saving/success/error flow as savePaymentModal, and
  // the same pm.saveState field — pendingAction is what tells the sheet
  // it's THIS button's loading/success/error copy to show, not Save
  // Payment's.
  pm.pendingAction = 'mark-unpaid';
  pm.saveState = 'verifying';
  pm.saveError = null;
  render();
  var unpaidConfirmation = await confirmWithBiometrics(state.currentAdmin, adminName(state.currentAdmin));
  if (!unpaidConfirmation.ok) {
    pm.saveState = 'error';
    pm.saveError = unpaidConfirmation.message;
    render();
    return;
  }
  pm.saveState = 'saving';
  render();
  try {
    await deleteDoc(doc(db, 'groups', gid, 'months', String(m), 'payments', pm.memberId));
    // Left on screen — see savePaymentModal() above; the admin closes it
    // themselves once they've seen the result.
    pm.saveState = 'success';
    render();
  } catch (err) {
    pm.saveState = 'error';
    pm.saveError = err.message;
    render();
  }
}

// Long-pressing a paid entry in the logged-in admin's own "collected by"
// section selects it for a hand-off to the other admin — see
// renderTransferBar in views/monthDetail/transferBar.js. A long press starts the selection
// with one entry; once active, a plain tap on another eligible entry in
// the same section toggles it too (see the 'open-payment-modal' case in
// events.js) — so this single toggle covers both the long-press and the
// tap-to-add/remove paths.
export function togglePaymentSelection(mid) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  if (!group || m > group.currentMonth) return;
  var existing = (paymentsCache.get(monthKey(gid, m)) || {})[mid];
  if (!existing || !existing.paid || existing.collectedBy !== state.currentAdmin) return;
  if (isPendingHandoff(gid, m, mid)) return; // already offered in another still-pending request
  var sel = state.ui.transferSelection || (state.ui.transferSelection = { mids: [] });
  var idx = sel.mids.indexOf(mid);
  if (idx === -1) sel.mids.push(mid); else sel.mids.splice(idx, 1);
  if (!sel.mids.length) state.ui.transferSelection = null;
  render();
}

export function cancelTransferSelection() {
  state.ui.transferSelection = null;
  render();
}
