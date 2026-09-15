import { monthsCache, paymentsCache, membersByGroup, monthKey } from '../store.js';
import { getMonthWinners } from './shared.js';

// Each admin now contributes their own partial share of a winner's payout
// (w.paidByA / w.paidByB) — no more single monthDoc.payoutAdmin deciding
// the whole thing (see setPayoutContribution in actions/winners/payout.js). Older, already-
// closed months only ever wrote that single field for the WHOLE month's
// payout; this attributes it back to whichever admin closed it, so old data
// still renders correctly without a migration.
function getWinnerPaid(w, monthDoc) {
  if (typeof w.paidByA === 'number' || typeof w.paidByB === 'number') {
    return { paidByA: w.paidByA || 0, paidByB: w.paidByB || 0 };
  }
  if (monthDoc && monthDoc.status === 'closed' && monthDoc.payoutAdmin) {
    return monthDoc.payoutAdmin === 'A'
      ? { paidByA: w.payoutAmount || 0, paidByB: 0 }
      : { paidByA: 0, paidByB: w.payoutAmount || 0 };
  }
  return { paidByA: 0, paidByB: 0 };
}

// Derives, for one month, who holds what: raw collections split by
// collector, the net amount ever moved between admins for that month, and
// each admin's own partial payout contributions so far — the single source
// of truth everything else (balances, ledger, UI) is built from.
export function monthFinances(gid, group, monthNum) {
  var monthDoc = monthsCache.get(monthKey(gid, monthNum)) || null;
  var payments = paymentsCache.get(monthKey(gid, monthNum)) || {};
  var members = membersByGroup.get(gid) || [];
  var paidCount = 0, rawA = 0, rawB = 0, paidCountA = 0, paidCountB = 0;
  members.forEach(function (mem) {
    var p = payments[mem.id];
    if (p && p.paid) {
      paidCount++;
      if (p.collectedBy === 'A') { rawA += group.monthlyDeposit; paidCountA++; } else { rawB += group.monthlyDeposit; paidCountB++; }
    }
  });
  var net = (monthDoc && monthDoc.transferNet) || 0;
  var scheduledPayout = (group.payoutSchedule && group.payoutSchedule[monthNum - 1]) || 0;
  var rawWinners = getMonthWinners(monthDoc, scheduledPayout);
  var payoutPaidA = 0, payoutPaidB = 0;
  var winners = rawWinners.map(function (w) {
    var paid = getWinnerPaid(w, monthDoc);
    payoutPaidA += paid.paidByA; payoutPaidB += paid.paidByB;
    var target = w.payoutAmount || 0;
    return {
      memberId: w.memberId, payoutAmount: target,
      paidByA: paid.paidByA, paidByB: paid.paidByB,
      remaining: Math.max(0, target - paid.paidByA - paid.paidByB)
    };
  });
  var payoutAmount = winners.length
    ? winners.reduce(function (sum, w) { return sum + w.payoutAmount; }, 0)
    : scheduledPayout;
  // Each admin's contribution reduces what they hold the moment it's
  // recorded — a partial payout is money leaving that admin's hand right
  // away, whether or not the month has fully closed yet (see
  // setPayoutContribution in actions/winners/payout.js, which auto-closes the month once
  // every winner's contributions add up to their full payoutAmount).
  var adjA = rawA - net - payoutPaidA, adjB = rawB + net - payoutPaidB;
  var closed = !!monthDoc && monthDoc.status === 'closed';
  var allPayoutCovered = winners.length > 0 && winners.every(function (w) { return w.remaining <= 0; });
  return {
    monthDoc: monthDoc, paidCount: paidCount, totalCollected: paidCount * group.monthlyDeposit,
    rawA: rawA, rawB: rawB, paidCountA: paidCountA, paidCountB: paidCountB, net: net, adjA: adjA, adjB: adjB,
    winners: winners, payoutAmount: payoutAmount, payoutPaidA: payoutPaidA, payoutPaidB: payoutPaidB,
    allPayoutCovered: allPayoutCovered, closed: closed, finalA: adjA, finalB: adjB
  };
}
