import { doc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../firebase.js';
import { state, groupsById, paymentsCache, monthKey } from '../store.js';
import { isSuper } from '../helpers.js';
import { pushNav } from '../router.js';
import { render } from '../render.js';
import { isPendingHandoff, delay, SAVE_SUCCESS_DISPLAY_MS } from './shared.js';

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
  // The sheet's own close button already omits data-action for this case
  // (paymentModal.js) so a click can't normally reach here — this guard
  // is just so nothing else that might call closePaymentModal directly
  // can pop the nav entry savePaymentModal itself is about to pop.
  if (pm && (pm.saveState === 'saving' || pm.saveState === 'success')) return;
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
  pm.saveState = 'saving';
  pm.saveError = null;
  render();
  try {
    var ref = doc(db, 'groups', gid, 'months', String(m), 'payments', pm.memberId);
    await setDoc(ref, {
      paid: true, collectedBy: (existing && existing.paid) ? existing.collectedBy : state.currentAdmin, mode: pm.mode,
      transferred: !!(existing && existing.transferred),
      paidAt: (existing && existing.paidAt) || serverTimestamp()
    });
    pm.saveState = 'success';
    render();
    // A brief beat on the success state so it's actually seen before the
    // sheet closes itself — same amount of "did that work?" reassurance a
    // native app's checkmark-then-dismiss pattern gives.
    await delay(SAVE_SUCCESS_DISPLAY_MS);
    // openPaymentModal() pushed a nav entry for this member; pop it via
    // history.back(), same as closePaymentModal() — see router.js's
    // popstate handler for why the render this triggers is usually
    // skipped as a no-op. That's only true because THIS render (still
    // needed here — nothing else fires it once setBusy(false) no longer
    // does) already applied the closed state first.
    state.ui.paymentModal = null;
    render();
    history.back();
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
  pm.saveState = 'saving';
  pm.saveError = null;
  render();
  try {
    await deleteDoc(doc(db, 'groups', gid, 'months', String(m), 'payments', pm.memberId));
    pm.saveState = 'success';
    render();
    await delay(SAVE_SUCCESS_DISPLAY_MS);
    state.ui.paymentModal = null; // see savePaymentModal() above
    render();
    history.back();
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
