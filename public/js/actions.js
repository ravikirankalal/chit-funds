// Every function here either mutates `state` and re-renders, or writes to
// Firestore (Firestore writes flow back into the UI via the listeners in
// listeners.js, not by mutating local caches directly here). "Back"-style
// actions (closing an overlay, cancelling a form) call history.back()
// instead of touching state — see router.js for why.

import {
  doc, setDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, Timestamp,
  runTransaction, writeBatch, arrayUnion, arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase.js';
import { state, groupsById, membersById, monthsCache, paymentsCache, transferReqCache, monthKey } from './store.js';
import { isSuper, monthLabel, flatPayoutSchedule, otherAdmin } from './helpers.js';
import { monthFinances, memberHasPaidInGroup, getMonthWinners } from './finance.js';
import { goTo, pushNav } from './router.js';
import { render, setBusyOverlay } from './render.js';

// Going busy just shows a spinner over whatever's already on screen — see
// setBusyOverlay() in render.js for why that's a targeted DOM toggle rather
// than a full render() (a full render re-creates any open sheet/overlay,
// restarting its entrance animation — visible as a flash right as the
// payment drawer, member form, etc. is about to close). Coming back off
// busy DOES need the full render(): that's the point where the action's
// own state changes (a saved payment, a closed overlay) actually need to
// reach the screen, and there's no longer an open overlay for it to
// disrupt by then.
export function setBusy(v) {
  state.busy = v;
  if (v) setBusyOverlay(true);
  else render();
}

export function startCreateGroup() {
  if (isSuper()) return;
  var durationMonths = 24, payoutStart = 75000;
  state.ui.newGroup = {
    step: 1,
    name: '', durationMonths: durationMonths, totalMembers: durationMonths, monthlyDeposit: 5000,
    payoutStart: payoutStart,
    payoutSchedule: flatPayoutSchedule(payoutStart, durationMonths),
    members: [], draftMemberName: ''
  };
  goTo('createGroup');
}

export function createGroupStep2() {
  var g = state.ui.newGroup;
  if (!g.name.trim()) return;
  g.step = 2;
  render();
  pushNav();
}

// Draft members during group creation carry {id, name}: id is set when
// picking someone already in the directory (addExistingDraftMember) and
// null for a brand-new person, who gets their own `members` doc at
// submit time (submitCreateGroup).
export function addDraftMember() {
  var g = state.ui.newGroup;
  var name = (g.draftMemberName || '').trim();
  if (!name) return;
  g.members.push({ id: null, name: name });
  g.draftMemberName = '';
  render();
}

export function addExistingDraftMember(memberId) {
  var g = state.ui.newGroup;
  if (g.members.some(function (m) { return m.id === memberId; })) return;
  var top = membersById.get(memberId);
  if (!top) return;
  g.members.push({ id: memberId, name: top.name });
  render();
}

export function removeDraftMember(idx) {
  state.ui.newGroup.members.splice(idx, 1);
  render();
}

export async function submitCreateGroup() {
  var g = state.ui.newGroup;
  if (!g.members.length) return;
  setBusy(true);
  try {
    var batch = writeBatch(db);
    var memberIds = g.members.map(function (m) {
      if (m.id) return m.id;
      var newMemberRef = doc(collection(db, 'members'));
      batch.set(newMemberRef, { name: m.name.trim(), createdAt: serverTimestamp() });
      return newMemberRef.id;
    });
    var now = new Date();
    var groupRef = doc(collection(db, 'groups'));
    batch.set(groupRef, {
      name: g.name.trim(),
      durationMonths: g.durationMonths,
      monthlyDeposit: g.monthlyDeposit,
      payoutSchedule: g.payoutSchedule,
      memberIds: memberIds,
      currentMonth: 1,
      status: 'active',
      startYear: now.getFullYear(),
      startMonthIndex: now.getMonth(),
      createdBy: state.currentAdmin,
      createdAt: serverTimestamp()
    });
    batch.set(doc(db, 'groups', groupRef.id, 'months', '1'), {
      status: 'open', winners: [], payoutAdmin: null, transferNet: 0, closedAt: null, closedLabel: null
    });
    await batch.commit();
    state.ui.newGroup = null;
    goTo('monthDetail', { activeGroupId: groupRef.id, viewMonth: 1 });
  } catch (err) {
    alert('Could not create group: ' + err.message);
  } finally {
    setBusy(false);
  }
}

// The shared member directory + adding an existing person to another
// group — both independent of any single group's creation flow.
export function openMemberForm(id) {
  if (isSuper()) return;
  var existing = id ? membersById.get(id) : null;
  state.ui.memberForm = { id: id || null, name: existing ? existing.name : '' };
  render();
  pushNav();
}
export function closeMemberForm() { history.back(); }

export async function saveMemberForm() {
  if (isSuper()) return;
  var mf = state.ui.memberForm;
  if (!mf) return;
  var name = (mf.name || '').trim();
  if (!name) return;
  setBusy(true);
  try {
    if (mf.id) await updateDoc(doc(db, 'members', mf.id), { name: name });
    else await addDoc(collection(db, 'members'), { name: name, createdAt: serverTimestamp() });
    // openMemberForm() pushed a nav entry for this overlay; pop it via
    // history.back(), same as closeMemberForm() — see router.js's popstate
    // handler for why this no longer causes a render flash (it skips the
    // redundant re-render when the popped snapshot already matches the
    // state we just set synchronously below).
    state.ui.memberForm = null;
    history.back();
  } catch (err) {
    alert('Could not save member: ' + err.message);
  } finally { setBusy(false); }
}

export function openAddMemberToGroup(gid) {
  if (isSuper()) return;
  state.ui.addMemberToGroup = { gid: gid, draftName: '' };
  render();
  pushNav();
}
export function closeAddMemberToGroup() { history.back(); }

export async function addExistingMemberToGroup(gid, memberId) {
  if (isSuper()) return;
  setBusy(true);
  try {
    await updateDoc(doc(db, 'groups', gid), { memberIds: arrayUnion(memberId) });
  } catch (err) {
    alert('Could not add member: ' + err.message);
  } finally { setBusy(false); }
}

export async function createAndAddMemberToGroup(gid) {
  if (isSuper()) return;
  var amg = state.ui.addMemberToGroup;
  if (!amg) return;
  var name = (amg.draftName || '').trim();
  if (!name) return;
  setBusy(true);
  try {
    var batch = writeBatch(db);
    var newMemberRef = doc(collection(db, 'members'));
    batch.set(newMemberRef, { name: name, createdAt: serverTimestamp() });
    batch.update(doc(db, 'groups', gid), { memberIds: arrayUnion(newMemberRef.id) });
    await batch.commit();
    amg.draftName = '';
  } catch (err) {
    alert('Could not add member: ' + err.message);
  } finally { setBusy(false); }
}

export function openGroupDetail(gid) { goTo('groupDetail', { activeGroupId: gid }); }

export function openGroupMembers(gid) { goTo('groupMembers', { activeGroupId: gid }); }

export function openMemberPayments(gid, mid) { goTo('memberPayments', { activeGroupId: gid, viewMemberId: mid }); }

export async function removeMemberFromGroup(gid, mid) {
  if (isSuper()) return;
  var group = groupsById.get(gid);
  if (!group) return;
  if (memberHasPaidInGroup(gid, group, mid)) return;
  setBusy(true);
  try {
    await updateDoc(doc(db, 'groups', gid), { memberIds: arrayRemove(mid) });
  } catch (err) {
    alert('Could not remove member: ' + err.message);
  } finally { setBusy(false); }
}

export function openMonth(gid, m) { goTo('monthDetail', { activeGroupId: gid, viewMonth: m }); }

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

export function selectPaymentTab(key) {
  state.ui.paymentTab = key;
  render();
}

export function setLedgerFilter(type) {
  state.ui.ledgerFilter = type;
  render();
}

export async function savePaymentModal() {
  if (isSuper()) return;
  var pm = state.ui.paymentModal;
  if (!pm) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var existing = (paymentsCache.get(monthKey(gid, m)) || {})[pm.memberId];
  // Only the collector currently holding the amount may change its mode,
  // and only before it's been handed off to the other admin.
  if (existing && existing.paid && (existing.collectedBy !== state.currentAdmin || existing.transferred)) return;
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
  // Only whoever currently holds the amount can undo the payment.
  if (existing && existing.collectedBy !== state.currentAdmin) return;
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
// renderTransferBar in monthDetail.js. A long press starts the selection
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

export async function confirmTransfer() {
  var sel = state.ui.transferSelection;
  if (!sel || !sel.mids.length) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var payments = paymentsCache.get(monthKey(gid, m)) || {};
  var mids = sel.mids.filter(function (mid) {
    var p = payments[mid];
    return p && p.paid && p.collectedBy === state.currentAdmin;
  });
  if (!mids.length) { state.ui.transferSelection = null; render(); return; }
  setBusy(true);
  try {
    var target = otherAdmin(state.currentAdmin);
    var now = Timestamp.now();
    var batch = writeBatch(db);
    mids.forEach(function (mid) {
      // A payment can be handed off more than once (A->B, later B->A again),
      // and collectedBy/transferredAt only ever reflect the CURRENT holder —
      // so each hop is also appended to transferLog, the one field that
      // keeps every hop instead of being overwritten. serverTimestamp()
      // can't be used inside an array element, hence the client `now`
      // shared across this whole batch.
      var priorLog = (payments[mid] && payments[mid].transferLog) || [];
      var updatedLog = priorLog.concat([{ from: state.currentAdmin, to: target, at: now }]);
      batch.update(doc(db, 'groups', gid, 'months', String(m), 'payments', mid), {
        collectedBy: target, transferred: true, transferredAt: serverTimestamp(), transferLog: updatedLog
      });
    });
    await batch.commit();
    state.ui.transferSelection = null;
  } catch (err) {
    alert('Could not transfer payments: ' + err.message);
  } finally { setBusy(false); }
}

export function openWinnerPicker() {
  if (isSuper()) return;
  var group = groupsById.get(state.activeGroupId);
  if (state.viewMonth > group.currentMonth) return; // any current-or-past month is fair game, just not a not-yet-open one
  state.ui.showWinnerPicker = true; render();
  pushNav();
}
export function closeWinnerPicker() { history.back(); }

// Almost every month has exactly one winner, but admins occasionally pay
// out to more than one member within the same month (most often when
// group.durationMonths < members.length) — so winners are a list, appended
// to rather than replaced. See getMonthWinners in finance.js.
export async function addWinner(memberId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  var monthDoc = monthsCache.get(monthKey(gid, m));
  var scheduled = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
  var current = getMonthWinners(monthDoc, scheduled);
  if (current.some(function (w) { return w.memberId === memberId; })) { state.ui.showWinnerPicker = false; render(); history.back(); return; }
  setBusy(true);
  try {
    await updateDoc(doc(db, 'groups', gid, 'months', String(m)), { winners: current.concat([{ memberId: memberId, payoutAmount: scheduled }]) });
    state.ui.showWinnerPicker = false;
    history.back(); // see savePaymentModal() above
  } catch (err) { alert('Could not add winner: ' + err.message); }
  finally { setBusy(false); }
}

export async function removeWinner(memberId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  var monthDoc = monthsCache.get(monthKey(gid, m));
  if (monthDoc && monthDoc.status === 'closed') return;
  var scheduled = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
  var current = getMonthWinners(monthDoc, scheduled);
  var updated = current.filter(function (w) { return w.memberId !== memberId; });
  if (updated.length === current.length) return;
  setBusy(true);
  updateDoc(doc(db, 'groups', gid, 'months', String(m)), { winners: updated })
    .catch(function (err) { alert('Could not remove winner: ' + err.message); })
    .finally(function () { setBusy(false); });
}

export function setWinnerAmount(memberId, amount) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  var monthDoc = monthsCache.get(monthKey(gid, m));
  var scheduled = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
  var current = getMonthWinners(monthDoc, scheduled);
  var updated = current.map(function (w) { return w.memberId === memberId ? { memberId: memberId, payoutAmount: amount } : w; });
  setBusy(true);
  updateDoc(doc(db, 'groups', gid, 'months', String(m)), { winners: updated })
    .catch(function (err) { alert('Could not update payout amount: ' + err.message); })
    .finally(function () { setBusy(false); });
}

export async function closeMonthAction() {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  var monthDoc = monthsCache.get(monthKey(gid, m));
  var scheduled = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
  if (!monthDoc || !getMonthWinners(monthDoc, scheduled).length) return;
  if (transferReqCache.get(monthKey(gid, m))) {
    alert('There is a pending transfer request for this month — accept, decline, or cancel it before closing.');
    return;
  }
  setBusy(true);
  try {
    await runTransaction(db, async function (tx) {
      // Firestore transactions require every read before any write, so both
      // gets happen up front, then all the update/set calls follow.
      var groupRef = doc(db, 'groups', gid);
      var groupSnap = await tx.get(groupRef);
      var gData = groupSnap.data();
      var nextMonth = m + 1;
      var hasNext = nextMonth <= gData.durationMonths;
      var nextRef = hasNext ? doc(db, 'groups', gid, 'months', String(nextMonth)) : null;
      var nextSnap = hasNext ? await tx.get(nextRef) : null;

      var closedLabel = monthLabel(gData.startYear, gData.startMonthIndex, m);
      tx.update(doc(db, 'groups', gid, 'months', String(m)), {
        status: 'closed', payoutAdmin: state.currentAdmin,
        closedAt: serverTimestamp(), closedLabel: closedLabel
      });
      if (hasNext) {
        if (!nextSnap.exists()) {
          tx.set(nextRef, { status: 'open', winners: [], payoutAdmin: null, transferNet: 0, closedAt: null, closedLabel: null });
        }
        tx.update(groupRef, { currentMonth: nextMonth });
      } else {
        tx.update(groupRef, { status: 'completed' });
      }
    });
    var updatedGroup = groupsById.get(gid);
    goTo('groupDetail', { activeGroupId: gid, viewMonth: updatedGroup ? updatedGroup.currentMonth : m });
  } catch (err) {
    alert('Could not close month: ' + err.message);
  } finally { setBusy(false); }
}

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
