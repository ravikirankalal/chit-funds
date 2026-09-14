// Firestore listeners, kept alive for the whole signed-in session. Each one
// just keeps a cache in store.js up to date; this module owns the
// debounce that turns a burst of snapshot events into a single
// recompute() + render() pass.

import { onSnapshot, collection, collectionGroup } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from './firebase.js';
import { groupsById, membersById, membersByGroup, monthsCache, paymentsCache, transferReqCache, monthKey, clearCaches } from './store.js';
import { pathParts } from './helpers.js';
import { recompute } from './finance.js';
import { render } from './render.js';

var recomputeScheduled = false;
function scheduleRecompute() {
  if (recomputeScheduled) return;
  recomputeScheduled = true;
  setTimeout(function () { recomputeScheduled = false; recompute(); render(); }, 30);
}

// Members live independently of groups (so the same person can belong to
// several); a group only stores memberIds[]. Whenever either the group
// docs or the member directory changes, rejoin the two into the
// {id,name} lists views actually read (membersByGroup).
function rebuildMembersByGroup() {
  groupsById.forEach(function (group, gid) {
    var joined = (group.memberIds || []).map(function (id) {
      var top = membersById.get(id);
      return { id: id, name: top ? top.name : '(unknown member)' };
    });
    membersByGroup.set(gid, joined);
  });
}

var unsubs = [];

export function startListeners() {
  if (unsubs.length) return;

  unsubs.push(onSnapshot(collection(db, 'groups'), function (snap) {
    snap.docChanges().forEach(function (change) {
      if (change.type === 'removed') { groupsById.delete(change.doc.id); membersByGroup.delete(change.doc.id); }
      else { groupsById.set(change.doc.id, Object.assign({ id: change.doc.id }, change.doc.data())); }
    });
    rebuildMembersByGroup();
    scheduleRecompute();
  }));

  unsubs.push(onSnapshot(collection(db, 'members'), function (snap) {
    snap.docChanges().forEach(function (change) {
      if (change.type === 'removed') membersById.delete(change.doc.id);
      else membersById.set(change.doc.id, Object.assign({ id: change.doc.id }, change.doc.data()));
    });
    rebuildMembersByGroup();
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
