import { fmt, adminDot, adminAvatarColor } from '../../../helpers.js';
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
