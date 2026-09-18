import {
  doc, addDoc, collection, serverTimestamp, deleteDoc, runTransaction, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../firebase.js';
import { state, groupsById, paymentsCache, handoffReqCache, monthKey } from '../store.js';
import { isSuper, otherAdmin, adminName } from '../helpers.js';
import { render } from '../render.js';
import { confirmWithBiometrics } from '../webauthn.js';
import { setBusy, isPendingHandoff, delay } from './shared.js';

// How long the accept success card stays up before closing itself — kept
// in sync with the countdown-bar CSS animation's own 10s duration
// (overlays.css) so the visible "how much longer" bar and the actual
// auto-close line up.
var HANDOFF_SUCCESS_AUTOCLOSE_MS = 10000;

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
  // Grabbed up front purely to fail fast on a stale/foreign reqId before
  // even prompting for biometrics — once the transaction below commits,
  // this cache entry is gone too (the doc it's read from gets deleted).
  var req = (handoffReqCache.get(monthKey(gid, m)) || {})[reqId];
  if (!req || req.to !== state.currentAdmin) return;
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
    // Returns the amount actually moved rather than the amount originally
    // requested — a payment can drop out between the request and the
    // accept (marked unpaid again, or already re-transferred elsewhere;
    // see the per-payment skip below), so req.amount can overstate what
    // this accept really did. The success card (below) needs the true
    // figure, not the ask.
    var movedAmount = await runTransaction(db, async function (tx) {
      var reqRef = doc(db, 'groups', gid, 'months', String(m), 'handoffRequests', reqId);
      var reqSnap = await tx.get(reqRef);
      if (!reqSnap.exists()) return 0;
      var req = reqSnap.data();
      if (req.to !== state.currentAdmin) return 0; // only the recipient may accept

      // Firestore transactions require every read before any write.
      var paymentRefs = req.mids.map(function (mid) { return doc(db, 'groups', gid, 'months', String(m), 'payments', mid); });
      var paymentSnaps = [];
      for (var i = 0; i < paymentRefs.length; i++) paymentSnaps.push(await tx.get(paymentRefs[i]));

      var perAmount = req.mids.length ? req.amount / req.mids.length : 0;
      var moved = 0;
      var now = Timestamp.now();
      paymentSnaps.forEach(function (snap, i) {
        if (!snap.exists()) return; // marked unpaid since the request was made — nothing to hand off anymore
        var data = snap.data();
        if (data.collectedBy !== req.from) return; // no longer held by the sender — skip it
        var priorLog = data.transferLog || [];
        var updatedLog = priorLog.concat([{ from: req.from, to: req.to, at: now }]);
        tx.update(paymentRefs[i], { collectedBy: req.to, transferred: true, transferredAt: serverTimestamp(), transferLog: updatedLog });
        moved += perAmount;
      });
      tx.delete(reqRef);
      return moved;
    });
    // The request doc's own delete removes the pending card once the
    // listener catches up, but that would otherwise leave no confirmation
    // at all that the accept actually did anything — this holds a
    // separate success card up (rendered straight from handoffAction,
    // independent of the now-gone request doc; see renderHandoffRequests)
    // for HANDOFF_SUCCESS_AUTOCLOSE_MS, or until the admin dismisses it
    // early via dismissHandoffAction ("Done") below.
    setHandoffAction({ reqId: reqId, action: 'accept', phase: 'success', amount: movedAmount, error: null });
    // Fire-and-forget, not awaited — this function is done once the
    // success card is showing; the close-out just happens later on its
    // own. Guarded so a stale timer (say, "Done" was already tapped, or
    // another accept started in the meantime) can't clobber whatever's
    // actually showing by the time it fires.
    delay(HANDOFF_SUCCESS_AUTOCLOSE_MS).then(function () {
      var current = state.ui.handoffAction;
      if (current && current.reqId === reqId && current.action === 'accept' && current.phase === 'success') {
        setHandoffAction(null);
      }
    });
  } catch (err) { setHandoffAction({ reqId: reqId, action: 'accept', phase: null, error: err.message }); }
}

export function dismissHandoffAction() { setHandoffAction(null); }

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
