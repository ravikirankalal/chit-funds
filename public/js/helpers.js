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

// A small colored dot in the admin's own avatar color — used as a compact
// leading glyph next to admin-specific labels ("Ramesh holds", balances,
// ledger stat cards) so it's identifiable at a glance without repeating a
// full avatar circle everywhere.
export function adminDot(id) {
  return '<span style="display:inline-block;width:7px;height:7px;border-radius:4px;background:' + adminAvatarColor(id) + ';flex-shrink:0;"></span>';
}

export function otherAdmin(id) { return id === 'A' ? 'B' : 'A'; }

// Read-only oversight account: never a fund custodian, can't record
// payments/winners/transfers or create groups — see docs/firebase-project-setup.md.
export function isSuper() { return state.currentAdmin === 'SUPER'; }

// Accepts a Firestore Timestamp (has toDate()), a Date, or a ms epoch —
// paidAt arrives as a Firestore Timestamp once synced but can briefly be
// null right after a serverTimestamp() write is optimistically applied.
export function formatDateTime(ts) {
  if (!ts) return '';
  var d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return '';
  var datePart = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  var timePart = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  return datePart + ', ' + timePart;
}

export function monthLabel(startYear, startMonthIndex, monthNum) {
  var total = startMonthIndex + (monthNum - 1);
  var year = startYear + Math.floor(total / 12);
  var idx = ((total % 12) + 12) % 12;
  return MONTH_NAMES[idx] + ' ' + year;
}

// Seeds (or resets) the per-month payout schedule while a group is still
// being configured — see createGroup.js. Starts at `amount` for month 1
// and climbs by a fixed ₹2,000 each month after that, the common
// chit-fund pattern where earlier payouts are discounted and later ones
// approach the full pot — rather than one flat amount for every month.
// Once a group is created this schedule is stored as-is and there's no
// UI path to regenerate it (individual months can still be hand-edited
// on this same screen before submitting).
export function stepPayoutSchedule(amount, durationMonths) {
  var STEP = 2000;
  var schedule = [];
  for (var i = 0; i < durationMonths; i++) schedule.push(amount + i * STEP);
  return schedule;
}

// Splits a Firestore doc path (e.g. "groups/GID/months/3/payments/MID")
// into its segments — used by the collectionGroup listeners to recover
// which group/month/member a changed document belongs to.
export function pathParts(path) { return path.split('/'); }
