// Every function here either mutates `state` and re-renders, or writes to
// Firestore (Firestore writes flow back into the UI via the listeners in
// listeners.js, not by mutating local caches directly here). "Back"-style
// actions (closing an overlay, cancelling a form) call history.back()
// instead of touching state — see router.js for why.

import {
  doc, setDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp,
  runTransaction, writeBatch, arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase.js';
import { state, groupsById, membersById, monthsCache, paymentsCache, transferReqCache, monthKey } from './store.js';
import { isSuper, monthLabel, flatPayoutSchedule } from './helpers.js';
import { monthFinances } from './finance.js';
import { goTo, pushNav } from './router.js';
import { render } from './render.js';

export function setBusy(v) { state.busy = v; render(); }

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
      status: 'open', winnerId: null, payoutAdmin: null, transferNet: 0, closedAt: null, closedLabel: null
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
    state.ui.memberForm = null;
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

export function openMonth(gid, m) { goTo('monthDetail', { activeGroupId: gid, viewMonth: m }); }

export function openPaymentModal(memberId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  if (m !== group.currentMonth) return;
  var existing = (paymentsCache.get(monthKey(gid, m)) || {})[memberId];
  state.ui.paymentModal = { memberId: memberId, mode: (existing && existing.mode) || 'cash', isEditing: !!(existing && existing.paid) };
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
  setBusy(true);
  try {
    var ref = doc(db, 'groups', gid, 'months', String(m), 'payments', pm.memberId);
    var existing = (paymentsCache.get(monthKey(gid, m)) || {})[pm.memberId];
    await setDoc(ref, {
      paid: true, collectedBy: state.currentAdmin, mode: pm.mode,
      paidAt: (existing && existing.paidAt) || serverTimestamp()
    });
    state.ui.paymentModal = null;
  } catch (err) {
    alert('Could not save payment: ' + err.message);
  } finally { setBusy(false); }
}

export async function markUnpaidFromModal() {
  if (isSuper()) return;
  var pm = state.ui.paymentModal;
  if (!pm) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  setBusy(true);
  try {
    await deleteDoc(doc(db, 'groups', gid, 'months', String(m), 'payments', pm.memberId));
    state.ui.paymentModal = null;
  } catch (err) {
    alert('Could not update payment: ' + err.message);
  } finally { setBusy(false); }
}

export function openWinnerPicker() {
  if (isSuper()) return;
  var group = groupsById.get(state.activeGroupId);
  if (state.viewMonth !== group.currentMonth) return;
  state.ui.showWinnerPicker = true; render();
  pushNav();
}
export function closeWinnerPicker() { history.back(); }

export async function selectWinner(memberId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  setBusy(true);
  try {
    await updateDoc(doc(db, 'groups', gid, 'months', String(m)), { winnerId: memberId });
    state.ui.showWinnerPicker = false;
  } catch (err) { alert('Could not set winner: ' + err.message); }
  finally { setBusy(false); }
}

export function setPayoutAdminChoice(id) { state.ui.payoutAdminChoice = id; render(); }

export async function closeMonthAction() {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var monthDoc = monthsCache.get(monthKey(gid, m));
  if (!monthDoc || !monthDoc.winnerId) return;
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
        status: 'closed', payoutAdmin: state.ui.payoutAdminChoice,
        closedAt: serverTimestamp(), closedLabel: closedLabel
      });
      if (hasNext) {
        if (!nextSnap.exists()) {
          tx.set(nextRef, { status: 'open', winnerId: null, payoutAdmin: null, transferNet: 0, closedAt: null, closedLabel: null });
        }
        tx.update(groupRef, { currentMonth: nextMonth });
      } else {
        tx.update(groupRef, { status: 'completed' });
      }
    });
    state.ui.payoutAdminChoice = 'A';
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
