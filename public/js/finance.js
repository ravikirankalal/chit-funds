// All the money math lives here, in one place, so the rules for "who's
// holding what" are never duplicated between the ledger, group detail's
// months list, and month detail's fund-position card.
//
// Deliberately has no knowledge of rendering — it only reads the caches
// and writes derived numbers back onto `state`. Whoever calls recompute()
// (listeners.js) is responsible for re-rendering afterwards; that keeps
// this module from ever needing to import render.js.

import {
  state, groupsById, membersByGroup, monthsCache, paymentsCache, transferReqCache, monthKey
} from './store.js';
import { fmt, adminName, monthLabel } from './helpers.js';

// Derives, for one month, who holds what: raw collections split by
// collector, the net amount ever moved between admins for that month, and
// (once closed) the payout deduction — the single source of truth
// everything else (balances, ledger, UI) is built from.
export function monthFinances(gid, group, monthNum) {
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

// Whether a member has ever paid into this group — removing a member who
// already has payment history would silently orphan that history from the
// group's membership list, so removal is only offered while this is false.
export function memberHasPaidInGroup(gid, group, mid) {
  for (var m = 1; m <= group.currentMonth; m++) {
    var p = (paymentsCache.get(monthKey(gid, m)) || {})[mid];
    if (p && p.paid) return true;
  }
  return false;
}

// Rebuilds state.balances / state.ledgerEntries / state.pendingApprovals
// from the current caches. Pure data — does not render.
export function recompute() {
  var totalA = 0, totalB = 0;
  var ledger = [];
  var approvals = [];

  groupsById.forEach(function (group, gid) {
    for (var m = 1; m <= group.durationMonths; m++) {
      var hasData = monthsCache.has(monthKey(gid, m)) || (paymentsCache.get(monthKey(gid, m)) && Object.keys(paymentsCache.get(monthKey(gid, m))).length);
      if (!hasData) continue;
      var f = monthFinances(gid, group, m);
      totalA += f.finalA; totalB += f.finalB;

      var mLabel = monthLabel(group.startYear, group.startMonthIndex, m);

      if (f.closed) {
        var winner = (membersByGroup.get(gid) || []).find(function (mm) { return mm.id === f.monthDoc.winnerId; });
        ledger.push({
          group: group.name, type: 'payout',
          title: 'Payout — ' + group.name + ' ' + mLabel,
          subtitle: 'Paid to ' + (winner ? winner.name : '—') + ' by ' + adminName(f.monthDoc.payoutAdmin) + ' · ' + (f.monthDoc.closedLabel || ''),
          amountFormatted: '−' + fmt(f.payoutAmount), amountColor: '#1c1b19'
        });
        ledger.push({
          group: group.name, type: 'collection',
          title: 'Collection — ' + group.name + ' ' + mLabel,
          subtitle: f.paidCount + ' members paid · ' + (f.monthDoc.closedLabel || ''),
          amountFormatted: '+' + fmt(f.totalCollected), amountColor: '#146b52'
        });
      } else if (group.currentMonth === m) {
        ledger.push({
          group: group.name, type: 'collection',
          title: 'Collection — ' + group.name + ' ' + mLabel + ' (in progress)',
          subtitle: f.paidCount + ' members paid so far',
          amountFormatted: '+' + fmt(f.totalCollected), amountColor: '#146b52'
        });
      }
      if (f.net) {
        ledger.push({
          group: group.name, type: 'transfer',
          title: 'Transfer — ' + group.name + ' ' + mLabel,
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
}
