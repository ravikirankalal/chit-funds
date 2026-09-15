import { ADMINS } from '../../../firebase-config.js';
import { fmt, escapeHtml, initialsOf, colorFor, adminDot, adminName, monthLabel } from '../../helpers.js';
import { iconTrophy, iconWallet, iconWarningTriangle, iconClock, iconCheck } from '../../icons.js';
import { signed, summaryStat, renderMemberPaymentStrip } from './shared.js';

// Per-winner, not the month-level payoutByLabel (finance/shared.js) — a
// winner added via "Add another winner" AFTER the month closed starts out
// completely unpaid (openPayoutModal refuses once status is 'closed', so
// today there's no way to record a contribution for one — see the winner
// card's own note below), so paidByA/paidByB can genuinely sit below
// payoutAmount even on a closed month. Surfacing that per-card, not just
// the month's aggregate, is what makes a partial/unpaid winner visible.
function winnerPaidLine(w) {
  var parts = [];
  if (w.paidByA > 0) parts.push(adminName('A') + ' ' + fmt(w.paidByA));
  if (w.paidByB > 0) parts.push(adminName('B') + ' ' + fmt(w.paidByB));
  var paidLabel = parts.join(' + ');
  var paidHtml = paidLabel ? 'Paid out by <span style="font-weight:700;color:var(--color-text);">' + escapeHtml(paidLabel) + '</span>' : '';
  if (w.remaining <= 0) return paidHtml;
  var remainingHtml = '<span style="font-weight:700;color:var(--color-gold);">' + fmt(w.remaining) + ' remaining</span>';
  return paidHtml ? paidHtml + ' · ' + remainingHtml : 'Not yet paid out · ' + remainingHtml;
}

