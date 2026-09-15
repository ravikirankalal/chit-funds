import { fmt, escapeHtml, monthLabel, adminName } from '../../../helpers.js';
import { iconTrophy } from '../../../icons.js';
import { adminAmountSpan, rightMoneyColumn } from './shared.js';

// A closed month's row and its trend-sparkline entry. `f` is that month's
// monthFinances() result and `monthPct` its raw (unclamped) paid percentage.
export function renderClosedMonthRow(gid, group, m, f, members, monthPct) {
  // Almost always one winner; occasionally more than one (see
  // getMonthWinners in finance.js) — join their names for the subtitle.
  var winnerNames = f.winners.map(function (w) {
    var mm = members.find(function (x) { return x.id === w.memberId; });
    return mm ? mm.name : '—';
  });
  var unpaidCount = members.length - f.paidCount;
  // A closed month can still have unpaid dues (a late/missed payment) —
  // flag those with the amber "warning" palette instead of the usual
  // green closed styling, so it's obvious at a glance which closed
  // months still need follow-up.
  var hasUnpaid = unpaidCount > 0;
  var closedBg = hasUnpaid ? 'var(--color-warning-soft)' : 'var(--color-success-soft)';
  var closedFg = hasUnpaid ? 'var(--color-warning)' : 'var(--color-success)';
  // Which admin handed the winner the payout — same field month
  // detail's closed summary shows, surfaced here too so it doesn't
  // take an extra tap to see who paid out a given month. Split
  // across its own lines rather than crammed into one subtitle —
  // a winner list, the payout split, and the unpaid count are three
  // separate facts, each worth its own line now that a payout can
  // be a genuine split rather than always "by one admin".
  // Winner names get the same gold used for "this month's winner"
  // everywhere else (month detail, dashboard), the payout split gets
  // each admin's own color (matching the "X holds" stat cells above),
  // and an unpaid warning always reads as warning-amber regardless of
  // the row's own closed/warning background — three distinct facts,
  // three distinct colors, instead of one blanket tone for all of them.
  var winnerNamesHtml = winnerNames.length
    ? winnerNames.map(function (n) { return '<span style="color:var(--color-gold);font-weight:600;">' + escapeHtml(n) + '</span>'; }).join(', ')
    : '—';
  var winnerLine = '<div style="display:flex;align-items:center;gap:4px;">' + iconTrophy('var(--color-gold)') + (winnerNames.length > 1 ? 'Winners: ' : 'Winner: ') + winnerNamesHtml + '</div>';
  var paidByParts = [];
  if (f.payoutPaidA > 0) paidByParts.push(adminAmountSpan('A', adminName('A') + (f.payoutPaidB > 0 ? ' (' + fmt(f.payoutPaidA) + ')' : '')));
  if (f.payoutPaidB > 0) paidByParts.push(adminAmountSpan('B', adminName('B') + (f.payoutPaidA > 0 ? ' (' + fmt(f.payoutPaidB) + ')' : '')));
  var payoutByLine = paidByParts.length ? '<div>Paid by ' + paidByParts.join(' + ') + '</div>' : '';
  var unpaidLine = hasUnpaid ? '<div style="color:var(--color-warning);font-weight:600;">' + unpaidCount + ' member' + (unpaidCount === 1 ? '' : 's') + ' still unpaid</div>' : '';
  // The trend sparkline uses one rule everywhere it appears (here,
  // the dashboard, and the per-member charts): green once every due
  // is in, red if anything's outstanding — regardless of the row's
  // own richer open/closed/warning styling above.
  var trend = { m: m, pct: monthPct, color: hasUnpaid ? 'var(--color-danger)' : 'var(--color-success)' };
  var html = '<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '"' + (hasUnpaid ? ' style="border-color:' + closedFg + ';"' : '') + '>' +
    '<div class="avatar sm" style="background:' + closedBg + '; color:' + closedFg + ';">' + m + '</div>' +
    '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">' + monthLabel(group.startYear, group.startMonthIndex, m) + '</div>' +
    '<div style="display:flex;flex-direction:column;gap:2px;font-size:11.5px;color:var(--color-text-muted);margin-top:2px;">' + winnerLine + payoutByLine + unpaidLine + '</div></div>' +
    rightMoneyColumn(f.totalCollected, f.payoutAmount) +
  '</div>';
  return { html: html, trend: trend };
}
