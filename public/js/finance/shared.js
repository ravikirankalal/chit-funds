import { fmt, adminName } from '../helpers.js';

// Almost every month has exactly one winner, but admins sometimes pay out
// more than one member within the same calendar month (most often when
// group.durationMonths < members.length, leaving too few months for a
// dedicated slot per member) — so a month's winners are a list. Older,
// already-closed months only ever wrote the single winnerId field; this
// reconstructs the equivalent one-entry list for them so every read site
// can treat winners as a list without a data migration.
export function getMonthWinners(monthDoc, defaultAmount) {
  if (!monthDoc) return [];
  if (monthDoc.winners) return monthDoc.winners;
  if (monthDoc.winnerId) return [{ memberId: monthDoc.winnerId, payoutAmount: defaultAmount }];
  return [];
}

// "Nagendramma" when only one admin ever contributed (matches the old
// single-payoutAdmin display exactly), "Nagendramma (₹X) + Subhash (₹Y)"
// once a payout is actually split. null when nobody's paid anything yet.
export function payoutByLabel(f) {
  var parts = [];
  if (f.payoutPaidA > 0) parts.push(adminName('A') + (f.payoutPaidB > 0 ? ' (' + fmt(f.payoutPaidA) + ')' : ''));
  if (f.payoutPaidB > 0) parts.push(adminName('B') + (f.payoutPaidA > 0 ? ' (' + fmt(f.payoutPaidB) + ')' : ''));
  return parts.join(' + ') || null;
}