export function renderClosedSummary(f, members, readOnly, gid, viewMonth) {
  var unpaidCount = members.length - f.paidCount;
  var closedProfit = f.totalCollected - f.payoutAmount;
  var closedProfitColor = closedProfit < 0 ? 'var(--color-danger)' : 'var(--color-success)';
  // Almost always exactly one winner — this loop renders identically to the
  // old single-card layout in that case. A closed month occasionally has
  // more than one (see getMonthWinners in finance/shared.js), each with its own
  // payout amount. A closed month isn't frozen — an admin can still add a
  // winner they missed, same as late payments are still editable post-close.
  var winnerCards = f.winners.map(function (w) {
    var winner = members.find(function (mm) { return mm.id === w.memberId; });
    var winnerIdx = winner ? members.indexOf(winner) : -1;
    var paidLine = winnerPaidLine(w);
    return '<div class="card" style="display:flex;align-items:center;gap:12px;position:relative;overflow:hidden;">' +
      '<div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--color-gold);"></div>' +
      (winner ? '<div class="avatar" style="background:' + colorFor(winnerIdx) + ';box-shadow:0 0 0 2px var(--color-surface),0 0 0 3.5px var(--color-gold);">' + initialsOf(winner.name) + '</div>' : '') +
      '<div style="flex:1 1 auto; min-width:0;">' +
        '<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--color-gold);font-weight:600;">' + iconTrophy('var(--color-gold)') + (f.winners.length > 1 ? 'Winner' : 'This month\'s winner') + '</div>' +
        '<div style="font-size:16px;font-weight:700;">' + (winner ? escapeHtml(winner.name) : '—') + '</div>' +
        (paidLine ? '<div style="font-size:11px;color:var(--color-text-muted);margin-top:2px;">' + paidLine + '</div>' : '') +
      '</div>' +
      '<div style="text-align:right; flex-shrink:0;">' +
        '<div style="font-size:11px;color:var(--color-text-muted);">Payout</div>' +
        '<div class="mono" style="font-size:18px;font-weight:700;color:var(--color-gold);">' + fmt(w.payoutAmount) + '</div>' +
      '</div>' +
    '</div>';
  }).join('') || '<div class="card" style="color:var(--color-text-muted);font-size:13px;text-align:center;">No winner recorded.</div>';

  return '<div style="display:flex;flex-direction:column;gap:10px;">' +
    (unpaidCount > 0
      // A closed month with dues still outstanding is routine, not an
      // emergency — a full alert-colored banner block overstated it, so
      // this is just a quiet one-line note now, not a "warn" banner.
      ? '<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--color-text-muted);padding:0 2px;">' + iconWarningTriangle('var(--color-warning)') + unpaidCount + ' member' + (unpaidCount === 1 ? '' : 's') + ' still unpaid — tap below to record.</div>'
      : '') +
    winnerCards +
    '<div class="card">' + renderMemberPaymentStrip(gid, viewMonth, members, readOnly) + '</div>' +
    '<div class="card" style="display:flex;">' +
      summaryStat(iconWallet() + 'Collections', '<span style="color:var(--color-primary);">' + fmt(f.totalCollected) + '</span>') +
      summaryStat('Payouts', '<span style="color:var(--color-accent);">' + fmt(f.payoutAmount) + '</span>', true) +
      summaryStat('Profit', '<span style="color:' + closedProfitColor + ';">' + signed(closedProfit) + '</span>', true) +
    '</div>' +
    '<div class="stat-row">' +
      '<div class="stat"><div class="label">' + adminDot('A') + ADMINS.A.name + ' holds</div><div class="value" style="' + (f.finalA < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(f.finalA) + '</div><div style="font-size:10.5px;color:var(--color-text-muted);margin-top:1px;">' + f.paidCountA + ' member' + (f.paidCountA === 1 ? '' : 's') + ' collected</div></div>' +
      '<div class="stat"><div class="label">' + adminDot('B') + ADMINS.B.name + ' holds</div><div class="value" style="' + (f.finalB < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(f.finalB) + '</div><div style="font-size:10.5px;color:var(--color-text-muted);margin-top:1px;">' + f.paidCountB + ' member' + (f.paidCountB === 1 ? '' : 's') + ' collected</div></div>' +
    '</div>' +
    '<div style="display:flex;align-items:center;justify-content:center;gap:4px;font-size:11px;color:var(--color-text-muted);">' + iconCheck('var(--color-text-muted)') + 'Closed ' + escapeHtml(f.monthDoc.closedLabel || '') + '</div>' +
  '</div>';
}

export function renderUpcomingNotice(group, viewMonth) {
  return '<div class="banner warn"><div class="banner-title">' + iconClock('var(--color-warning)') + 'Not yet open</div>' +
    '<div style="font-size:12.5px;color:var(--color-text-muted);">Opens once ' + monthLabel(group.startYear, group.startMonthIndex, viewMonth - 1) + ' is closed. Scheduled payout: ' + fmt((group.payoutSchedule && group.payoutSchedule[viewMonth - 1]) || 0) + '.</div></div>';
}

export function renderOpenSummary(f, members, group, readOnly, gid, viewMonth) {
  var expected = members.length * group.monthlyDeposit;
  var pct = expected > 0 ? Math.min(100, Math.round((f.totalCollected / expected) * 100)) : 0;
  var setupPayout = (group.payoutSchedule && group.payoutSchedule[viewMonth - 1]) || 0;
  var openProfit = f.totalCollected - f.payoutAmount;
  var openProfitColor = openProfit < 0 ? 'var(--color-danger)' : 'var(--color-success)';
  return '<div class="card" style="display:flex;flex-direction:column;gap:10px;">' +
    '<div style="display:flex;">' +
      summaryStat(iconWallet() + 'Collections', '<span style="color:var(--color-primary);">' + fmt(f.totalCollected) + '</span> <span style="font-size:12px;color:var(--color-text-muted);font-weight:400;">/ ' + fmt(expected) + '</span>') +
      summaryStat(iconTrophy() + 'Payout', '<span style="color:var(--color-accent);">' + fmt(f.payoutAmount) + '</span> <span style="font-size:12px;color:var(--color-text-muted);font-weight:400;">/ ' + fmt(setupPayout) + '</span>', true) +
      summaryStat('Profit', '<span style="color:' + openProfitColor + ';">' + signed(openProfit) + '</span>', true) +
    '</div>' +
    '<div>' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><div style="font-size:11px;color:var(--color-text-muted);">' + f.paidCount + ' / ' + members.length + ' paid</div><div style="font-size:11px;color:var(--color-text-muted);font-weight:600;">' + pct + '%</div></div>' +
      '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;"></div></div>' +
    '</div>' +
    renderMemberPaymentStrip(gid, viewMonth, members, readOnly) +
    '<div class="stat-row">' +
      '<div class="stat"><div class="label">' + adminDot('A') + ADMINS.A.name + ' holds</div><div class="value" style="' + (f.adjA < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(f.adjA) + '</div><div style="font-size:10.5px;color:var(--color-text-muted);margin-top:1px;">' + f.paidCountA + ' member' + (f.paidCountA === 1 ? '' : 's') + ' collected</div></div>' +
      '<div class="stat"><div class="label">' + adminDot('B') + ADMINS.B.name + ' holds</div><div class="value" style="' + (f.adjB < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(f.adjB) + '</div><div style="font-size:10.5px;color:var(--color-text-muted);margin-top:1px;">' + f.paidCountB + ' member' + (f.paidCountB === 1 ? '' : 's') + ' collected</div></div>' +
    '</div>' +
  '</div>';
}
