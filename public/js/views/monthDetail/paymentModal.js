import { ADMINS } from '../../../firebase-config.js';
import { state, paymentsCache, monthsCache, transferReqCache, handoffReqCache, monthKey } from '../../store.js';
import { fmt, escapeHtml, colorFor, initialsOf, adminName, formatDateTime, monthLabel } from '../../helpers.js';
import { iconClose, iconCash, iconCard, iconTransfer, iconWallet, iconCheck, iconWarningTriangle } from '../../icons.js';
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
  // savePaymentModal (actions/payments.js) drives this sheet through its
  // own saving/success/error states instead of the app-wide busy overlay —
  // that overlay used to blank the WHOLE screen behind a dark scrim for
  // the length of the write, which read as the page reloading rather than
  // this one sheet doing something. `locked` covers both saving and the
  // brief success beat right before the sheet closes itself: nothing here
  // should be editable once a write is in flight or has just landed.
  var saving = pm.saveState === 'saving';
  var justSaved = pm.saveState === 'success';
  var saveError = pm.saveState === 'error' ? pm.saveError : null;
  var locked = saving || justSaved;
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
      // Closing mid-save would race the write's own history.back() (see
      // savePaymentModal) — dropped entirely rather than just visually
      // dimmed, same "no data-action when the action shouldn't fire"
      // convention as the winner card's openable/removable flags.
      (locked ? '<div class="sheet-close" style="opacity:0.35;">' + iconClose() + '</div>' : '<div class="sheet-close" data-action="close-payment-modal">' + iconClose() + '</div>') +
    '</div>' +
    '<div class="sheet-body">' +
      '<div style="text-align:center;padding:8px 0 4px;">' +
        '<div style="font-size:11px;color:var(--color-text-muted);margin-bottom:2px;">Amount</div>' +
        '<div class="mono" style="font-size:32px;font-weight:700;">' + fmt(group.monthlyDeposit) + '</div>' +
        (pm.isEditing && existingP && formatDateTime(existingP.paidAt) ? '<div style="font-size:11px;color:var(--color-text-muted);margin-top:2px;">Paid on ' + formatDateTime(existingP.paidAt) + '</div>' : '') +
      '</div>' +
      '<div><div style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--color-text-muted);margin-bottom:8px;">' + iconWallet() + 'Payment mode</div>' +
      (canEditMode && !locked
        ? '<div class="pill-row">' +
            '<button class="pill ' + (pm.mode === 'cash' ? 'active' : '') + '" style="display:flex;align-items:center;justify-content:center;gap:6px;" data-action="set-modal-mode" data-mode="cash">' + iconCash() + 'Cash</button>' +
            '<button class="pill ' + (pm.mode === 'online' ? 'active' : '') + '" style="display:flex;align-items:center;justify-content:center;gap:6px;" data-action="set-modal-mode" data-mode="online">' + iconCard() + 'Online</button>' +
          '</div>'
        : '<div class="pill-row"><div class="pill active" style="pointer-events:none;display:flex;align-items:center;justify-content:center;gap:6px;">' + (pm.mode === 'online' ? iconCard() + 'Online' : iconCash() + 'Cash') + '</div></div>' +
          (locked ? '' : '<div style="font-size:11px;color:var(--color-text-muted);margin-top:6px;">' + (existingP && existingP.transferred ? 'Locked — this amount has been transferred and can no longer be edited.' : pendingHandoffId ? 'Locked — a transfer request is pending on this amount.' : 'Only ' + adminName(holder) + ' can change this.') + '</div>')
      ) + '</div>' +
      transferHistory +
      buildActionArea(pm, canMarkUnpaid, canEditMode, saving, justSaved, saveError) +
    '</div>' +
  '</div></div>';
}

// Mark as unpaid and Save Payment write through the same pm.saveState
// (savePaymentModal/markUnpaidFromModal in actions/payments.js) since
// only one of the two is ever meaningful to fire at once — pm.pendingAction
// says which one actually owns the current saving/success/error state, so
// the OTHER button disappears entirely while a write is in flight rather
// than both trying to show a loading state at once.
function buildActionArea(pm, canMarkUnpaid, canEditMode, saving, justSaved, saveError) {
  var locked = saving || justSaved;
  var showMarkUnpaid = canMarkUnpaid && (!locked || pm.pendingAction === 'mark-unpaid');
  var showSavePayment = canEditMode && (!pm.isEditing || pm.mode !== pm.originalMode) && (!locked || pm.pendingAction === 'save-payment');
  var spinner = function (color) { return '<div class="spinner" style="width:16px;height:16px;border-color:rgba(255,255,255,0.35);border-top-color:' + color + ';"></div>'; };
  var successPill = function (label) { return '<div class="btn" style="width:100%;background:var(--color-success-soft);color:var(--color-success);display:flex;align-items:center;justify-content:center;gap:8px;pointer-events:none;">' + iconCheck('var(--color-success)') + label + '</div>'; };

  var html = '';
  if (showMarkUnpaid) {
    if (justSaved && pm.pendingAction === 'mark-unpaid') {
      html += successPill('Marked as unpaid');
    } else {
      var markSaving = saving && pm.pendingAction === 'mark-unpaid';
      html += '<button class="btn btn-danger-soft' + (markSaving ? ' disabled' : '') + '" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;"' + (markSaving ? '' : ' data-action="mark-unpaid"') + '>' +
        (markSaving ? spinner('var(--color-danger)') + 'Marking as unpaid…' : 'Mark as unpaid') + '</button>';
    }
  }
  if (saveError) {
    html += '<div class="error-text" style="display:flex;align-items:center;gap:6px;font-weight:600;">' + iconWarningTriangle('var(--color-danger)') + (pm.pendingAction === 'mark-unpaid' ? 'Could not mark as unpaid: ' : 'Could not save: ') + escapeHtml(saveError) + '</div>';
  }
  if (showSavePayment) {
    if (justSaved && pm.pendingAction === 'save-payment') {
      html += successPill('Payment saved');
    } else {
      var paySaving = saving && pm.pendingAction === 'save-payment';
      html += '<button class="btn btn-primary' + (paySaving ? ' disabled' : '') + '" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;"' + (paySaving ? '' : ' data-action="save-payment"') + '>' +
        (paySaving ? spinner('#fff') + 'Saving…' : 'Save Payment') + '</button>';
    }
  }
  return html;
}
