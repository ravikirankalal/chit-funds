// Firestore listeners, kept alive for the whole signed-in session. Each one
// just keeps a cache in store.js up to date; this module owns the
// debounce that turns a burst of snapshot events into a single
// recompute() + render() pass.

import { onSnapshot, collection, collectionGroup } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase.js';
import { groupsById, membersByGroup, monthsCache, paymentsCache, transferReqCache, monthKey, clearCaches } from './store.js';
import { pathParts } from './helpers.js';
import { recompute } from './finance.js';
import { render } from './render.js';

var recomputeScheduled = false;
function scheduleRecompute() {
  if (recomputeScheduled) return;
  recomputeScheduled = true;
  setTimeout(function () { recomputeScheduled = false; recompute(); render(); }, 30);
}

var unsubs = [];

export function startListeners() {
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

export function stopListeners() {
  unsubs.forEach(function (u) { u(); });
  unsubs = [];
  clearCaches();
}
