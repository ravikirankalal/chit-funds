import { state } from '../../store.js';
import { fmt, escapeHtml, initialsOf, colorFor, adminDot, adminName, monthLabel } from '../../helpers.js';
import { iconTrophy, iconWallet, iconWarningTriangle, iconClock, iconCheck } from '../../icons.js';
import { signed, summaryStat, renderMemberPaymentStrip } from './shared.js';

// True right after a transfer accept succeeds — either on the accepting
// admin's own client (state.ui.handoffAction, set by acceptHandoffRequest)
// or on the sender's client once the listener picks up the accept
// (state.ui.handoffOutgoingSuccess; see handoffOutgoingSuccess in
// listeners.js and its success card in handoffRequests.js). Both admins'
// "holds" figures just moved on both screens — one went up, the other down
// by the same amount, since both are derived from who currently holds each
// payment — so both stat cards below get a one-shot flash (see .stat.flash
// in components.css) tying them back to whichever success confirmation is
// sitting just above this card. Scoped to the month actually being viewed,
// since handoffOutgoingSuccess isn't tied to which month/group is on screen
// the way handoffAction effectively is.
function justAcceptedTransfer(gid, viewMonth) {
  var a = state.ui.handoffAction;
  if (a && a.phase === 'success' && a.action === 'accept') return true;
  var o = state.ui.handoffOutgoingSuccess;
  return !!(o && o.gid === gid && o.m === viewMonth);
}

// The single color behind both the status pill and the paid-so-far figure
// below — not started / partway / done, kept as one lookup so the two
// never drift apart into showing different colors for the same fact.
function winnerStatusColor(w) {
  if (w.remaining <= 0) return 'var(--color-success)';
  if ((w.paidByA || 0) > 0 || (w.paidByB || 0) > 0) return 'var(--color-gold-strong)';
  return 'var(--color-text-muted)';
}

// One glance, one fact: not started / partway / done, each its own color
// so status reads without parsing a sentence — same pill shape as the
// paid/unpaid tag in paymentList.js, for the same reason (a color + a
// short label beats a longer, differently-styled string per state).
function winnerStatusPill(w) {
  var color = winnerStatusColor(w);
  if (w.remaining <= 0) {
    return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:20px;background:var(--color-success-soft);color:' + color + ';">' + iconCheck(color) + 'Paid in full</span>';
  }
  if ((w.paidByA || 0) > 0 || (w.paidByB || 0) > 0) {
    return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:20px;background:var(--color-gold-soft);color:' + color + ';">' + iconClock(color) + fmt(w.remaining) + ' due</span>';
  }
  return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:20px;background:var(--color-border);color:' + color + ';">' + iconClock(color) + 'Not paid yet</span>';
}

// Per-winner, not the month-level payoutByLabel (finance/shared.js) — a
// winner added via "Add another winner" AFTER the month closed starts out
// completely unpaid, and paidByA/paidByB can sit below payoutAmount for a
// while even on a closed month (openPayoutModal/setPayoutContribution in
// actions/winners/payout.js let a contribution be recorded for them same as
// any other winner). The status pill already covers "how much is left";
// this is only the "who paid what" breakdown — one line per admin, right
// under the total they're each chipping away at, rather than joined into
// one "X + Y" sentence off to the side. Skipped entirely once there's
// nothing paid yet, since the pill alone already says that.
function winnerContribLines(w) {
  var lines = [];
  if (w.paidByA > 0) lines.push('<div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;font-size:10.5px;color:var(--color-text-muted);margin-top:3px;">' + adminDot('A') + escapeHtml(adminName('A')) + ' ' + fmt(w.paidByA) + '</div>');
  if (w.paidByB > 0) lines.push('<div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;font-size:10.5px;color:var(--color-text-muted);margin-top:3px;">' + adminDot('B') + escapeHtml(adminName('B')) + ' ' + fmt(w.paidByB) + '</div>');
  return lines.join('');
}

