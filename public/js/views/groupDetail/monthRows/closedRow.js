import { fmt, escapeHtml, monthLabel, adminName } from '../../../helpers.js';
import { iconTrophy } from '../../../icons.js';
import { adminAmountSpan, rightMoneyColumn, lifecycleBadge, payoutStatusPill, collectedStatusPill } from './shared.js';

// A closed month's row and its trend-sparkline entry. `f` is that month's
// monthFinances() result and `monthPct` its raw (unclamped) paid percentage.
export function renderClosedMonthRow(gid, group, m, f, members, monthPct) {
  // Almost always one winner; occasionally more than one (see
  // getMonthWinners in finance/shared.js) — join their names for the subtitle.
  var winnerNames = f.winners.map(function (w) {
    var mm = members.find(function (x) { return x.id === w.memberId; });
    return mm ? mm.name : '—';
  });
  var unpaidCount = members.length - f.paidCount;
  // A closed month can still have unpaid dues (a late/missed payment) —
  // that's the one thing that still earns the avatar circle its own
  // warning color; the payout badge below carries its own color
  // independently now (payoutStatusPill), so the two can no longer be
  // collapsed into one "which color wins" decision the way they used to.
  var hasUnpaid = unpaidCount > 0;
  // Winner names get the same gold used for "this month's winner"
  // everywhere else (month detail, dashboard), the payout split gets
  // each admin's own color (matching the "X holds" stat cells above) —
  // two distinct facts, two distinct colors, with overall status now
  // living in the badge row rather than tinting the whole card.
  var winnerNamesHtml = winnerNames.length
    ? winnerNames.map(function (n) { return '<span style="color:var(--color-gold);font-weight:600;">' + escapeHtml(n) + '</span>'; }).join(', ')
    : '—';
  var winnerLine = winnerNames.length ? '<div style="display:flex;align-items:center;gap:4px;">' + iconTrophy('var(--color-gold)') + (winnerNames.length > 1 ? 'Winners: ' : 'Winner: ') + winnerNamesHtml + '</div>' : '';
  // f.payoutAmount is the TARGET (sum of every winner's payoutAmount),
  // not what's actually gone out — a winner added after close, or any
  // partial contribution, can leave the target well above the real
  // paid total (see monthDetail/summary.js's same fix). The right-hand
  // column's "Payout" figure needs the real total, not the target.
  var payoutPaidTotal = f.payoutPaidA + f.payoutPaidB;
  var paidByParts = [];
  if (f.payoutPaidA > 0) paidByParts.push(adminAmountSpan('A', adminName('A') + (f.payoutPaidB > 0 ? ' (' + fmt(f.payoutPaidA) + ')' : '')));
  if (f.payoutPaidB > 0) paidByParts.push(adminAmountSpan('B', adminName('B') + (f.payoutPaidA > 0 ? ' (' + fmt(f.payoutPaidB) + ')' : '')));
  var payoutByLine = paidByParts.length ? '<div>Paid by ' + paidByParts.join(' + ') + '</div>' : '';
  // One badge row, one color language: lifecycle (Open/Closed), payout
  // status (not started/partway/done, the same pill the winner card
  // uses), and collection status (collectedStatusPill: "Collected in
  // full" or the unpaid-dues warning) — three independent facts, each
  // reading clearly on its own instead of fighting for one row-wide tint.
  var badgesLine = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">' + lifecycleBadge('closed') + payoutStatusPill(f) + collectedStatusPill(hasUnpaid, unpaidCount) + '</div>';
  // The trend sparkline uses one rule everywhere it appears (here,
  // the dashboard, and the per-member charts): green once every due
  // is in, red if anything's outstanding — regardless of the row's
  // own richer badge styling above.
  var trend = { m: m, pct: monthPct, color: hasUnpaid ? 'var(--color-danger)' : 'var(--color-success)' };
  var html = '<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '">' +
    '<div class="avatar sm" style="background:' + (hasUnpaid ? 'var(--color-warning-soft)' : 'var(--color-success-soft)') + '; color:' + (hasUnpaid ? 'var(--color-warning)' : 'var(--color-success)') + ';">' + m + '</div>' +
    '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">' + monthLabel(group.startYear, group.startMonthIndex, m) + '</div>' +
    '<div style="display:flex;flex-direction:column;gap:2px;font-size:11.5px;color:var(--color-text-muted);margin-top:2px;">' + winnerLine + payoutByLine + '</div>' +
    badgesLine +
    '</div>' +
    rightMoneyColumn(f.totalCollected, payoutPaidTotal) +
  '</div>';
  return { html: html, trend: trend };
}
