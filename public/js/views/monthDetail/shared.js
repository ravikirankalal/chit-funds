// Small presentational helpers used by more than one section of the month
// detail screen (summary cards, handoff requests, the payment modal's
// transfer history, the payout modal). Kept here instead of duplicated or
// hoisted into the app-wide helpers.js, since none of this is meaningful
// outside this screen.
import { fmt, escapeHtml } from '../../helpers.js';
import { paymentsCache, monthKey } from '../../store.js';

export function signed(n) { return (n < 0 ? '−' : '') + fmt(Math.abs(n)); }

// One labeled figure in the Collections / Payouts / Profit stats row that
// opens both the open and closed month summary cards — a compact
// label-above-value cell, three of which sit side by side (each flex:1 1 0,
// dividers instead of per-cell chrome) mirroring the same pattern used for
// the group detail screen's stats card.
export function summaryStat(labelHtml, valueHtml, border) {
  return '<div style="flex:1 1 0;min-width:0;' + (border ? 'border-left:1px solid var(--color-border);padding-left:12px;' : '') + '">' +
    '<div style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--color-text-muted);">' + labelHtml + '</div>' +
    '<div class="mono" style="font-size:16px;font-weight:700;margin-top:2px;">' + valueHtml + '</div>' +
  '</div>';
}

export function timelineRow(dotColor, title, status, statusStyle, amount) {
  return '<div style="display:flex;align-items:flex-start;gap:10px;">' +
    '<div style="width:8px;height:8px;border-radius:4px;background:' + dotColor + ';margin-top:5px;flex-shrink:0;"></div>' +
    '<div style="flex:1 1 auto;"><div style="font-size:12.5px;font-weight:500;">' + title + '</div>' +
    '<div style="font-size:11px;' + statusStyle + '">' + status + (amount ? ' · ' + amount : '') + '</div></div></div>';
}

// One bar per member — green/full for paid, red/short for unpaid — a
// visual index into the "X / Y paid" count above, since the count alone
// doesn't say WHICH members are still outstanding without opening the
// payment list below. Mirrors the collection-trend sparkline on the group
// detail screen (public/js/views/groupDetail/statsCard.js), but the per-item value
// here is binary (paid/unpaid) rather than a percentage. Each bar reuses
// the existing 'open-payment-modal' action so tapping one jumps straight
// to that member, same as tapping their row in the payment list.
export function renderMemberPaymentStrip(gid, viewMonth, members, readOnly) {
  if (!members.length) return '';
  var payments = paymentsCache.get(monthKey(gid, viewMonth)) || {};
  var bars = members.map(function (mm) {
    var p = payments[mm.id];
    var paid = !!(p && p.paid);
    var color = paid ? 'var(--color-success)' : 'var(--color-danger)';
    var clickable = !readOnly;
    return '<div' + (clickable ? ' data-action="open-payment-modal" data-mid="' + mm.id + '"' : '') +
      ' title="' + escapeHtml(mm.name) + ': ' + (paid ? 'Paid' : 'Unpaid') + '"' +
      ' style="flex:1 1 0;min-width:2px;height:20px;display:flex;align-items:flex-end;' + (clickable ? 'cursor:pointer;' : '') + '">' +
      '<div style="width:100%;height:' + (paid ? 20 : 6) + 'px;background:' + color + ';border-radius:2px;"></div>' +
    '</div>';
  }).join('');
  return '<div>' +
    '<div style="font-size:11px;color:var(--color-text-muted);margin-bottom:4px;">Who\'s paid</div>' +
    '<div style="display:flex;align-items:flex-end;gap:2px;">' + bars + '</div>' +
  '</div>';
}
