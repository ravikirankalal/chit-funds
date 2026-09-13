// Chit Funds — vanilla JS + Firebase (Auth + Firestore). No build step, no framework.
import { firebaseConfig, ADMINS, SUPER_ADMIN, USE_EMULATORS } from './firebase-config.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut,
  connectAuthEmulator
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  initializeFirestore, doc, setDoc, updateDoc, deleteDoc, onSnapshot,
  collection, collectionGroup, addDoc, serverTimestamp, runTransaction,
  writeBatch, connectFirestoreEmulator
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// experimentalAutoDetectLongPolling: some networks/sandboxes don't support the
// streaming WebChannel connection Firestore prefers; this transparently falls
// back to long-polling when it detects that, with no effect where streaming
// works fine — the recommended setting for broad compatibility.
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
if (USE_EMULATORS) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const PALETTE = ['#146b52','#8a5a2b','#3b5f8a','#8a3b5a','#5a5a8a','#3b7a7a','#7a6b3b','#6b3b7a'];

// ---------------------------------------------------------------------------
// small pure helpers
// ---------------------------------------------------------------------------

function fmt(n) { return '₹' + Math.round(n || 0).toLocaleString('en-IN'); }
function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function initialsOf(name) {
  var p = String(name || '').trim().split(/\s+/);
  return ((p[0] ? p[0][0] : '') + (p[1] ? p[1][0] : '')).toUpperCase() || '?';
}
function colorFor(idx) { return PALETTE[((idx % PALETTE.length) + PALETTE.length) % PALETTE.length]; }
function adminName(id) { return id === 'B' ? ADMINS.B.name : (id === 'SUPER' ? SUPER_ADMIN.name : ADMINS.A.name); }
function adminAvatarColor(id) { return id === 'B' ? colorFor(1) : (id === 'SUPER' ? '#3b3a36' : colorFor(0)); }
function otherAdmin(id) { return id === 'A' ? 'B' : 'A'; }
function isSuper() { return state.currentAdmin === 'SUPER'; }
function monthLabel(startYear, startMonthIndex, monthNum) {
  var total = startMonthIndex + (monthNum - 1);
  var year = startYear + Math.floor(total / 12);
  var idx = ((total % 12) + 12) % 12;
  return MONTH_NAMES[idx] + ' ' + year;
}
// splits a Firestore doc path into named parts we care about
function pathParts(path) { return path.split('/'); }

// ---------------------------------------------------------------------------
// in-memory caches, kept live by Firestore listeners
// ---------------------------------------------------------------------------

var groupsById = new Map();               // gid -> group data (incl. id)
var membersByGroup = new Map();            // gid -> [{id,name,order}] sorted
var monthsCache = new Map();               // "gid|m" -> month data
var paymentsCache = new Map();             // "gid|m" -> { memberId: paymentData }
var transferReqCache = new Map();          // "gid|m" -> request data

function monthKey(gid, m) { return gid + '|' + m; }

// ---------------------------------------------------------------------------
// app state (UI + derived)
// ---------------------------------------------------------------------------

var state = {
  screen: 'loading',      // loading | login | dashboard | groupDetail | createGroup | monthDetail | ledger
  authError: null,
  currentAdmin: null,     // 'A' | 'B'
  activeGroupId: null,
  viewMonth: null,
  balances: { A: 0, B: 0, total: 0 },
  ledgerEntries: [],
  pendingApprovals: [],   // [{groupId, groupName, month, direction, amount, requestedBy}]
  busy: false,
  ui: {
    showWinnerPicker: false,
    paymentModal: null,   // { memberId, mode, isEditing }
    payoutAdminChoice: 'A',
    newGroup: null        // set when entering createGroup screen
  }
};

function goTo(screen, extra) {
  state.screen = screen;
  state.ui.showWinnerPicker = false;
  state.ui.paymentModal = null;
  if (extra) Object.assign(state, extra);
  render();
}

// ---------------------------------------------------------------------------
// finance math — mirrors the same logic everywhere a month's money is derived
// ---------------------------------------------------------------------------

function monthFinances(gid, group, monthNum) {
  var monthDoc = monthsCache.get(monthKey(gid, monthNum)) || null;
  var payments = paymentsCache.get(monthKey(gid, monthNum)) || {};
  var members = membersByGroup.get(gid) || [];
  var paidCount = 0, rawA = 0, rawB = 0;
  members.forEach(function (mem) {
    var p = payments[mem.id];
    if (p && p.paid) {
      paidCount++;
      if (p.collectedBy === 'A') rawA += group.monthlyDeposit; else rawB += group.monthlyDeposit;
    }
  });
  var net = (monthDoc && monthDoc.transferNet) || 0;
  var adjA = rawA - net, adjB = rawB + net;
  var payoutAmount = (group.payoutSchedule && group.payoutSchedule[monthNum - 1]) || 0;
  var finalA = adjA, finalB = adjB;
  var closed = !!monthDoc && monthDoc.status === 'closed';
  if (closed) {
    if (monthDoc.payoutAdmin === 'A') finalA -= payoutAmount; else if (monthDoc.payoutAdmin === 'B') finalB -= payoutAmount;
  }
  return {
    monthDoc: monthDoc, paidCount: paidCount, totalCollected: paidCount * group.monthlyDeposit,
    rawA: rawA, rawB: rawB, net: net, adjA: adjA, adjB: adjB,
    payoutAmount: payoutAmount, closed: closed, finalA: finalA, finalB: finalB
  };
}

function recompute() {
  var totalA = 0, totalB = 0;
  var ledger = [];
  var approvals = [];

  groupsById.forEach(function (group, gid) {
    for (var m = 1; m <= group.durationMonths; m++) {
      var hasData = monthsCache.has(monthKey(gid, m)) || (paymentsCache.get(monthKey(gid, m)) && Object.keys(paymentsCache.get(monthKey(gid, m))).length);
      if (!hasData) continue;
      var f = monthFinances(gid, group, m);
      totalA += f.finalA; totalB += f.finalB;

      if (f.closed) {
        var winner = (membersByGroup.get(gid) || []).find(function (mm) { return mm.id === f.monthDoc.winnerId; });
        ledger.push({
          group: group.name, type: 'payout',
          title: 'Payout — ' + group.name + ' Month ' + m,
          subtitle: 'Paid to ' + (winner ? winner.name : '—') + ' by ' + adminName(f.monthDoc.payoutAdmin) + ' · ' + (f.monthDoc.closedLabel || ''),
          amountFormatted: '−' + fmt(f.payoutAmount), amountColor: '#1c1b19'
        });
        ledger.push({
          group: group.name, type: 'collection',
          title: 'Collection — ' + group.name + ' Month ' + m,
          subtitle: f.paidCount + ' members paid · ' + (f.monthDoc.closedLabel || ''),
          amountFormatted: '+' + fmt(f.totalCollected), amountColor: '#146b52'
        });
      } else if (group.currentMonth === m) {
        ledger.push({
          group: group.name, type: 'collection',
          title: 'Collection — ' + group.name + ' Month ' + m + ' (in progress)',
          subtitle: f.paidCount + ' members paid so far',
          amountFormatted: '+' + fmt(f.totalCollected), amountColor: '#146b52'
        });
      }
      if (f.net) {
        ledger.push({
          group: group.name, type: 'transfer',
          title: 'Transfer — ' + group.name + ' Month ' + m,
          subtitle: (f.net > 0 ? adminName('A') + ' → ' + adminName('B') : adminName('B') + ' → ' + adminName('A')) + ' · accepted',
          amountFormatted: fmt(Math.abs(f.net)), amountColor: '#3b4a8a'
        });
      }

      var req = transferReqCache.get(monthKey(gid, m));
      if (req) {
        approvals.push({ groupId: gid, groupName: group.name, month: m, direction: req.direction, amount: req.amount, requestedBy: req.requestedBy });
      }
    }
  });

  state.balances = { A: totalA, B: totalB, total: totalA + totalB };
  state.ledgerEntries = ledger.reverse();
  state.pendingApprovals = approvals;
  render();
}

