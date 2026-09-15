import { doc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../firebase.js';
import { state, groupsById, paymentsCache, monthKey } from '../store.js';
import { isSuper } from '../helpers.js';
import { pushNav } from '../router.js';
import { render } from '../render.js';
import { setBusy, isPendingHandoff } from './shared.js';

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
export function closePaymentModal() { history.back(); }
export function setModalMode(mode) { if (!state.ui.paymentModal) return; state.ui.paymentModal.mode = mode; render(); }

export async function savePaymentModal() {
  if (isSuper()) return;
  var pm = state.ui.paymentModal;
  if (!pm) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var existing = (paymentsCache.get(monthKey(gid, m)) || {})[pm.memberId];
  // Only the collector currently holding the amount may change its mode,
  // and only before it's been handed off to the other admin (either
  // already-transferred, or a hand-off request against it is pending).
  if (existing && existing.paid && (existing.collectedBy !== state.currentAdmin || existing.transferred)) return;
  if (existing && isPendingHandoff(gid, m, pm.memberId)) return;
  setBusy(true);
  try {
    var ref = doc(db, 'groups', gid, 'months', String(m), 'payments', pm.memberId);
    await setDoc(ref, {
      paid: true, collectedBy: (existing && existing.paid) ? existing.collectedBy : state.currentAdmin, mode: pm.mode,
      transferred: !!(existing && existing.transferred),
      paidAt: (existing && existing.paidAt) || serverTimestamp()
    });
    // openPaymentModal() pushed a nav entry for this member; pop it via
    // history.back(), same as closePaymentModal() — see router.js's
    // popstate handler for why this doesn't also cause a render flash.
    state.ui.paymentModal = null;
    history.back();
  } catch (err) {
    alert('Could not save payment: ' + err.message);
  } finally { setBusy(false); }
}

export async function markUnpaidFromModal() {
  if (isSuper()) return;
  var pm = state.ui.paymentModal;
  if (!pm) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var existing = (paymentsCache.get(monthKey(gid, m)) || {})[pm.memberId];
  // Only whoever currently holds the amount can undo the payment, and only
  // if it was never handed off — a payment received via transfer (or one
  // with a hand-off still pending against it) can no longer be marked
  // unpaid, same lock as editing its mode in savePaymentModal above.
  if (existing && (existing.collectedBy !== state.currentAdmin || existing.transferred)) return;
  if (existing && isPendingHandoff(gid, m, pm.memberId)) return;
  setBusy(true);
  try {
    await deleteDoc(doc(db, 'groups', gid, 'months', String(m), 'payments', pm.memberId));
    state.ui.paymentModal = null;
    history.back(); // see savePaymentModal() above
  } catch (err) {
    alert('Could not update payment: ' + err.message);
  } finally { setBusy(false); }
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
