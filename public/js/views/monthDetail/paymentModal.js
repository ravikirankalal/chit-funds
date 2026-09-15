import { ADMINS } from '../../../firebase-config.js';
import { state, paymentsCache, monthsCache, transferReqCache, handoffReqCache, monthKey } from '../../store.js';
import { fmt, escapeHtml, colorFor, initialsOf, adminName, formatDateTime, monthLabel } from '../../helpers.js';
import { iconClose, iconCash, iconCard, iconTransfer, iconWallet } from '../../icons.js';
import { timelineRow } from './shared.js';

export function renderPaymentModalOverlay(gid, viewMonth, group, members) {
  var pm = state.ui.paymentModal;
  var pmem = members.find(function (mm) { return mm.id === pm.memberId; });
  var pidx = members.indexOf(pmem);
  var existingP = (paymentsCache.get(monthKey(gid, viewMonth)) || {})[pm.memberId];
  var holder = pm.isEditing && existingP ? existingP.collectedBy : state.currentAdmin;
  var handoffReqs = handoffReqCache.get(monthKey(gid, viewMonth)) || {};
  var pendingHandoffId = Object.keys(handoffReqs).find(function (id) { return (handoffReqs[id].mids || []).indexOf(pm.memberId) !== -1; });
  // Locked the same way once-transferred payments already were: a hand-off
  // still awaiting the other admin's acceptance can't have its mode
  // changed or be marked unpaid out from under the pending request.
  var canEditMode = !pm.isEditing || (existingP && existingP.collectedBy === state.currentAdmin && !existingP.transferred && !pendingHandoffId);
  var canMarkUnpaid = pm.isEditing && existingP && existingP.collectedBy === state.currentAdmin && !existingP.transferred && !pendingHandoffId;
  var transferHistory = '';
  if (pm.isEditing && existingP) {
    // collectedBy/transferredAt only ever reflect the CURRENT holder — the
    // full chain of hand-offs (an amount can move A->B, then later B->A
    // again) lives in transferLog, appended to on every confirmTransfer
    // (see actions/handoffs.js). Its first entry's `from` is who originally
    // collected it, before any transfer happened.
    var log = existingP.transferLog || [];
    var originalCollector = log.length ? log[0].from : existingP.collectedBy;
    var rows = timelineRow('var(--color-success)', escapeHtml(pmem.name) + ' collected by ' + adminName(originalCollector),
      (existingP.mode === 'online' ? 'Online' : 'Cash'), '', formatDateTime(existingP.paidAt));
    log.forEach(function (t) {
      rows += timelineRow('var(--color-secondary)', adminName(t.from) + ' → ' + adminName(t.to), 'Transferred', 'color:var(--color-secondary);', formatDateTime(t.at));
    });
    var monthNet = (monthsCache.get(monthKey(gid, viewMonth)) || {}).transferNet || 0;
    if (monthNet) {
      rows += timelineRow('var(--color-secondary)', (monthNet > 0 ? ADMINS.A.name + ' → ' + ADMINS.B.name : ADMINS.B.name + ' → ' + ADMINS.A.name),
        'Accepted', 'color:var(--color-secondary);', fmt(Math.abs(monthNet)));
    }
    var pendingReq = transferReqCache.get(monthKey(gid, viewMonth));
    if (pendingReq) {
      rows += timelineRow('var(--color-secondary)', (pendingReq.direction === 'AtoB' ? ADMINS.A.name + ' → ' + ADMINS.B.name : ADMINS.B.name + ' → ' + ADMINS.A.name),
        'Pending acceptance', 'color:var(--color-secondary);', fmt(pendingReq.amount));
    }
    if (pendingHandoffId) {
      var pendingHandoff = handoffReqs[pendingHandoffId];
      rows += timelineRow('var(--color-secondary)', adminName(pendingHandoff.from) + ' → ' + adminName(pendingHandoff.to),
        'Pending acceptance', 'color:var(--color-secondary);', fmt(group.monthlyDeposit));
    }
    transferHistory = '<div><div style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--color-text-muted);margin-bottom:8px;">' + iconTransfer() + 'Transfer history</div><div style="display:flex;flex-direction:column;gap:10px;">' + rows + '</div></div>';
  }

  return '<div class="overlay"><div class="sheet">' +
    '<div class="sheet-header">' +
      '<div class="avatar sm" style="background:' + colorFor(pidx) + ';">' + initialsOf(pmem.name) + '</div>' +
      '<div style="flex:1 1 auto;min-width:0;"><div style="font-size:14px;font-weight:700;">' + escapeHtml(pmem.name) + '</div>' +
      '<div style="font-size:11.5px;color:var(--color-text-muted);">' + monthLabel(group.startYear, group.startMonthIndex, viewMonth) + ' · ' + fmt(group.monthlyDeposit) + ' · collected by ' + adminName(holder) + '</div></div>' +
      '<div class="sheet-close" data-action="close-payment-modal">' + iconClose() + '</div>' +
    '</div>' +
    '<div class="sheet-body">' +
      '<div style="text-align:center;padding:8px 0 4px;">' +
        '<div style="font-size:11px;color:var(--color-text-muted);margin-bottom:2px;">Amount</div>' +
        '<div class="mono" style="font-size:32px;font-weight:700;">' + fmt(group.monthlyDeposit) + '</div>' +
        (pm.isEditing && existingP && formatDateTime(existingP.paidAt) ? '<div style="font-size:11px;color:var(--color-text-muted);margin-top:2px;">Paid on ' + formatDateTime(existingP.paidAt) + '</div>' : '') +
      '</div>' +
      '<div><div style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--color-text-muted);margin-bottom:8px;">' + iconWallet() + 'Payment mode</div>' +
      (canEditMode
        ? '<div class="pill-row">' +
            '<button class="pill ' + (pm.mode === 'cash' ? 'active' : '') + '" style="display:flex;align-items:center;justify-content:center;gap:6px;" data-action="set-modal-mode" data-mode="cash">' + iconCash() + 'Cash</button>' +
            '<button class="pill ' + (pm.mode === 'online' ? 'active' : '') + '" style="display:flex;align-items:center;justify-content:center;gap:6px;" data-action="set-modal-mode" data-mode="online">' + iconCard() + 'Online</button>' +
          '</div>'
        : '<div class="pill-row"><div class="pill active" style="pointer-events:none;display:flex;align-items:center;justify-content:center;gap:6px;">' + (pm.mode === 'online' ? iconCard() + 'Online' : iconCash() + 'Cash') + '</div></div>' +
          '<div style="font-size:11px;color:var(--color-text-muted);margin-top:6px;">' + (existingP && existingP.transferred ? 'Locked — this amount has been transferred and can no longer be edited.' : pendingHandoffId ? 'Locked — a transfer request is pending on this amount.' : 'Only ' + adminName(holder) + ' can change this.') + '</div>'
      ) + '</div>' +
      transferHistory +
      (canMarkUnpaid ? '<button class="btn btn-danger-soft" style="width:100%;" data-action="mark-unpaid">Mark as unpaid</button>' : '') +
      (canEditMode && (!pm.isEditing || pm.mode !== pm.originalMode) ? '<button class="btn btn-primary" style="width:100%;" data-action="save-payment">Save Payment</button>' : '') +
    '</div>' +
  '</div></div>';
}
