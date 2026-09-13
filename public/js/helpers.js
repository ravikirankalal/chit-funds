// Small pure(-ish) helpers used across views, actions, and finance math.
// `isSuper()` is the one exception to "pure" — it reads current auth state.

import { ADMINS, SUPER_ADMIN } from '../firebase-config.js';
import { PALETTE, MONTH_NAMES } from './constants.js';
import { state } from './store.js';

export function fmt(n) { return '₹' + Math.round(n || 0).toLocaleString('en-IN'); }

export function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

export function initialsOf(name) {
  var p = String(name || '').trim().split(/\s+/);
  return ((p[0] ? p[0][0] : '') + (p[1] ? p[1][0] : '')).toUpperCase() || '?';
}

export function colorFor(idx) { return PALETTE[((idx % PALETTE.length) + PALETTE.length) % PALETTE.length]; }

export function adminName(id) { return id === 'B' ? ADMINS.B.name : (id === 'SUPER' ? SUPER_ADMIN.name : ADMINS.A.name); }

export function adminAvatarColor(id) { return id === 'B' ? colorFor(1) : (id === 'SUPER' ? '#3b3a36' : colorFor(0)); }

export function otherAdmin(id) { return id === 'A' ? 'B' : 'A'; }

// Read-only oversight account: never a fund custodian, can't record
// payments/winners/transfers or create groups — see docs/firebase-project-setup.md.
export function isSuper() { return state.currentAdmin === 'SUPER'; }

export function monthLabel(startYear, startMonthIndex, monthNum) {
  var total = startMonthIndex + (monthNum - 1);
  var year = startYear + Math.floor(total / 12);
  var idx = ((total % 12) + 12) % 12;
  return MONTH_NAMES[idx] + ' ' + year;
}

// Splits a Firestore doc path (e.g. "groups/GID/months/3/payments/MID")
// into its segments — used by the collectionGroup listeners to recover
// which group/month/member a changed document belongs to.
export function pathParts(path) { return path.split('/'); }
