import { fmt, adminDot, adminAvatarColor } from '../../../helpers.js';
import { iconCheck, iconClock, iconWarningTriangle } from '../../../icons.js';
import { signed } from '../shared.js';

// An admin's own dot + label, colored in that admin's avatar color — reused
// wherever a per-admin figure (a payout split, who paid what) needs to read
// as belonging to that admin at a glance, the same visual language as the
// "X holds" stat cells on the stats card.
export function adminAmountSpan(id, label) {
  return '<span style="display:inline-flex;align-items:center;gap:4px;color:' + adminAvatarColor(id) + ';font-weight:600;white-space:nowrap;">' + adminDot(id) + label + '</span>';
}

// The right-hand column of a month row — profit as the headline (the
// number a row gets tapped open to check), collected and payout below it
// as supporting detail. Collection and payout are fixed colors (blue and
// red — each reads as "this kind of figure" regardless of amount), but
// profit is sign-dependent like the profit-margin figure on the
// create-group screen: red when the month ran at a loss, green otherwise.
export function rightMoneyColumn(collected, payout) {
  var profit = collected - payout;
  var profitColor = profit < 0 ? 'var(--color-danger)' : 'var(--color-success)';
  return '<div style="text-align:right; flex-shrink:0;">' +
    '<div style="font-size:13px;font-weight:700;color:' + profitColor + ';">' + signed(profit) + '</div>' +
    '<div style="font-size:10px;color:var(--color-text-muted);margin-top:2px;white-space:nowrap;">Collected <span class="mono" style="color:var(--color-primary);font-weight:700;">' + fmt(collected) + '</span></div>' +
    '<div style="font-size:10px;color:var(--color-text-muted);margin-top:1px;white-space:nowrap;">Payout <span class="mono" style="color:var(--color-danger);font-weight:700;">−' + fmt(payout) + '</span></div>' +
  '</div>';
}


// A month's lifecycle state — Open or Closed — as a small colored pill
// instead of inline colored text tacked onto the month label. Kept
// separate from payout status below: a month can be open with a winner
// fully paid out already, or closed with a payout still outstanding, so
// conflating the two into one color (as the row used to) hid one fact
// behind the other.
export function lifecycleBadge(kind) {
  var color = kind === 'closed' ? 'var(--color-success)' : 'var(--color-secondary)';
  var bg = kind === 'closed' ? 'var(--color-success-soft)' : 'var(--color-secondary-soft)';
  return '<span style="display:inline-flex;align-items:center;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:20px;background:' + bg + ';color:' + color + ';">' + (kind === 'closed' ? 'Closed' : 'Open') + '</span>';
}

// The same not-started/partway/done color language as the winner card's
// own status pill (monthDetail/summary.js's winnerStatusPill) — a month
// row and a winner card should never disagree about what "payout
// pending" looks like. Used by both the open and closed row, since a
// winner needing payout is the same fact regardless of whether the month
// itself has closed yet — that's what open and closed rows used to get
// wrong, each computing "pending" a different way.
export function payoutStatusPill(f) {
  if (!f.winners.length) return '';
  if (f.allPayoutCovered) {
    return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:20px;background:var(--color-success-soft);color:var(--color-success);">' + iconCheck('var(--color-success)') + 'Paid in full</span>';
  }
  var remaining = f.payoutAmount - f.payoutPaidA - f.payoutPaidB;
  if (f.payoutPaidA > 0 || f.payoutPaidB > 0) {
    return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:20px;background:var(--color-gold-soft);color:var(--color-gold-strong);">' + iconClock('var(--color-gold-strong)') + fmt(remaining) + ' due</span>';
  }
  return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:20px;background:var(--color-border);color:var(--color-text-muted);">' + iconClock('var(--color-text-muted)') + 'Payout pending</span>';
}

// A closed month can still have unpaid dues (a late/missed payment) —
// always amber regardless of the payout pill's own color, since "money
// still owed IN" and "payout status" are unrelated facts that happen to
// both show up on the same row. Worded as "due unpaid" (not bare
// "unpaid") and given its own warning-triangle icon — sitting right next
// to a "Closed"/"Paid in full" pair, a plain "unpaid" reads as
// contradicting them; this is about a member's monthly deposit, not the
// month's own lifecycle or the winner's payout.
export function unpaidPill(count) {
  return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:20px;background:var(--color-warning-soft);color:var(--color-warning);">' + iconWarningTriangle('var(--color-warning)', 11) + count + ' due unpaid</span>';
}

// The collection side's own always-shown pill, mirroring payoutStatusPill's
// "Paid in full" — dues were previously only called out when something was
// STILL owed (unpaidPill above), so a fully-collected closed month showed
// nothing here at all, leaving "Closed"/"Paid in full" looking like the
// whole story when there was a third fact (dues) that just happened to be
// good news. Same success color/icon "Paid in full" already uses.
export function collectedStatusPill(hasUnpaid, unpaidCount) {
  if (hasUnpaid) return unpaidPill(unpaidCount);
  return '<span style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:20px;background:var(--color-success-soft);color:var(--color-success);">' + iconCheck('var(--color-success)') + 'Collected in full</span>';
}
