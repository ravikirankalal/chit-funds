import { doc, collection, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../firebase.js';
import { state, membersById } from '../store.js';
import { isSuper, stepPayoutSchedule } from '../helpers.js';
import { goTo, pushNav } from '../router.js';
import { render } from '../render.js';
import { setBusy } from './shared.js';

export function startCreateGroup() {
  if (isSuper()) return;
  var durationMonths = 24, payoutStart = 75000;
  state.ui.newGroup = {
    step: 1,
    name: '', durationMonths: durationMonths, totalMembers: durationMonths, monthlyDeposit: 5000,
    payoutStart: payoutStart,
    payoutSchedule: stepPayoutSchedule(payoutStart, durationMonths),
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
      status: 'open', winners: [], transferNet: 0, closedAt: null, closedLabel: null
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
