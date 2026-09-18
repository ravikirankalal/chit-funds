import { state, paymentsCache, monthKey } from '../../store.js';
import { fmt, escapeHtml, otherAdmin, adminName } from '../../helpers.js';
import { iconClose } from '../../icons.js';

// A floating bar, not a modal overlay — the payment list underneath must
// stay tappable so more entries can be added to the selection. Long-press
// starts it; a plain tap on another eligible row (see the
// 'open-payment-modal' case in events.js) adds or removes it.
export function renderTransferBar(gid, viewMonth, group) {
  var sel = state.ui.transferSelection;
  var payments = paymentsCache.get(monthKey(gid, viewMonth)) || {};
  var mids = sel.mids.filter(function (mid) { return payments[mid] && payments[mid].paid && payments[mid].collectedBy === state.currentAdmin; });
  if (!mids.length) return '';
  var target = otherAdmin(state.currentAdmin);
  var total = mids.length * group.monthlyDeposit;
  return '<div style="position:fixed;left:0;right:0;bottom:0;z-index:25;display:flex;justify-content:center;">' +
    '<div style="width:100%;max-width:var(--max-width);background:var(--color-surface);border-radius:20px 20px 0 0;padding:14px 16px;display:flex;align-items:center;gap:10px;box-shadow:0 -12px 32px rgba(28,26,22,0.16), 0 -2px 6px rgba(28,26,22,0.08);">' +
      '<div style="flex:1 1 auto;min-width:0;">' +
        '<div style="font-size:11.5px;color:var(--color-text-muted);">' + mids.length + ' payment' + (mids.length === 1 ? '' : 's') + ' selected</div>' +
        '<div class="mono" style="font-size:16px;font-weight:700;">' + fmt(total) + '</div>' +
      '</div>' +
      '<div data-action="cancel-transfer-selection" style="width:32px;height:32px;border-radius:10px;background:var(--color-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + iconClose() + '</div>' +
      '<button class="btn btn-primary" style="flex-shrink:0;padding:12px 16px;white-space:nowrap;" data-action="confirm-transfer">Request transfer to ' + escapeHtml(adminName(target)) + '</button>' +
    '</div>' +
  '</div>';
}