// The one place a winner is shown, open month or closed — each gets their
// own card (almost always just one; occasionally more, see getMonthWinners
// in finance/shared.js) with their payout status, and a Remove link right
// on it for as long as removeWinner (actions/winners/picker.js) itself
// would still allow it: no contribution recorded toward them yet. A month
// being closed doesn't change any of this — an admin can still add a
// winner they missed, same as late payments are still editable post-close.
//
// The card itself opens the payout modal (replacing the separate "Record
// payout" card that used to repeat the same name/amount just to be
// tappable) whenever there's still something a contribution could do here
// — which is exactly the same guard openPayoutModal itself enforces
// (actions/winners/payout.js): once the month is closed AND this specific
// winner is fully covered, there's nothing left to record. Hidden during a
// transfer selection too, same as Remove — neither has anything to do with
// handing off payments, and would just compete with the floating transfer
// bar for attention.
function renderWinnerTopCards(f, members, readOnly) {
  return f.winners.map(function (w) {
    var winner = members.find(function (mm) { return mm.id === w.memberId; });
    var winnerIdx = winner ? members.indexOf(winner) : -1;
    var contribLines = winnerContribLines(w);
    var paidSoFar = (w.paidByA || 0) + (w.paidByB || 0);
    var statusColor = winnerStatusColor(w);
    var interactive = !readOnly && !state.ui.transferSelection;
    var removable = interactive && !((w.paidByA || 0) > 0 || (w.paidByB || 0) > 0);
    var openable = interactive && !(f.closed && w.remaining <= 0);
    var openAttr = openable ? ' data-action="open-payout-modal" data-mid="' + w.memberId + '"' : '';
    // The trophy used to be a tiny 14px glyph next to a text label ("This
    // month's winner"/"Winner") above the name — easy to miss, and the
    // label repeated what the card's whole position already says. A
    // bigger trophy badge overlapping the avatar's corner (medal-on-a-
    // photo, the same idea as a verified badge) reads as "winner" at a
    // glance without spending a text line on it — freeing that line for
    // the status pill below, which is the fact that actually changes.
    var avatarHtml = winner ? (
      '<div style="position:relative;flex-shrink:0;">' +
        '<div class="avatar" style="background:' + colorFor(winnerIdx) + ';box-shadow:0 0 0 2px var(--color-surface);">' + initialsOf(winner.name) + '</div>' +
        '<div style="position:absolute;right:-4px;bottom:-4px;width:22px;height:22px;border-radius:50%;background:var(--color-gold);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--color-surface);">' + iconTrophy('var(--on-brand)', 13) + '</div>' +
      '</div>'
    ) : '';
    return '<div class="card"' + openAttr + ' style="display:flex;align-items:center;gap:12px;position:relative;overflow:hidden;">' +
      '<div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--color-gold);"></div>' +
      avatarHtml +
      '<div style="flex:1 1 auto; min-width:0;">' +
        '<div style="font-size:16px;font-weight:700;">' + (winner ? escapeHtml(winner.name) : '—') + '</div>' +
        '<div style="margin-top:4px;">' + winnerStatusPill(w) + '</div>' +
      '</div>' +
      '<div style="text-align:right; flex-shrink:0;">' +
        '<div style="font-size:11px;color:var(--color-text-muted);">Payout</div>' +
        '<div class="mono" style="font-size:18px;font-weight:700;"><span style="color:' + statusColor + ';">' + fmt(paidSoFar) + '</span> <span style="font-size:12px;color:var(--color-text-muted);font-weight:400;">/ ' + fmt(w.payoutAmount) + '</span></div>' +
        contribLines +
        (removable ? '<div data-action="remove-winner" data-mid="' + w.memberId + '" style="cursor:pointer;color:var(--color-danger);font-size:11px;font-weight:600;margin-top:4px;">Remove</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

export function renderClosedSummary(f, members, readOnly, gid, viewMonth) {
  var unpaidCount = members.length - f.paidCount;
  // f.payoutAmount is the target — the sum of every winner's payoutAmount,
  // whether or not it's actually been handed over yet. A winner added via
  // "Add another winner" after the month closed (picker.js's addWinner)
  // can sit fully or partially unpaid on an otherwise-closed month, so the
  // target and what's actually gone out can genuinely differ here — use
  // the real paid total for both the stat and the profit it feeds into.
  var payoutSoFar = (f.payoutPaidA || 0) + (f.payoutPaidB || 0);
  var closedProfit = f.totalCollected - payoutSoFar;
  var closedProfitColor = closedProfit < 0 ? 'var(--color-danger)' : 'var(--color-success)';
  var winnerCards = renderWinnerTopCards(f, members, readOnly) || '<div class="card" style="color:var(--color-text-muted);font-size:13px;text-align:center;">No winner recorded.</div>';

  return '<div style="display:flex;flex-direction:column;gap:10px;">' +
    (unpaidCount > 0
      // A closed month with dues still outstanding is routine, not an
      // emergency — a full alert-colored banner block overstated it, so
      // this is just a quiet one-line note now, not a "warn" banner.
      ? '<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--color-text-muted);padding:0 2px;">' + iconWarningTriangle('var(--color-warning)') + unpaidCount + ' member' + (unpaidCount === 1 ? '' : 's') + ' still unpaid — tap below to record.</div>'
      : '') +
    winnerCards +
    '<div class="card">' + renderMemberPaymentStrip(gid, viewMonth, members) + '</div>' +
    '<div class="card" style="display:flex;">' +
      summaryStat(iconWallet() + 'Collections', '<span style="color:var(--color-primary);">' + fmt(f.totalCollected) + '</span>') +
      summaryStat('Payouts', '<span style="color:var(--color-accent);">' + fmt(payoutSoFar) + '</span>', true) +
      summaryStat('Profit', '<span style="color:' + closedProfitColor + ';">' + signed(closedProfit) + '</span>', true) +
    '</div>' +
    '<div class="stat-row">' +
      '<div class="stat' + (justAcceptedTransfer(gid, viewMonth) ? ' flash' : '') + '"><div class="label">' + adminDot('A') + escapeHtml(adminName('A')) + ' holds</div><div class="value" style="' + (f.finalA < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(f.finalA) + '</div><div style="font-size:10.5px;color:var(--color-text-muted);margin-top:1px;">' + f.paidCountA + ' member' + (f.paidCountA === 1 ? '' : 's') + ' collected</div></div>' +
      '<div class="stat' + (justAcceptedTransfer(gid, viewMonth) ? ' flash' : '') + '"><div class="label">' + adminDot('B') + escapeHtml(adminName('B')) + ' holds</div><div class="value" style="' + (f.finalB < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(f.finalB) + '</div><div style="font-size:10.5px;color:var(--color-text-muted);margin-top:1px;">' + f.paidCountB + ' member' + (f.paidCountB === 1 ? '' : 's') + ' collected</div></div>' +
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
  // Same fix as renderClosedSummary above — f.payoutAmount is the target,
  // not what's actually gone out; use the real paid total here too.
  var payoutSoFar = (f.payoutPaidA || 0) + (f.payoutPaidB || 0);
  var openProfit = f.totalCollected - payoutSoFar;
  var openProfitColor = openProfit < 0 ? 'var(--color-danger)' : 'var(--color-success)';
  // Same per-winner card a closed month shows, and for the same reason: once
  // a winner is picked, their payout status and Remove link live here, not
  // in a second, separate "this month's winner" section further down.
  var winnerCards = renderWinnerTopCards(f, members, readOnly);
  return '<div style="display:flex;flex-direction:column;gap:10px;">' +
    winnerCards +
    '<div class="card" style="display:flex;flex-direction:column;gap:10px;">' +
      '<div style="display:flex;">' +
        summaryStat(iconWallet() + 'Collections', '<span style="color:var(--color-primary);">' + fmt(f.totalCollected) + '</span> <span style="font-size:12px;color:var(--color-text-muted);font-weight:400;">/ ' + fmt(expected) + '</span>') +
        summaryStat(iconTrophy() + 'Payout', '<span style="color:var(--color-accent);">' + fmt(payoutSoFar) + '</span> <span style="font-size:12px;color:var(--color-text-muted);font-weight:400;">/ ' + fmt(setupPayout) + '</span>', true) +
        summaryStat('Profit', '<span style="color:' + openProfitColor + ';">' + signed(openProfit) + '</span>', true) +
      '</div>' +
      '<div>' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><div style="font-size:11px;color:var(--color-text-muted);">' + f.paidCount + ' / ' + members.length + ' paid</div><div style="font-size:11px;color:var(--color-text-muted);font-weight:600;">' + pct + '%</div></div>' +
        '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;"></div></div>' +
      '</div>' +
      renderMemberPaymentStrip(gid, viewMonth, members) +
      '<div class="stat-row">' +
        '<div class="stat' + (justAcceptedTransfer(gid, viewMonth) ? ' flash' : '') + '"><div class="label">' + adminDot('A') + escapeHtml(adminName('A')) + ' holds</div><div class="value" style="' + (f.adjA < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(f.adjA) + '</div><div style="font-size:10.5px;color:var(--color-text-muted);margin-top:1px;">' + f.paidCountA + ' member' + (f.paidCountA === 1 ? '' : 's') + ' collected</div></div>' +
        '<div class="stat' + (justAcceptedTransfer(gid, viewMonth) ? ' flash' : '') + '"><div class="label">' + adminDot('B') + escapeHtml(adminName('B')) + ' holds</div><div class="value" style="' + (f.adjB < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(f.adjB) + '</div><div style="font-size:10.5px;color:var(--color-text-muted);margin-top:1px;">' + f.paidCountB + ' member' + (f.paidCountB === 1 ? '' : 's') + ' collected</div></div>' +
      '</div>' +
    '</div>' +
  '</div>';
}
