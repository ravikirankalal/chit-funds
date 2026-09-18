import {
  doc, addDoc, collection, serverTimestamp, deleteDoc, runTransaction, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../firebase.js';
import { state, groupsById, paymentsCache, handoffReqCache, monthKey } from '../store.js';
import { isSuper, otherAdmin, adminName } from '../helpers.js';
import { render } from '../render.js';
import { confirmWithBiometrics } from '../webauthn.js';
import { setBusy, isPendingHandoff } from './shared.js';

// Scopes an accept/decline/cancel's loading + error state to the one
// pending card it's acting on (see renderHandoffRequests in
// views/monthDetail/handoffRequests.js) instead of the app-wide busy
// overlay — with several requests pending at once, blanking the whole
// screen for one of them read as though all of them had frozen. Still
// single-flight (only one handoffAction at a time, same as setBusy(true)
// was), just rendered on the specific card instead of over everything.
function setHandoffAction(v) { state.ui.handoffAction = v; render(); }

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
  setHandoffAction({ reqId: reqId, action: 'accept', phase: 'verifying', error: null });
  // Same biometric gate as acceptTransferRequest (adminTransfers.js) and
  // savePaymentModal — accepting a hand-off moves already-collected money
  // from one admin's holdings to the other's, same as those.
  var confirmation = await confirmWithBiometrics(state.currentAdmin, adminName(state.currentAdmin));
  if (!confirmation.ok) {
    setHandoffAction({ reqId: reqId, action: 'accept', phase: null, error: confirmation.message });
    return;
  }
  setHandoffAction({ reqId: reqId, action: 'accept', phase: 'working', error: null });
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
    setHandoffAction(null); // the request doc's own delete will also remove this card once the listener catches up
  } catch (err) { setHandoffAction({ reqId: reqId, action: 'accept', phase: null, error: err.message }); }
}

export async function declineHandoffRequest(reqId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var req = (handoffReqCache.get(monthKey(gid, m)) || {})[reqId];
  if (!req || req.to !== state.currentAdmin) return;
  setHandoffAction({ reqId: reqId, action: 'decline', phase: 'verifying', error: null });
  // No money moves on a decline — this confirms identity, not a
  // transaction. But it's still the recipient making a real, one-way call
  // on someone else's money (the sender has to re-request from scratch),
  // so it gets the same biometric gate as accept rather than the free
  // pass cancel gets on the sender's own, easily-redone request.
  var confirmation = await confirmWithBiometrics(state.currentAdmin, adminName(state.currentAdmin));
  if (!confirmation.ok) {
    setHandoffAction({ reqId: reqId, action: 'decline', phase: null, error: confirmation.message });
    return;
  }
  setHandoffAction({ reqId: reqId, action: 'decline', phase: 'working', error: null });
  deleteDoc(doc(db, 'groups', gid, 'months', String(m), 'handoffRequests', reqId))
    .then(function () { setHandoffAction(null); })
    .catch(function (err) { setHandoffAction({ reqId: reqId, action: 'decline', phase: null, error: err.message }); });
}

export function cancelHandoffRequest(reqId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var req = (handoffReqCache.get(monthKey(gid, m)) || {})[reqId];
  if (!req || req.requestedBy !== state.currentAdmin) return;
  setHandoffAction({ reqId: reqId, action: 'cancel', phase: 'working', error: null });
  deleteDoc(doc(db, 'groups', gid, 'months', String(m), 'handoffRequests', reqId))
    .then(function () { setHandoffAction(null); })
    .catch(function (err) { setHandoffAction({ reqId: reqId, action: 'cancel', phase: null, error: err.message }); });
}
