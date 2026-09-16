import { doc, setDoc, deleteDoc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../firebase.js';
import { state, groupsById, transferReqCache, monthKey } from '../store.js';
import { isSuper, adminName } from '../helpers.js';
import { monthFinances } from '../finance/monthFinances.js';
import { confirmWithBiometrics } from '../webauthn.js';
import { setBusy } from './shared.js';

// A whole-month, admin-to-admin holdings transfer — distinct from a
// hand-off of one specific already-collected payment (see handoffs.js):
// this moves the running imbalance between the two admins' totals for the
// month, not any one member's payment.
function requestTransfer(direction) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  if (m !== group.currentMonth) return;
  if (transferReqCache.get(monthKey(gid, m))) return;
  var f = monthFinances(gid, group, m);
  var amount = direction === 'AtoB' ? f.adjA : f.adjB;
  if (amount <= 0) return;
  setBusy(true);
  setDoc(doc(db, 'groups', gid, 'transferRequests', String(m)), {
    month: m, direction: direction, amount: amount, requestedBy: state.currentAdmin, createdAt: serverTimestamp()
  }).catch(function (err) { alert('Could not request transfer: ' + err.message); })
    .finally(function () { setBusy(false); });
}
export function requestTransferToB() { requestTransfer('AtoB'); }
export function requestTransferToA() { requestTransfer('BtoA'); }

export async function acceptTransferRequest() {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  setBusy(true);
  // Moves money between the two admins' holdings just like a payment save
  // does — same biometric gate, see webauthn.js. No dedicated "verifying"
  // UI state here (this action's own global busy spinner covers it); a
  // failed/cancelled check just surfaces as the same alert() the rest of
  // this function already uses for errors.
  var confirmation = await confirmWithBiometrics(state.currentAdmin, adminName(state.currentAdmin));
  if (!confirmation.ok) {
    setBusy(false);
    alert('Could not accept transfer: ' + confirmation.message);
    return;
  }
  try {
    await runTransaction(db, async function (tx) {
      var reqRef = doc(db, 'groups', gid, 'transferRequests', String(m));
      var reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists()) return;
      var req = reqSnap.data();
      if (req.requestedBy === state.currentAdmin) return; // only the other admin may accept
      var monthRef = doc(db, 'groups', gid, 'months', String(m));
      var monthSnap = await tx.get(monthRef);
      var curNet = (monthSnap.data() && monthSnap.data().transferNet) || 0;
      var delta = req.direction === 'AtoB' ? req.amount : -req.amount;
      tx.update(monthRef, { transferNet: curNet + delta });
      tx.delete(reqRef);
    });
  } catch (err) { alert('Could not accept transfer: ' + err.message); }
  finally { setBusy(false); }
}

export function declineTransferRequest() {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var req = transferReqCache.get(monthKey(gid, m));
  if (!req || req.requestedBy === state.currentAdmin) return;
  setBusy(true);
  deleteDoc(doc(db, 'groups', gid, 'transferRequests', String(m)))
    .catch(function (err) { alert(err.message); }).finally(function () { setBusy(false); });
}

export function cancelTransferRequest() {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var req = transferReqCache.get(monthKey(gid, m));
  if (!req || req.requestedBy !== state.currentAdmin) return;
  setBusy(true);
  deleteDoc(doc(db, 'groups', gid, 'transferRequests', String(m)))
    .catch(function (err) { alert(err.message); }).finally(function () { setBusy(false); });
}
