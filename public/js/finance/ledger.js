import {
  state, groupsById, membersByGroup, paymentsCache, monthsCache, transferReqCache, handoffReqCache, monthKey
} from '../store.js';
import { fmt, adminName, monthLabel, formatDateTime } from '../helpers.js';
import { monthFinances } from './monthFinances.js';
import { payoutByLabel } from './shared.js';

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
          subtitle: 'Paid to ' + winnerNames + ' by ' + (payoutByLabel(f) || '—') + ' · ' + (f.monthDoc.closedLabel || ''),
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
      // transferred:true — see confirmTransfer in actions/handoffs.js, which only
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
        approvals.push({ kind: 'transfer', groupId: gid, groupName: group.name, month: m, direction: req.direction, amount: req.amount, requestedBy: req.requestedBy });
      }

      // Each pending hand-off (see confirmTransfer/acceptHandoffRequest in
      // actions/handoffs.js) is its own request, keyed by reqId so accept/decline/
      // cancel can target the right one when more than one is in flight.
      var handoffReqs = handoffReqCache.get(monthKey(gid, m)) || {};
      Object.keys(handoffReqs).forEach(function (reqId) {
        var hreq = handoffReqs[reqId];
        approvals.push({ kind: 'handoff', groupId: gid, groupName: group.name, month: m, amount: hreq.amount, requestedBy: hreq.requestedBy, from: hreq.from, to: hreq.to, reqId: reqId, count: (hreq.mids || []).length });
      });
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
