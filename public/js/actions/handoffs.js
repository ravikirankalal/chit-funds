import {
  doc, addDoc, collection, serverTimestamp, deleteDoc, runTransaction, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../firebase.js';
import { state, groupsById, paymentsCache, handoffReqCache, monthKey } from '../store.js';
import { isSuper, otherAdmin } from '../helpers.js';
import { render } from '../render.js';
import { setBusy, isPendingHandoff } from './shared.js';

// Proposes handing the selected already-collected payments off to the
// other admin — it no longer moves them immediately. A handoffRequests doc
// is created instead (see renderHandoffRequests in views/monthDetail/handoffRequests.js); the
// amount stays counted with the sender (collectedBy is untouched) until
// the other admin accepts via acceptHandoffRequest below, or the sender
// cancels / the other admin declines.
export async function confirmTransfer() {
  var sel = state.ui.transferSelection;
  if (!sel || !sel.mids.length) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  var payments = paymentsCache.get(monthKey(gid, m)) || {};
  var mids = sel.mids.filter(function (mid) {
    var p = payments[mid];
    return p && p.paid && p.collectedBy === state.currentAdmin && !isPendingHandoff(gid, m, mid);
  });
  if (!mids.length) { state.ui.transferSelection = null; render(); return; }
  setBusy(true);
  try {
    var target = otherAdmin(state.currentAdmin);
    await addDoc(collection(db, 'groups', gid, 'months', String(m), 'handoffRequests'), {
      mids: mids, from: state.currentAdmin, to: target, amount: mids.length * group.monthlyDeposit,
      requestedBy: state.currentAdmin, createdAt: serverTimestamp()
    });
    state.ui.transferSelection = null;
  } catch (err) {
    alert('Could not request transfer: ' + err.message);
  } finally { setBusy(false); }
}

export async function acceptHandoffRequest(reqId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  setBusy(true);
  try {
    await runTransaction(db, async function (tx) {
      var reqRef = doc(db, 'groups', gid, 'months', String(m), 'handoffRequests', reqId);
      var reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists()) return;
      var req = reqSnap.data();
      if (req.to !== state.currentAdmin) return; // only the recipient may accept

      // Firestore transactions require every read before any write.
      var paymentRefs = req.mids.map(function (mid) { return doc(db, 'groups', gid, 'months', String(m), 'payments', mid); });
      var paymentSnaps = [];
      for (var i = 0; i < paymentRefs.length; i++) paymentSnaps.push(await tx.get(paymentRefs[i]));

      var now = Timestamp.now();
      paymentSnaps.forEach(function (snap, i) {
        if (!snap.exists()) return; // marked unpaid since the request was made — nothing to hand off anymore
        var data = snap.data();
        if (data.collectedBy !== req.from) return; // no longer held by the sender — skip it
        var priorLog = data.transferLog || [];
        var updatedLog = priorLog.concat([{ from: req.from, to: req.to, at: now }]);
        tx.update(paymentRefs[i], { collectedBy: req.to, transferred: true, transferredAt: serverTimestamp(), transferLog: updatedLog });
      });
      tx.delete(reqRef);
    });
  } catch (err) { alert('Could not accept transfer: ' + err.message); }
  finally { setBusy(false); }
}

export function declineHandoffRequest(reqId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var req = (handoffReqCache.get(monthKey(gid, m)) || {})[reqId];
  if (!req || req.to !== state.currentAdmin) return;
  setBusy(true);
  deleteDoc(doc(db, 'groups', gid, 'months', String(m), 'handoffRequests', reqId))
    .catch(function (err) { alert(err.message); }).finally(function () { setBusy(false); });
}

export function cancelHandoffRequest(reqId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var req = (handoffReqCache.get(monthKey(gid, m)) || {})[reqId];
  if (!req || req.requestedBy !== state.currentAdmin) return;
  setBusy(true);
  deleteDoc(doc(db, 'groups', gid, 'months', String(m), 'handoffRequests', reqId))
    .catch(function (err) { alert(err.message); }).finally(function () { setBusy(false); });
}
