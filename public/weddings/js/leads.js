// Firestore access for wedding leads. Field list must match firestore.rules.

import { db } from './firebase.js';
import {
  collection, addDoc, doc, updateDoc, query, where, orderBy, onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const leads = collection(db, 'weddingLeads');

function trackingParams() {
  const p = new URLSearchParams(location.search);
  const out = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'gclid'].forEach(function (k) {
    const v = p.get(k);
    if (v) out[k] = v.slice(0, 200);
  });
  return out;
}

export function submitLead(form, uid) {
  return addDoc(leads, {
    name: form.name,
    phone: form.phone,
    email: form.email,
    city: form.city,
    weddingDate: form.weddingDate,
    guests: form.guests,
    callbackTime: form.callbackTime,
    interest: form.interest,
    services: form.services,
    notes: form.notes,
    source: trackingParams(),
    status: 'new',
    uid: uid || null,
    createdAt: serverTimestamp()
  });
}

export function watchMyLeads(uid, cb) {
  return onSnapshot(query(leads, where('uid', '==', uid)), function (snap) {
    cb(snap.docs.map(function (d) { return { id: d.id, ...d.data() }; })
      .sort(function (a, b) { return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0); }));
  });
}

export function watchAllLeads(cb, onError) {
  return onSnapshot(query(leads, orderBy('createdAt', 'desc')), function (snap) {
    cb(snap.docs.map(function (d) { return { id: d.id, ...d.data() }; }));
  }, onError);
}

export function updateLead(id, fields) {
  return updateDoc(doc(db, 'weddingLeads', id), { ...fields, updatedAt: serverTimestamp() });
}
