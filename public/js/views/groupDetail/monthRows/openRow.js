import { fmt, escapeHtml, monthLabel, adminName } from '../../../helpers.js';
import { iconTrophy } from '../../../icons.js';
import { adminAmountSpan, rightMoneyColumn, lifecycleBadge, payoutStatusPill } from './shared.js';

// The current (open) month's row and its trend-sparkline entry. `f` is
// that month's monthFinances() result.
export function renderOpenMonthRow(gid, group, m, f, members) {
  var pct = members.length > 0 ? Math.min(100, Math.round((f.paidCount / members.length) * 100)) : 0;
  var trend = { m: m, pct: pct, color: pct === 100 ? 'var(--color-success)' : 'var(--color-danger)' };
  var rowSubtitle = f.paidCount + ' / ' + members.length + ' paid so far';
  // One badge row, same color language as the closed row and the winner
  // card's own status pill: lifecycle (always "Open" here) plus payout
  // status once there's a winner — not started/partway/done — instead of
  // one gold wash over the whole card the moment ANY payout activity
  // starts. That wash used to only trigger once money had actually moved
  // (payoutPaidA/B > 0), so a winner picked but not yet paid still read
  // as plain "Open" — a different, inconsistent rule from the closed
  // row's "pending the moment it's not fully covered." Both rows now
  // read off the same payoutStatusPill.
  var badgesLine = '<div style="display:flex;flex-wrap:wrap;gap:6px;">' + lifecycleBadge('open') + payoutStatusPill(f) + '</div>';
  // Once there's a winner, show a fuller picture than the collection
  // bar alone: who won (gold, matching the winner styling used
  // everywhere else), each admin's own contribution so far in their
  // own color, and a second progress bar tracking the payout itself —
  // a genuinely different number from "% collected" now that a
  // payout can be split and can lag behind collection instead of
  // always trailing it in lockstep.
  var winnerRows = f.winners.map(function (w) {
    var mm = members.find(function (x) { return x.id === w.memberId; });
    return '<div style="display:flex;justify-content:space-between;gap:8px;">' +
      '<span style="display:flex;align-items:center;gap:4px;min-width:0;color:var(--color-gold);font-weight:600;">' + iconTrophy('var(--color-gold)') + (mm ? escapeHtml(mm.name) : '—') + '</span>' +
      '<span class="mono" style="flex-shrink:0;color:var(--color-accent);font-weight:700;">' + fmt(w.payoutAmount) + '</span>' +
    '</div>';
  }).join('');
  var payoutPaidTotal = f.payoutPaidA + f.payoutPaidB;
  var payoutPct = f.payoutAmount > 0 ? Math.min(100, Math.round((payoutPaidTotal / f.payoutAmount) * 100)) : 0;
  var payoutSection = f.winners.length
    ? '<div style="display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:var(--color-text-muted);padding-top:2px;">' +
        winnerRows +
        (payoutPaidTotal > 0
          ? '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">' +
              '<span style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
                adminAmountSpan('A', adminName('A') + ': ' + fmt(f.payoutPaidA)) +
                adminAmountSpan('B', adminName('B') + ': ' + fmt(f.payoutPaidB)) +
              '</span>' +
              '<span style="flex-shrink:0;color:var(--color-gold-strong);font-weight:600;">' + payoutPct + '% paid out</span>' +
            '</div>' +
            '<div class="progress-track"><div class="progress-fill" style="width:' + payoutPct + '%; background:var(--color-gold);"></div></div>'
          : '') +
      '</div>'
    : '';
  var html = '<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '" style="flex-direction:column;align-items:stretch;gap:6px;">' +
    '<div style="display:flex;align-items:center;gap:10px;">' +
      '<div class="avatar sm" style="background:var(--color-secondary-soft); color:var(--color-secondary);">' + m + '</div>' +
      '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">' + monthLabel(group.startYear, group.startMonthIndex, m) + '</div>' +
      '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:1px;">' + rowSubtitle + '</div></div>' +
      rightMoneyColumn(f.totalCollected, f.payoutAmount) +
    '</div>' +
    '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%; background:var(--color-secondary);"></div></div>' +
    badgesLine +
    payoutSection +
  '</div>';
  return { html: html, trend: trend };
}