var recomputeScheduled = false;
function scheduleRecompute() {
  if (recomputeScheduled) return;
  recomputeScheduled = true;
  setTimeout(function () { recomputeScheduled = false; recompute(); }, 30);
}

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

function findAdminIdByEmail(email) {
  if (!email) return null;
  email = email.toLowerCase();
  if (ADMINS.A.email.toLowerCase() === email) return 'A';
  if (ADMINS.B.email.toLowerCase() === email) return 'B';
  if (SUPER_ADMIN.email.toLowerCase() === email) return 'SUPER';
  return null;
}

function signInGoogle() {
  state.authError = null;
  var provider = new GoogleAuthProvider();
  // popup avoids signInWithRedirect's cross-origin storage handoff between
  // the hosting domain and authDomain, which silently fails to link back in
  // some browsers (consent completes, but the app never sees the user)
  signInWithPopup(auth, provider).catch(function (err) {
    if (err && (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request')) return;
    state.authError = 'Sign-in failed: ' + err.message;
    render();
  });
}

function doLogout() { signOut(auth); }

onAuthStateChanged(auth, function (user) {
  if (!user) {
    stopListeners();
    goTo('login');
    return;
  }
  var adminId = findAdminIdByEmail(user.email);
  if (!adminId) {
    state.authError = 'The Google account "' + user.email + '" is not authorized for this app.';
    signOut(auth);
    return;
  }
  state.currentAdmin = adminId;
  startListeners();
  goTo('dashboard');
});

// ---------------------------------------------------------------------------
// firestore listeners — kept alive for the whole signed-in session
// ---------------------------------------------------------------------------

var unsubs = [];
function startListeners() {
  if (unsubs.length) return;

  unsubs.push(onSnapshot(collection(db, 'groups'), function (snap) {
    snap.docChanges().forEach(function (change) {
      if (change.type === 'removed') { groupsById.delete(change.doc.id); }
      else { groupsById.set(change.doc.id, Object.assign({ id: change.doc.id }, change.doc.data())); }
    });
    scheduleRecompute();
  }));

  unsubs.push(onSnapshot(collectionGroup(db, 'members'), function (snap) {
    snap.docChanges().forEach(function (change) {
      var parts = pathParts(change.doc.ref.path); // groups/GID/members/MID
      var gid = parts[1];
      var list = membersByGroup.get(gid) || [];
      list = list.filter(function (m) { return m.id !== change.doc.id; });
      if (change.type !== 'removed') {
        var d = change.doc.data();
        list.push({ id: change.doc.id, name: d.name, order: d.order || 0 });
      }
      list.sort(function (a, b) { return a.order - b.order; });
      membersByGroup.set(gid, list);
    });
    scheduleRecompute();
  }));

  unsubs.push(onSnapshot(collectionGroup(db, 'months'), function (snap) {
    snap.docChanges().forEach(function (change) {
      var parts = pathParts(change.doc.ref.path); // groups/GID/months/MNUM
      var gid = parts[1], m = parseInt(parts[3], 10);
      if (change.type === 'removed') monthsCache.delete(monthKey(gid, m));
      else monthsCache.set(monthKey(gid, m), change.doc.data());
    });
    scheduleRecompute();
  }));

  unsubs.push(onSnapshot(collectionGroup(db, 'payments'), function (snap) {
    snap.docChanges().forEach(function (change) {
      var parts = pathParts(change.doc.ref.path); // groups/GID/months/MNUM/payments/MID
      var gid = parts[1], m = parseInt(parts[3], 10), mid = parts[5];
      var key = monthKey(gid, m);
      var map = paymentsCache.get(key) || {};
      if (change.type === 'removed') delete map[mid];
      else map[mid] = change.doc.data();
      paymentsCache.set(key, map);
    });
    scheduleRecompute();
  }));

  unsubs.push(onSnapshot(collectionGroup(db, 'transferRequests'), function (snap) {
    snap.docChanges().forEach(function (change) {
      var parts = pathParts(change.doc.ref.path); // groups/GID/transferRequests/MNUM
      var gid = parts[1], m = parseInt(parts[3], 10);
      if (change.type === 'removed') transferReqCache.delete(monthKey(gid, m));
      else transferReqCache.set(monthKey(gid, m), change.doc.data());
    });
    scheduleRecompute();
  }));
}

function stopListeners() {
  unsubs.forEach(function (u) { u(); });
  unsubs = [];
  groupsById.clear(); membersByGroup.clear(); monthsCache.clear(); paymentsCache.clear(); transferReqCache.clear();
}

// ---------------------------------------------------------------------------
// actions (Firestore writes)
// ---------------------------------------------------------------------------

function setBusy(v) { state.busy = v; render(); }

function startCreateGroup() {
  if (isSuper()) return;
  state.ui.newGroup = {
    step: 1,
    name: '', durationMonths: 24, monthlyDeposit: 5000,
    payoutStart: 75000, payoutEnd: 118000,
    members: [], draftMemberName: ''
  };
  goTo('createGroup');
}

function createGroupStep2() {
  var g = state.ui.newGroup;
  if (!g.name.trim()) return;
  g.step = 2;
  render();
}

function addDraftMember() {
  var g = state.ui.newGroup;
  var name = (g.draftMemberName || '').trim();
  if (!name) return;
  g.members.push({ name: name });
  g.draftMemberName = '';
  render();
}
function removeDraftMember(idx) {
  state.ui.newGroup.members.splice(idx, 1);
  render();
}

async function submitCreateGroup() {
  var g = state.ui.newGroup;
  if (!g.members.length) return;
  setBusy(true);
  try {
    var payoutSchedule = [];
    for (var i = 0; i < g.durationMonths; i++) {
      var t = g.durationMonths > 1 ? i / (g.durationMonths - 1) : 0;
      payoutSchedule.push(Math.round(g.payoutStart + (g.payoutEnd - g.payoutStart) * t));
    }
    var now = new Date();
    var groupRef = await addDoc(collection(db, 'groups'), {
      name: g.name.trim(),
      memberCount: g.members.length,
      durationMonths: g.durationMonths,
      monthlyDeposit: g.monthlyDeposit,
      payoutSchedule: payoutSchedule,
      currentMonth: 1,
      status: 'active',
      startYear: now.getFullYear(),
      startMonthIndex: now.getMonth(),
      createdBy: state.currentAdmin,
      createdAt: serverTimestamp()
    });
    var batch = writeBatch(db);
    g.members.forEach(function (m, idx) {
      batch.set(doc(collection(db, 'groups', groupRef.id, 'members')), { name: m.name, order: idx });
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

function openCurrentMonth(gid) {
  var g = groupsById.get(gid);
  goTo('monthDetail', { activeGroupId: gid, viewMonth: g ? g.currentMonth : 1 });
}
function openMonth(gid, m) { goTo('monthDetail', { activeGroupId: gid, viewMonth: m }); }
function openGroupDetail(gid) { goTo('groupDetail', { activeGroupId: gid }); }

function openPaymentModal(memberId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  if (m !== group.currentMonth) return;
  var existing = (paymentsCache.get(monthKey(gid, m)) || {})[memberId];
  state.ui.paymentModal = { memberId: memberId, mode: (existing && existing.mode) || 'cash', isEditing: !!(existing && existing.paid) };
  render();
}
function closePaymentModal() { state.ui.paymentModal = null; render(); }
function setModalMode(mode) { if (!state.ui.paymentModal) return; state.ui.paymentModal.mode = mode; render(); }

async function savePaymentModal() {
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

async function markUnpaidFromModal() {
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

function openWinnerPicker() {
  if (isSuper()) return;
  var group = groupsById.get(state.activeGroupId);
  if (state.viewMonth !== group.currentMonth) return;
  state.ui.showWinnerPicker = true; render();
}
function closeWinnerPicker() { state.ui.showWinnerPicker = false; render(); }

async function selectWinner(memberId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  setBusy(true);
  try {
    await updateDoc(doc(db, 'groups', gid, 'months', String(m)), { winnerId: memberId });
    state.ui.showWinnerPicker = false;
  } catch (err) { alert('Could not set winner: ' + err.message); }
  finally { setBusy(false); }
}

function setPayoutAdminChoice(id) { state.ui.payoutAdminChoice = id; render(); }

async function closeMonthAction() {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
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
function requestTransferToB() { requestTransfer('AtoB'); }
function requestTransferToA() { requestTransfer('BtoA'); }

async function acceptTransferRequest(gidArg, mArg) {
  if (isSuper()) return;
  var gid = gidArg || state.activeGroupId, m = mArg || state.viewMonth;
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
function declineTransferRequest() {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var req = transferReqCache.get(monthKey(gid, m));
  if (!req || req.requestedBy === state.currentAdmin) return;
  setBusy(true);
  deleteDoc(doc(db, 'groups', gid, 'transferRequests', String(m)))
    .catch(function (err) { alert(err.message); }).finally(function () { setBusy(false); });
}
function cancelTransferRequest() {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var req = transferReqCache.get(monthKey(gid, m));
  if (!req || req.requestedBy !== state.currentAdmin) return;
  setBusy(true);
  deleteDoc(doc(db, 'groups', gid, 'transferRequests', String(m)))
    .catch(function (err) { alert(err.message); }).finally(function () { setBusy(false); });
}

// ---------------------------------------------------------------------------
// rendering
// ---------------------------------------------------------------------------

function iconChevronLeft() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function iconChevronRight() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#a39d92" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function iconCheck(color) {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13L9.5 17.5L19 7" stroke="' + (color || '#fff') + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function iconClose() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
}
function iconPlus() {
  return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>';
}
function iconHome(color) {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 11L12 4L20 11V19A1 1 0 0 1 19 20H5A1 1 0 0 1 4 19V11Z" stroke="' + color + '" stroke-width="1.9" stroke-linejoin="round"/></svg>';
}
function iconLedger(color) {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="8" width="16" height="11" rx="1.5" stroke="' + color + '" stroke-width="1.9"/><path d="M8 8V6.5A2.5 2.5 0 0 1 10.5 4H13.5A2.5 2.5 0 0 1 16 6.5V8" stroke="' + color + '" stroke-width="1.9"/></svg>';
}
function iconGoogle() {
  return '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.6H24v9h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1C42.6 37.3 45.1 31.4 45.1 24.5z"/><path fill="#34A853" d="M24 46c6 0 10.9-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C8 41.2 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.6 28.1c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3C2.8 17.2 2 20.5 2 24s.8 6.8 2.3 9.8l7.3-5.7z"/><path fill="#EA4335" d="M24 10.4c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C34.9 3.9 30 2 24 2 15.4 2 8 6.8 4.3 14.2l7.3 5.7c1.8-5.2 6.6-9.5 12.4-9.5z"/></svg>';
}

function renderLogin() {
  return '' +
    '<div class="screen" style="align-items:center; justify-content:center; padding:32px; gap:28px;">' +
      '<div style="display:flex; flex-direction:column; align-items:center; gap:14px;">' +
        '<div style="width:56px;height:56px;border-radius:16px;background:var(--accent);display:flex;align-items:center;justify-content:center;">' +
          '<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6V11C4 15.5 7.4 19.7 12 21C16.6 19.7 20 15.5 20 11V6L12 2Z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12L11 14L15.5 9.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</div>' +
        '<div style="text-align:center;"><div class="mono" style="font-size:22px;font-weight:700;">Chit Funds</div>' +
        '<div style="font-size:13px;color:var(--text-muted);margin-top:2px;">Admin console</div></div>' +
      '</div>' +
      '<button data-action="signin" class="btn btn-primary" style="width:100%; display:flex; align-items:center; justify-content:center; gap:10px;">' + iconGoogle() + ' Sign in with Google</button>' +
      (state.authError ? '<div class="error-text" style="text-align:center;">' + escapeHtml(state.authError) + '</div>' : '') +
      '<div style="font-size:12px;color:var(--text-muted);text-align:center;">Only the two authorized admin Google accounts can access this app</div>' +
    '</div>';
}

function renderDashboard() {
  var groups = Array.from(groupsById.values());
  var approval = !isSuper() && state.pendingApprovals.find(function (a) { return a.requestedBy !== state.currentAdmin; });

  var groupCards = groups.map(function (g) {
    var pct = Math.round((g.currentMonth / g.durationMonths) * 100);
    return '<div class="card" data-action="open-current-month" data-gid="' + g.id + '" style="display:flex;flex-direction:column;gap:10px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
        '<div><div style="font-size:15px;font-weight:600;">' + escapeHtml(g.name) + '</div>' +
        '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">' + g.memberCount + ' members · ' + fmt(g.monthlyDeposit) + ' / month</div></div>' +
        iconChevronRight() +
      '</div>' +
      '<div><div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;"></div></div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:6px;">' +
        '<div style="font-size:12px;color:var(--text-muted);">Month ' + g.currentMonth + ' of ' + g.durationMonths + '</div>' +
        '<div style="font-size:12px;color:var(--accent);font-weight:600;">' + (g.status === 'completed' ? 'Completed' : 'In progress') + '</div>' +
      '</div></div>' +
    '</div>';
  }).join('') || '<div class="card" style="color:var(--text-muted); font-size:13px; text-align:center;">No groups yet — tap + to create one.</div>';

  return '' +
    '<div class="screen">' +
      '<div style="padding:20px 20px 4px; display:flex; align-items:center; justify-content:space-between;">' +
        '<div><div style="font-size:12px;color:var(--text-muted);font-weight:500;">Welcome back, ' + adminName(state.currentAdmin) + '</div>' +
        '<div class="mono" style="font-size:22px;font-weight:700;">Chit Funds</div></div>' +
        '<div data-action="logout" class="avatar" style="cursor:pointer; background:' + adminAvatarColor(state.currentAdmin) + ';">' + initialsOf(adminName(state.currentAdmin)) + '</div>' +
      '</div>' +
      '<div class="content">' +
        (approval ? '<div class="banner warn" data-action="open-month" data-gid="' + approval.groupId + '" data-m="' + approval.month + '">' +
          '<div class="banner-title">Transfer needs your approval</div>' +
          '<div style="font-size:12.5px;">' + adminName(approval.requestedBy) + ' wants to send ' + fmt(approval.amount) + ' · ' +
          (approval.direction === 'AtoB' ? adminName('A') + ' → ' + adminName('B') : adminName('B') + ' → ' + adminName('A')) +
          ' (' + escapeHtml(approval.groupName) + ', Month ' + approval.month + ')</div>' +
          '<div style="font-size:11.5px;color:var(--warning);font-weight:600;">Tap to review →</div></div>' : '') +
        '<div style="background:var(--accent); border-radius:16px; padding:20px; color:#fff;">' +
          '<div style="font-size:12px;opacity:0.85;font-weight:500;">Total fund available</div>' +
          '<div class="mono" style="font-size:30px;font-weight:700;margin-top:4px;">' + fmt(state.balances.total) + '</div>' +
          '<div style="font-size:12px;opacity:0.8;margin-top:2px;">Held across both admins, all groups</div>' +
        '</div>' +
        '<div style="display:flex; gap:12px;">' +
          '<div class="stat" data-action="go-ledger" style="cursor:pointer;"><div class="label">' + ADMINS.A.name + '</div><div class="value">' + fmt(state.balances.A) + '</div></div>' +
          '<div class="stat" data-action="go-ledger" style="cursor:pointer;"><div class="label">' + ADMINS.B.name + '</div><div class="value">' + fmt(state.balances.B) + '</div></div>' +
        '</div>' +
        '<div><div class="section-label">Groups</div><div class="row-list">' + groupCards + '</div></div>' +
      '</div>' +
      (isSuper() ? '' : '<button class="fab" data-action="create-group">' + iconPlus() + '</button>') +
      renderBottomNav('dashboard') +
    '</div>';
}

function renderBottomNav(active) {
  var dashColor = active === 'dashboard' ? 'var(--accent)' : '#a39d92';
  var ledColor = active === 'ledger' ? 'var(--accent)' : '#a39d92';
  return '<div class="bottom-nav">' +
    '<div class="tab ' + (active === 'dashboard' ? 'active' : '') + '" data-action="go-dashboard">' + iconHome(dashColor) + '<div>Dashboard</div></div>' +
    '<div class="tab ' + (active === 'ledger' ? 'active' : '') + '" data-action="go-ledger">' + iconLedger(ledColor) + '<div>Ledger</div></div>' +
  '</div>';
}

function renderLedger() {
  var rows = state.ledgerEntries.map(function (r) {
    var iconBg = r.type === 'collection' ? '#e6f2ec' : (r.type === 'payout' ? '#fdf1e4' : '#eef0f6');
    var iconColor = r.type === 'collection' ? '#146b52' : (r.type === 'payout' ? '#b45309' : '#3b4a8a');
    var icon = r.type === 'collection'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M12 19L6 13M12 19L18 13" stroke="' + iconColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : r.type === 'payout'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M12 5L6 11M12 5L18 11" stroke="' + iconColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 7H17M17 7L14 4M17 7L14 10" stroke="' + iconColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return '<div class="list-row" style="cursor:default;">' +
      '<div class="avatar sm" style="background:' + iconBg + ';">' + icon + '</div>' +
      '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600; overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(r.title) + '</div>' +
      '<div style="font-size:11.5px;color:var(--text-muted);margin-top:1px; overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(r.subtitle) + '</div></div>' +
      '<div style="font-size:13px;font-weight:700;color:' + r.amountColor + ';">' + r.amountFormatted + '</div>' +
    '</div>';
  }).join('') || '<div class="card" style="color:var(--text-muted); font-size:13px; text-align:center;">No activity yet.</div>';

  return '' +
    '<div class="screen">' +
      '<div style="padding:20px 20px 4px;"><div class="mono" style="font-size:20px;font-weight:700;">Admin &amp; Ledger</div>' +
      '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Balances &amp; transactions across all groups</div></div>' +
      '<div class="content">' +
        '<div style="display:flex; gap:12px;">' +
          '<div class="stat"><div class="label">' + ADMINS.A.name + '</div><div class="value">' + fmt(state.balances.A) + '</div></div>' +
          '<div class="stat"><div class="label">' + ADMINS.B.name + '</div><div class="value">' + fmt(state.balances.B) + '</div></div>' +
        '</div>' +
        '<div class="card" style="display:flex;justify-content:space-between;align-items:center;">' +
          '<div style="font-size:13px;color:var(--text-muted);">Total in ledger</div><div class="mono" style="font-size:15px;font-weight:700;">' + fmt(state.balances.total) + '</div>' +
        '</div>' +
        '<div class="banner info"><div style="font-size:12px;color:var(--accent);line-height:1.4;">There\'s no direct admin-to-admin transfer here. Funds only move between admins per month, tied to what was actually collected, and need the other admin\'s acceptance — open a month to request one.</div></div>' +
        '<div><div class="section-label">Recent activity</div><div class="row-list">' + rows + '</div></div>' +
      '</div>' +
      renderBottomNav('ledger') +
    '</div>';
}

function renderGroupDetail() {
  var gid = state.activeGroupId;
  var group = groupsById.get(gid);
  if (!group) return '<div class="content"><div class="card">Group not found.</div></div>';
  var members = membersByGroup.get(gid) || [];

  var collectedSoFar = 0;
  for (var i = 1; i <= group.currentMonth; i++) collectedSoFar += monthFinances(gid, group, i).totalCollected;

  var rows = [];
  for (var m = 1; m <= group.currentMonth; m++) {
    var f = monthFinances(gid, group, m);
    var subtitle, statusLabel, statusColor, badgeBg, badgeColor;
    if (f.closed) {
      var winner = members.find(function (mm) { return mm.id === f.monthDoc.winnerId; });
      subtitle = 'Winner: ' + (winner ? escapeHtml(winner.name) : '—');
      statusLabel = fmt(f.payoutAmount); statusColor = '#6f6a62';
      badgeBg = '#e6f2ec'; badgeColor = '#146b52';
    } else {
      subtitle = f.paidCount + ' / ' + members.length + ' paid so far';
      statusLabel = 'In progress'; statusColor = '#146b52';
      badgeBg = '#146b52'; badgeColor = '#fff';
    }
    rows.push('<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '">' +
      '<div class="avatar sm" style="background:' + badgeBg + '; color:' + badgeColor + ';">' + m + '</div>' +
      '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">Month ' + m + '</div>' +
      '<div style="font-size:11.5px;color:var(--text-muted);margin-top:1px;">' + subtitle + '</div></div>' +
      '<div style="font-size:13px;font-weight:700;color:' + statusColor + ';">' + statusLabel + '</div>' +
    '</div>');
  }

  return '' +
    '<div class="screen">' +
      '<div class="topbar">' +
        '<div class="back" data-action="go-dashboard">' + iconChevronLeft() + '</div>' +
        '<div><div class="title">' + escapeHtml(group.name) + '</div>' +
        '<div class="subtitle">Month ' + group.currentMonth + ' of ' + group.durationMonths + ' · started ' + monthLabel(group.startYear, group.startMonthIndex, 1) + '</div></div>' +
      '</div>' +
      '<div class="content">' +
        '<div class="stat-row">' +
          '<div class="stat"><div class="label">Monthly deposit</div><div class="value">' + fmt(group.monthlyDeposit) + '</div></div>' +
          '<div class="stat"><div class="label">Collected so far</div><div class="value">' + fmt(collectedSoFar) + '</div></div>' +
          '<div class="stat"><div class="label">Members</div><div class="value">' + members.length + '</div></div>' +
        '</div>' +
        '<div><div class="section-label">Months</div><div class="row-list">' + rows.join('') + '</div></div>' +
      '</div>' +
    '</div>';
}

function renderCreateGroup() {
  var g = state.ui.newGroup;
  if (g.step === 1) {
    var dur = g.durationMonths, previewRows = '';
    for (var i = 0; i < dur; i++) {
      var t = dur > 1 ? i / (dur - 1) : 0;
      var amt = g.payoutStart + (g.payoutEnd - g.payoutStart) * t;
      previewRows += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--border);">' +
        '<div style="font-size:12.5px;color:var(--text-muted);">Month ' + (i + 1) + '</div><div style="font-size:13px;font-weight:600;">' + fmt(amt) + '</div></div>';
    }
    return '' +
      '<div class="screen">' +
        '<div class="topbar"><div class="back" data-action="cancel-create-group">' + iconChevronLeft() + '</div><div class="title">New Chit Group</div></div>' +
        '<div class="content">' +
          '<div class="field"><label>Group name</label><input data-field="name" value="' + escapeHtml(g.name) + '" placeholder="e.g. Friends Chit 2027" /></div>' +
          '<div class="field-row">' +
            '<div class="field"><label>Duration (months)</label><input data-field="durationMonths" type="number" value="' + g.durationMonths + '" /></div>' +
            '<div class="field"><label>Monthly deposit (₹)</label><input data-field="monthlyDeposit" type="number" value="' + g.monthlyDeposit + '" /></div>' +
          '</div>' +
          '<div style="height:1px;background:var(--border);"></div>' +
          '<div>' +
            '<div style="font-size:13px;font-weight:600;margin-bottom:2px;">Payout schedule</div>' +
            '<div style="font-size:11.5px;color:var(--text-muted);margin-bottom:12px;">Set the first and last month\'s payout — the months in between are generated automatically.</div>' +
            '<div class="field-row">' +
              '<div class="field"><label>Month 1 payout (₹)</label><input data-field="payoutStart" type="number" value="' + g.payoutStart + '" /></div>' +
              '<div class="field"><label>Final month payout (₹)</label><input data-field="payoutEnd" type="number" value="' + g.payoutEnd + '" /></div>' +
            '</div>' +
            '<div style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:12px;background:var(--surface);margin-top:12px;">' + previewRows + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="flex-shrink:0;padding:14px 20px;border-top:1px solid var(--border);background:var(--surface);">' +
          '<button class="btn btn-primary" style="width:100%;" data-action="create-group-step2" ' + (g.name.trim() ? '' : 'disabled') + '>Next: Add Members</button>' +
        '</div>' +
      '</div>';
  }

  var memberRows = g.members.map(function (m, idx) {
    return '<div class="list-row" style="cursor:default;"><div class="avatar sm" style="background:' + colorFor(idx) + ';">' + initialsOf(m.name) + '</div>' +
      '<div style="flex:1 1 auto;font-size:13px;font-weight:500;">' + escapeHtml(m.name) + '</div>' +
      '<div data-action="remove-draft-member" data-idx="' + idx + '" style="cursor:pointer; color:var(--danger); font-size:12px; font-weight:600;">Remove</div></div>';
  }).join('');

  return '' +
    '<div class="screen">' +
      '<div class="topbar"><div class="back" data-action="create-group-back-step1">' + iconChevronLeft() + '</div><div class="title">Add Members</div></div>' +
      '<div class="content">' +
        '<div class="field"><label>Member name</label>' +
          '<div style="display:flex; gap:8px;"><input data-field="draftMemberName" value="' + escapeHtml(g.draftMemberName) + '" placeholder="Full name" style="flex:1 1 auto; padding:12px 14px; border-radius:10px; border:1px solid var(--border);" />' +
          '<button class="btn btn-primary" style="padding:12px 16px;" data-action="add-draft-member">Add</button></div>' +
        '</div>' +
        '<div><div class="section-label">' + g.members.length + ' member' + (g.members.length === 1 ? '' : 's') + ' added</div><div class="row-list">' + memberRows + '</div></div>' +
      '</div>' +
      '<div style="flex-shrink:0;padding:14px 20px;border-top:1px solid var(--border);background:var(--surface);">' +
        '<button class="btn btn-primary" style="width:100%;" data-action="submit-create-group" ' + (g.members.length ? '' : 'disabled') + '>Create Group (' + g.members.length + ' members)</button>' +
      '</div>' +
    '</div>';
}

function renderMonthDetail() {
  var gid = state.activeGroupId, viewMonth = state.viewMonth;
  var group = groupsById.get(gid);
  if (!group) return '<div class="content"><div class="card">Loading…</div></div>';
  var readOnly = isSuper();
  var members = membersByGroup.get(gid) || [];
  var f = monthFinances(gid, group, viewMonth);
  var isClosed = f.closed;
  var isOpen = viewMonth === group.currentMonth && !isClosed;
  var isUpcoming = viewMonth > group.currentMonth;

  var statusLabel = isClosed ? 'Closed' : (isOpen ? 'Open' : 'Upcoming');
  var statusBg = isClosed ? '#e6f2ec' : (isOpen ? 'var(--accent)' : '#efece5');
  var statusColor = isClosed ? 'var(--accent)' : (isOpen ? '#fff' : '#a39d92');

  var html = '<div class="screen">' +
    '<div class="topbar">' +
      '<div class="back" data-action="open-group-detail" data-gid="' + gid + '">' + iconChevronLeft() + '</div>' +
      '<div style="flex:1 1 auto;"><div class="title">Month ' + viewMonth + '</div><div class="subtitle">' + escapeHtml(group.name) + ' · of ' + group.durationMonths + '</div></div>' +
      '<div style="font-size:11px;font-weight:700;padding:5px 10px;border-radius:8px;background:' + statusBg + ';color:' + statusColor + ';">' + statusLabel + '</div>' +
    '</div>' +
    '<div class="content">';

  if (isClosed) {
    var winner = members.find(function (mm) { return mm.id === f.monthDoc.winnerId; });
    html += '<div class="card" style="display:flex;flex-direction:column;gap:10px;">' +
      row('Winner', winner ? escapeHtml(winner.name) : '—') +
      row('Payout amount', fmt(f.payoutAmount)) +
      row('Paid out by', adminName(f.monthDoc.payoutAdmin)) +
      row('Collected', fmt(f.totalCollected)) +
      '<div style="height:1px;background:var(--border);"></div>' +
      row('Split after transfer', ADMINS.A.name + ' ' + fmt(f.adjA) + ' · ' + ADMINS.B.name + ' ' + fmt(f.adjB)) +
      row('Closed', escapeHtml(f.monthDoc.closedLabel || '')) +
    '</div>';
  } else if (isUpcoming) {
    html += '<div class="banner warn"><div class="banner-title">Not yet open</div>' +
      '<div style="font-size:12.5px;color:var(--text-muted);">Opens once Month ' + (viewMonth - 1) + ' is closed. Scheduled payout: ' + fmt((group.payoutSchedule && group.payoutSchedule[viewMonth - 1]) || 0) + '.</div></div>';
  } else if (isOpen) {
    html += '<div class="card" style="display:flex;justify-content:space-between;align-items:center;">' +
      '<div><div style="font-size:12px;color:var(--text-muted);">Collected</div><div class="mono" style="font-size:16px;font-weight:700;">' + fmt(f.totalCollected) + ' <span style="font-size:12px;color:var(--text-muted);font-weight:400;">/ ' + fmt(members.length * group.monthlyDeposit) + '</span></div></div>' +
      '<div style="text-align:right;"><div style="font-size:12px;color:var(--text-muted);">Scheduled payout</div><div class="mono" style="font-size:16px;font-weight:700;color:var(--accent);">' + fmt(f.payoutAmount) + '</div></div>' +
    '</div>';
  }

  if (isOpen || isClosed) {
    var payments = paymentsCache.get(monthKey(gid, viewMonth)) || {};
    var payRows = members.map(function (mm, idx) {
      var p = payments[mm.id] || { paid: false };
      return { mm: mm, idx: idx, paid: !!p.paid, collectedBy: p.collectedBy, mode: p.mode };
    });
    payRows.sort(function (a, b) { if (a.paid === b.paid) return 0; return a.paid ? 1 : -1; });
    var rowsHtml = payRows.map(function (r) {
      var subtitle = r.paid
        ? 'Collected by <span style="font-weight:600;color:var(--accent);">' + adminName(r.collectedBy) + '</span> · ' + (r.mode === 'online' ? 'Online' : 'Cash')
        : '<span style="color:var(--danger);">Not paid yet' + (readOnly ? '' : ' · tap to record') + '</span>';
      return '<div class="list-row" ' + (readOnly ? '' : 'data-action="open-payment-modal" data-mid="' + r.mm.id + '"') + '>' +
        '<div class="avatar sm" style="background:' + colorFor(r.idx) + ';">' + initialsOf(r.mm.name) + '</div>' +
        '<div style="flex:1 1 auto;min-width:0;"><div style="font-size:13px;font-weight:500;">' + escapeHtml(r.mm.name) + '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);margin-top:1px;">' + subtitle + '</div></div>' +
        '<div style="width:24px;height:24px;border-radius:7px;background:' + (r.paid ? 'var(--accent)' : 'transparent') + ';border:1.5px solid ' + (r.paid ? 'var(--accent)' : '#d8d4cb') + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (r.paid ? iconCheck('#fff') : '') + '</div>' +
      '</div>';
    }).join('');
    html += '<div><div class="section-label">Member payments (' + f.paidCount + '/' + members.length + ')</div><div class="row-list">' + rowsHtml + '</div></div>';
  }

  if (isOpen) {
    var req = transferReqCache.get(monthKey(gid, viewMonth));
    html += '<div class="card" style="display:flex;flex-direction:column;gap:12px;">' +
      '<div style="font-size:13px;font-weight:600;">This month\'s fund position</div>' +
      '<div style="display:flex;gap:12px;">' +
        '<div style="flex:1 1 0;"><div style="font-size:11px;color:var(--text-muted);">' + ADMINS.A.name + ' holds</div><div class="mono" style="font-size:15px;font-weight:700;">' + fmt(f.adjA) + '</div></div>' +
        '<div style="flex:1 1 0;text-align:right;"><div style="font-size:11px;color:var(--text-muted);">' + ADMINS.B.name + ' holds</div><div class="mono" style="font-size:15px;font-weight:700;">' + fmt(f.adjB) + '</div></div>' +
      '</div>';
    if (readOnly) {
      if (req) {
        html += '<div style="font-size:11.5px;color:var(--warning);">' + adminName(req.requestedBy) + ' requested to send ' + fmt(req.amount) + ' (' + (req.direction === 'AtoB' ? ADMINS.A.name + ' → ' + ADMINS.B.name : ADMINS.B.name + ' → ' + ADMINS.A.name) + ') — pending acceptance.</div>';
      }
    } else if (!req) {
      html += '<div class="pill-row"><button class="btn btn-soft" style="flex:1 1 0;" data-action="request-transfer-b">Send all to ' + ADMINS.B.name + ' →</button>' +
        '<button class="btn btn-soft" style="flex:1 1 0;" data-action="request-transfer-a">← Send all to ' + ADMINS.A.name + '</button></div>' +
        '<div style="font-size:11px;color:var(--text-muted);line-height:1.4;">No free-amount transfers — sending funds still needs ' + adminName(otherAdmin(state.currentAdmin)) + ' to accept before it counts.</div>';
    } else if (req.requestedBy === state.currentAdmin) {
      html += '<div class="banner warn"><div class="banner-title">Waiting for ' + adminName(otherAdmin(req.requestedBy)) + ' to accept</div>' +
        '<div style="font-size:12px;">' + fmt(req.amount) + ' · ' + (req.direction === 'AtoB' ? ADMINS.A.name + ' → ' + ADMINS.B.name : ADMINS.B.name + ' → ' + ADMINS.A.name) + '</div>' +
        '<button class="btn btn-outline" style="width:100%;" data-action="cancel-transfer-request">Cancel request</button></div>';
    } else {
      html += '<div class="banner warn"><div class="banner-title">' + adminName(req.requestedBy) + ' wants to send ' + fmt(req.amount) + '</div>' +
        '<div style="font-size:12px;">' + (req.direction === 'AtoB' ? ADMINS.A.name + ' → ' + ADMINS.B.name : ADMINS.B.name + ' → ' + ADMINS.A.name) + '</div>' +
        '<div class="pill-row"><button class="btn btn-outline" style="flex:1 1 0;" data-action="decline-transfer-request">Decline</button>' +
        '<button class="btn btn-primary" style="flex:1 1 0;" data-action="accept-transfer-request">Accept</button></div></div>';
    }
    html += '</div>';

    var winnerId = f.monthDoc && f.monthDoc.winnerId;
    var winner = winnerId && members.find(function (mm) { return mm.id === winnerId; });
    html += '<div class="card" style="display:flex;flex-direction:column;gap:10px;">' +
      '<div style="font-size:13px;font-weight:600;">This month\'s winner</div>';
    if (winner) {
      var widx = members.findIndex(function (mm) { return mm.id === winner.id; });
      html += '<div class="list-row" style="background:var(--accent-soft); cursor:' + (readOnly ? 'default' : 'pointer') + ';" ' + (readOnly ? '' : 'data-action="open-winner-picker"') + '>' +
        '<div class="avatar sm" style="background:' + colorFor(widx) + ';">' + initialsOf(winner.name) + '</div>' +
        '<div style="flex:1 1 auto;font-size:13px;font-weight:600;color:var(--accent);">' + escapeHtml(winner.name) + '</div>' +
        (readOnly ? '' : '<div style="font-size:12px;color:var(--accent);font-weight:600;">Change</div>') + '</div>';
    } else if (readOnly) {
      html += '<div style="font-size:12.5px;color:var(--text-muted);">No winner selected yet.</div>';
    } else {
      html += '<button class="btn btn-primary" style="width:100%;" data-action="open-winner-picker">Select Winner</button>';
    }
    html += '</div>';

    if (!readOnly) {
      html += '<div class="card" style="display:flex;flex-direction:column;gap:12px;">' +
        '<div style="font-size:13px;font-weight:600;">Record payout</div>' +
        '<div class="pill-row">' +
          '<button class="pill ' + (state.ui.payoutAdminChoice === 'A' ? 'active' : '') + '" data-action="set-payout-admin" data-id="A">Paid by ' + ADMINS.A.name + '</button>' +
          '<button class="pill ' + (state.ui.payoutAdminChoice === 'B' ? 'active' : '') + '" data-action="set-payout-admin" data-id="B">Paid by ' + ADMINS.B.name + '</button>' +
        '</div>' +
        (req ? '<div style="font-size:11px;color:var(--warning);">Resolve the pending transfer request above before closing this month.</div>' : '') +
        '<button class="btn btn-primary ' + (winnerId && !req ? '' : 'disabled') + '" style="width:100%; background:' + (winnerId && !req ? 'var(--accent)' : '#c7c2b8') + ';" data-action="close-month">Close Month &amp; Pay ' + fmt(f.payoutAmount) + '</button>' +
      '</div>';
    }
  }

  html += '</div>';

  if (state.ui.showWinnerPicker) {
    var wonIds = {};
    for (var m2 = 1; m2 <= group.durationMonths; m2++) {
      var mf = monthFinances(gid, group, m2);
      if (mf.closed && mf.monthDoc.winnerId) wonIds[mf.monthDoc.winnerId] = true;
    }
    var eligible = members.filter(function (mm) { return !wonIds[mm.id]; });
    var winnerRows = eligible.map(function (mm) {
      var idx = members.indexOf(mm);
      var selected = f.monthDoc && f.monthDoc.winnerId === mm.id;
      return '<div class="list-row" data-action="select-winner" data-mid="' + mm.id + '" style="background:' + (selected ? 'var(--accent-soft)' : '#fff') + '; border-color:' + (selected ? 'var(--accent)' : 'var(--border)') + ';">' +
        '<div class="avatar sm" style="background:' + colorFor(idx) + ';">' + initialsOf(mm.name) + '</div>' +
        '<div style="flex:1 1 auto;font-size:13px;font-weight:500;">' + escapeHtml(mm.name) + '</div>' +
        (selected ? '<div style="width:22px;height:22px;border-radius:11px;background:var(--accent);display:flex;align-items:center;justify-content:center;">' + iconCheck() + '</div>' : '') +
      '</div>';
    }).join('') || '<div style="font-size:12.5px; color:var(--text-muted); text-align:center; padding:20px;">Everyone has already won this cycle.</div>';

    html += '<div class="overlay"><div class="sheet">' +
      '<div class="sheet-header"><div style="font-size:14px;font-weight:700;">Select this month\'s winner</div>' +
      '<div class="sheet-close" data-action="close-winner-picker">' + iconClose() + '</div></div>' +
      '<div class="sheet-body">' + winnerRows + '</div>' +
    '</div></div>';
  }

  var pm = state.ui.paymentModal;
  if (pm) {
    var pmem = members.find(function (mm) { return mm.id === pm.memberId; });
    var pidx = members.indexOf(pmem);
    var existingP = (paymentsCache.get(monthKey(gid, viewMonth)) || {})[pm.memberId];
    var transferHistory = '';
    if (pm.isEditing && existingP) {
      transferHistory += '<div><div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;">Transfer history</div><div style="display:flex;flex-direction:column;gap:10px;">' +
        timelineRow('var(--accent)', escapeHtml(pmem.name) + ' → ' + adminName(existingP.collectedBy), (existingP.mode === 'online' ? 'Online' : 'Cash'), '');
      var monthNet = (monthsCache.get(monthKey(gid, viewMonth)) || {}).transferNet || 0;
      if (monthNet) {
        transferHistory += timelineRow('var(--accent)', (monthNet > 0 ? ADMINS.A.name + ' → ' + ADMINS.B.name : ADMINS.B.name + ' → ' + ADMINS.A.name),
          'Accepted', 'color:var(--accent);', fmt(Math.abs(monthNet)));
      }
      var pendingReq = transferReqCache.get(monthKey(gid, viewMonth));
      if (pendingReq) {
        transferHistory += timelineRow('var(--warning)', (pendingReq.direction === 'AtoB' ? ADMINS.A.name + ' → ' + ADMINS.B.name : ADMINS.B.name + ' → ' + ADMINS.A.name),
          'Pending acceptance', 'color:var(--warning);', fmt(pendingReq.amount));
      }
      transferHistory += '</div></div>';
    }

    html += '<div class="overlay"><div class="sheet">' +
      '<div class="sheet-header">' +
        '<div class="avatar sm" style="background:' + colorFor(pidx) + ';">' + initialsOf(pmem.name) + '</div>' +
        '<div style="flex:1 1 auto;min-width:0;"><div style="font-size:14px;font-weight:700;">' + escapeHtml(pmem.name) + '</div>' +
        '<div style="font-size:11.5px;color:var(--text-muted);">Month ' + viewMonth + ' · ' + fmt(group.monthlyDeposit) + ' · collected by ' + adminName(state.currentAdmin) + '</div></div>' +
        '<div class="sheet-close" data-action="close-payment-modal">' + iconClose() + '</div>' +
      '</div>' +
      '<div class="sheet-body">' +
        '<div><div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;">Payment mode</div>' +
        '<div class="pill-row">' +
          '<button class="pill ' + (pm.mode === 'cash' ? 'active' : '') + '" data-action="set-modal-mode" data-mode="cash">Cash</button>' +
          '<button class="pill ' + (pm.mode === 'online' ? 'active' : '') + '" data-action="set-modal-mode" data-mode="online">Online</button>' +
        '</div></div>' +
        transferHistory +
        (pm.isEditing ? '<button class="btn btn-danger-text" style="width:100%;" data-action="mark-unpaid">Mark as unpaid</button>' : '') +
        '<button class="btn btn-primary" style="width:100%;" data-action="save-payment">Save Payment</button>' +
      '</div>' +
    '</div></div>';
  }

  return html;

  function row(label, value) {
    return '<div style="display:flex;justify-content:space-between;"><div style="font-size:12px;color:var(--text-muted);">' + label + '</div><div style="font-size:13px;font-weight:700;">' + value + '</div></div>';
  }
  function timelineRow(dotColor, title, status, statusStyle, amount) {
    return '<div style="display:flex;align-items:flex-start;gap:10px;">' +
      '<div style="width:8px;height:8px;border-radius:4px;background:' + dotColor + ';margin-top:5px;flex-shrink:0;"></div>' +
      '<div style="flex:1 1 auto;"><div style="font-size:12.5px;font-weight:500;">' + title + '</div>' +
      '<div style="font-size:11px;' + statusStyle + '">' + status + (amount ? ' · ' + amount : '') + '</div></div></div>';
  }
}

function render() {
  var root = document.getElementById('app');

  // a background Firestore update can trigger a re-render while the user is
  // mid-typing; every input is state-controlled via data-field, so state
  // already has the latest value by the time we get here — we just need to
  // restore FOCUS and CARET POSITION after the innerHTML swap below (the
  // captured value is only ever equal to what state already renders; never
  // restore a raw pre-render DOM value here, or an action that deliberately
  // clears a field, like "add member", gets its clear silently undone)
  var active = document.activeElement;
  var activeSelector = null, activeSelStart = null, activeSelEnd = null;
  if (active && root.contains(active) && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
    var df = active.getAttribute('data-field');
    if (df) {
      activeSelector = '[data-field="' + df + '"]';
      activeSelStart = active.selectionStart;
      activeSelEnd = active.selectionEnd;
    }
  }

  var html;
  switch (state.screen) {
    case 'login': html = renderLogin(); break;
    case 'dashboard': html = renderDashboard(); break;
    case 'groupDetail': html = renderGroupDetail(); break;
    case 'createGroup': html = renderCreateGroup(); break;
    case 'monthDetail': html = renderMonthDetail(); break;
    case 'ledger': html = renderLedger(); break;
    default: html = '<div class="boot">Loading Chit Funds…</div>';
  }
  root.innerHTML = html;

  if (activeSelector) {
    var again = root.querySelector(activeSelector);
    if (again) {
      again.focus();
      try { again.setSelectionRange(activeSelStart, activeSelEnd); } catch (e2) {}
    }
  }

  if (state.busy) {
    var overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.style.background = 'rgba(28,27,25,0.25)';
    overlay.style.alignItems = 'center';
    overlay.innerHTML = '<div class="spinner"></div>';
    root.appendChild(overlay);
  }
}

// ---------------------------------------------------------------------------
// event delegation
// ---------------------------------------------------------------------------

document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;
  var action = el.getAttribute('data-action');
  switch (action) {
    case 'signin': signInGoogle(); break;
    case 'logout': doLogout(); break;
    case 'go-dashboard': goTo('dashboard'); break;
    case 'go-ledger': goTo('ledger'); break;
    case 'create-group': startCreateGroup(); break;
    case 'cancel-create-group': state.ui.newGroup = null; goTo('dashboard'); break;
    case 'create-group-step2': createGroupStep2(); break;
    case 'create-group-back-step1': state.ui.newGroup.step = 1; render(); break;
    case 'add-draft-member': addDraftMember(); break;
    case 'remove-draft-member': removeDraftMember(parseInt(el.getAttribute('data-idx'), 10)); break;
    case 'submit-create-group': submitCreateGroup(); break;
    case 'open-current-month': openCurrentMonth(el.getAttribute('data-gid')); break;
    case 'open-group-detail': openGroupDetail(el.getAttribute('data-gid')); break;
    case 'open-month': openMonth(el.getAttribute('data-gid'), parseInt(el.getAttribute('data-m'), 10)); break;
    case 'open-payment-modal': openPaymentModal(el.getAttribute('data-mid')); break;
    case 'close-payment-modal': closePaymentModal(); break;
    case 'set-modal-mode': setModalMode(el.getAttribute('data-mode')); break;
    case 'save-payment': savePaymentModal(); break;
    case 'mark-unpaid': markUnpaidFromModal(); break;
    case 'open-winner-picker': openWinnerPicker(); break;
    case 'close-winner-picker': closeWinnerPicker(); break;
    case 'select-winner': selectWinner(el.getAttribute('data-mid')); break;
    case 'set-payout-admin': setPayoutAdminChoice(el.getAttribute('data-id')); break;
    case 'close-month': closeMonthAction(); break;
    case 'request-transfer-b': requestTransferToB(); break;
    case 'request-transfer-a': requestTransferToA(); break;
    case 'accept-transfer-request': acceptTransferRequest(); break;
    case 'decline-transfer-request': declineTransferRequest(); break;
    case 'cancel-transfer-request': cancelTransferRequest(); break;
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && e.target && e.target.getAttribute && e.target.getAttribute('data-field') === 'draftMemberName') {
    e.preventDefault();
    addDraftMember();
  }
});

document.addEventListener('input', function (e) {
  var field = e.target.getAttribute && e.target.getAttribute('data-field');
  if (!field || !state.ui.newGroup) return;
  var g = state.ui.newGroup;
  if (field === 'name') g.name = e.target.value;
  else if (field === 'durationMonths') g.durationMonths = Math.max(1, parseInt(e.target.value, 10) || 1);
  else if (field === 'monthlyDeposit') g.monthlyDeposit = parseFloat(e.target.value) || 0;
  else if (field === 'payoutStart') g.payoutStart = parseFloat(e.target.value) || 0;
  else if (field === 'payoutEnd') g.payoutEnd = parseFloat(e.target.value) || 0;
  else if (field === 'draftMemberName') g.draftMemberName = e.target.value;
  render(); // render() itself preserves focus/caret on the field being typed in
});

render();
