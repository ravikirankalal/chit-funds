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
import { fmt, adminName, monthLabel, formatDateTime } from './helpers.js';

// Firestore Timestamps aren't directly comparable — this picks whichever
// of two (possibly absent) timestamps is later, for "latest activity" times.
function laterOf(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  var timeA = typeof a.toDate === 'function' ? a.toDate() : new Date(a);
  var timeB = typeof b.toDate === 'function' ? b.toDate() : new Date(b);
  return timeA >= timeB ? a : b;
}

function toMillis(ts) {
  if (!ts) return 0;
  var d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  var ms = d.getTime();
  return isNaN(ms) ? 0 : ms;
}

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
  var scheduledPayout = (group.payoutSchedule && group.payoutSchedule[monthNum - 1]) || 0;
  var winners = getMonthWinners(monthDoc, scheduledPayout);
  var payoutAmount = winners.length
    ? winners.reduce(function (sum, w) { return sum + (w.payoutAmount || 0); }, 0)
    : scheduledPayout;
  var finalA = adjA, finalB = adjB;
  var closed = !!monthDoc && monthDoc.status === 'closed';
  if (closed) {
    if (monthDoc.payoutAdmin === 'A') finalA -= payoutAmount; else if (monthDoc.payoutAdmin === 'B') finalB -= payoutAmount;
  }
  return {
    monthDoc: monthDoc, paidCount: paidCount, totalCollected: paidCount * group.monthlyDeposit,
    rawA: rawA, rawB: rawB, net: net, adjA: adjA, adjB: adjB,
    winners: winners, payoutAmount: payoutAmount, closed: closed, finalA: finalA, finalB: finalB
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
      var payments = paymentsCache.get(monthKey(gid, m)) || {};
      var hasData = monthsCache.has(monthKey(gid, m)) || Object.keys(payments).length;
      if (!hasData) continue;
      var f = monthFinances(gid, group, m);
      totalA += f.finalA; totalB += f.finalB;

      var mLabel = monthLabel(group.startYear, group.startMonthIndex, m);

      // Latest recorded payment this month — the natural "as of" time for
      // an aggregate collection entry, since there's no single instant a
      // month's collection "happens" (each member pays separately).
      var latestPaidAt = null;
      Object.keys(payments).forEach(function (mid) {
        if (payments[mid].paid) latestPaidAt = laterOf(latestPaidAt, payments[mid].paidAt);
      });

      if (f.closed) {
        var groupMembers = membersByGroup.get(gid) || [];
        var winnerNames = f.winners.map(function (w) {
          var mm = groupMembers.find(function (x) { return x.id === w.memberId; });
          return mm ? mm.name : '—';
        }).join(', ') || '—';
        ledger.push({
          group: group.name, type: 'payout',
          title: 'Payout — ' + group.name + ' ' + mLabel,
          subtitle: 'Paid to ' + winnerNames + ' by ' + adminName(f.monthDoc.payoutAdmin) + ' · ' + (f.monthDoc.closedLabel || ''),
          amountFormatted: '−' + fmt(f.payoutAmount), amountColor: 'var(--color-text)',
          atRaw: f.monthDoc.closedAt, time: formatDateTime(f.monthDoc.closedAt)
        });
        ledger.push({
          group: group.name, type: 'collection',
          title: 'Collection — ' + group.name + ' ' + mLabel,
          subtitle: f.paidCount + ' members paid · ' + (f.monthDoc.closedLabel || ''),
          amountFormatted: '+' + fmt(f.totalCollected), amountColor: 'var(--color-success)',
          atRaw: latestPaidAt, time: formatDateTime(latestPaidAt)
        });
      } else if (group.currentMonth === m) {
        ledger.push({
          group: group.name, type: 'collection',
          title: 'Collection — ' + group.name + ' ' + mLabel + ' (in progress)',
          subtitle: f.paidCount + ' members paid so far',
          amountFormatted: '+' + fmt(f.totalCollected), amountColor: 'var(--color-success)',
          atRaw: latestPaidAt, time: formatDateTime(latestPaidAt)
        });
      }

      // Two independent mechanisms move money between admins for a month:
      // an explicit request-and-accept (monthDoc.transferNet) and a direct
      // hand-off of specific already-collected payments (payment docs with
      // transferred:true — see confirmTransfer in actions.js, which only
      // this second kind stamps with transferredAt). Both already feed the
      // balance math correctly on their own; combined here into one net
      // figure purely so the ledger has a single, complete "money moved
      // this month" line instead of silently omitting the hand-off kind.
      var heldNet = 0, latestTransferredAt = null;
      Object.keys(payments).forEach(function (mid) {
        var p = payments[mid];
        if (p.paid && p.transferred) {
          heldNet += p.collectedBy === 'B' ? group.monthlyDeposit : -group.monthlyDeposit;
          latestTransferredAt = laterOf(latestTransferredAt, p.transferredAt);
        }
      });
      var combinedNet = f.net + heldNet;
      if (combinedNet) {
        ledger.push({
          group: group.name, type: 'transfer',
          title: 'Transfer — ' + group.name + ' ' + mLabel,
          subtitle: combinedNet > 0 ? adminName('A') + ' → ' + adminName('B') : adminName('B') + ' → ' + adminName('A'),
          amountFormatted: fmt(Math.abs(combinedNet)), amountColor: 'var(--color-secondary)',
          atRaw: latestTransferredAt, time: formatDateTime(latestTransferredAt)
        });
      }

      var req = transferReqCache.get(monthKey(gid, m));
      if (req) {
        approvals.push({ groupId: gid, groupName: group.name, month: m, direction: req.direction, amount: req.amount, requestedBy: req.requestedBy });
      }
    }
  });

  // Sort by actual recorded time (most recent first) rather than by
  // group/month iteration order, so activity across different groups
  // interleaves correctly; entries with no timestamp (very old data,
  // or a mechanism that never stored one) sink to the bottom.
  ledger.sort(function (a, b) { return toMillis(b.atRaw) - toMillis(a.atRaw); });

  state.balances = { A: totalA, B: totalB, total: totalA + totalB };
  state.ledgerEntries = ledger;
  state.pendingApprovals = approvals;
}
