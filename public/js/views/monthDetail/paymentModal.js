import { state, paymentsCache, monthsCache, transferReqCache, handoffReqCache, monthKey } from '../../store.js';
import { fmt, escapeHtml, colorFor, initialsOf, adminName, adminDot, formatDateTime, monthLabel } from '../../helpers.js';
import { iconClose, iconCash, iconCard, iconTransfer, iconWallet, iconCheck, iconWarningTriangle } from '../../icons.js';
import { timelineRow, signed } from './shared.js';

export function renderPaymentModalOverlay(gid, viewMonth, group, members, f) {
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
  var verifying = pm.saveState === 'verifying';
  var saving = pm.saveState === 'saving';
  var justSaved = pm.saveState === 'success';
  var saveError = pm.saveState === 'error' ? pm.saveError : null;
  var locked = verifying || saving || justSaved;

  // The mode badge in the hero card carries the same info the old plain
  // "Cash"/"Online" pill duplicated below it — cash reads as the app's
  // neutral/informational slate, online as the brand cobalt, so the two
  // are visually distinct without inventing a new color for either.
  var modeColor = pm.mode === 'online' ? 'var(--color-primary)' : 'var(--color-secondary)';
  var modeSoft = pm.mode === 'online' ? 'var(--color-primary-soft)' : 'var(--color-secondary-soft)';
  var modeIcon = pm.mode === 'online' ? iconCard(modeColor, 14) : iconCash(modeColor, 14);
  var modeLabel = pm.mode === 'online' ? 'Online' : 'Cash';
  // A single centered column — mode badge, then the amount, then the paid
  // caption (if any) — so the card stays symmetric whether or not there's
  // a paid line to show, instead of a two-sided top row that went
  // lopsided the moment one side had nothing in it.
  var paidCaption = (pm.isEditing && existingP && formatDateTime(existingP.paidAt))
    ? '<div style="display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:600;color:var(--color-success);">' + iconCheck('var(--color-success)') + 'Paid on ' + formatDateTime(existingP.paidAt) + '</div>'
    : '';
  var heroCard = '<div style="background:var(--color-bg);border:1px solid var(--color-border);border-radius:18px;padding:20px 16px;display:flex;flex-direction:column;align-items:center;gap:10px;">' +
    '<div style="display:inline-flex;align-items:center;gap:7px;">' +
      '<div style="width:28px;height:28px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:' + modeSoft + ';">' + modeIcon + '</div>' +
      '<span style="font-size:12px;font-weight:600;color:' + modeColor + ';">' + modeLabel + '</span>' +
    '</div>' +
    '<div class="mono" style="font-size:34px;font-weight:700;">' + fmt(group.monthlyDeposit) + '</div>' +
    paidCaption +
  '</div>';

  // Only shown when there's an actual decision to make (an editable,
  // unlocked mode) or a reason the admin should know it's out of their
  // hands — the hero card above already displays the current mode, so a
  // read-only echo of the same pill here would just be noise.
  var modeSection = '';
  if (canEditMode && !locked) {
    // A compact segmented toggle, not a pair of full-width pills — the
    // hero card above is already the primary display of the mode, so this
    // is just a small secondary control for changing it, and sizing it
    // like a primary action overstated its importance.
    var modeToggleBtn = function (mode, icon, label) {
      var active = pm.mode === mode;
      return '<button data-action="set-modal-mode" data-mode="' + mode + '" style="display:flex;align-items:center;gap:5px;padding:6px 12px;border-radius:8px;font-size:12.5px;font-weight:600;background:' + (active ? 'var(--color-primary)' : 'transparent') + ';color:' + (active ? 'var(--on-brand)' : 'var(--color-text-muted)') + ';">' + icon + label + '</button>';
    };
    modeSection = '<div style="display:flex;align-items:center;justify-content:space-between;">' +
      '<span style="font-size:12px;font-weight:600;color:var(--color-text-muted);display:flex;align-items:center;gap:6px;">' + iconWallet() + 'Payment mode</span>' +
      '<div style="display:inline-flex;background:var(--color-bg);border:1px solid var(--color-border);border-radius:10px;padding:3px;gap:2px;">' +
        modeToggleBtn('cash', iconCash(pm.mode === 'cash' ? 'var(--on-brand)' : 'currentColor', 13), 'Cash') +
        modeToggleBtn('online', iconCard(pm.mode === 'online' ? 'var(--on-brand)' : 'currentColor', 13), 'Online') +
      '</div>' +
    '</div>';
  } else if (!canEditMode) {
    modeSection = '<div style="font-size:11px;color:var(--color-text-muted);">' + (existingP && existingP.transferred ? 'Locked — this amount has been transferred and can no longer be edited.' : pendingHandoffId ? 'Locked — a transfer request is pending on this amount.' : 'Only ' + adminName(holder) + ' can change this.') + '</div>';
  }

  // Only meaningful for an actual collection — a mode-only edit on an
  // already-paid entry doesn't move any money, so there's nothing for a
  // before/after to preview. Mirrors the payout modal's own "if you save
  // this" holdings preview.
  var holdingsPreview = '';
  if (!pm.isEditing) {
    var beforeHold = state.currentAdmin === 'A' ? f.adjA : f.adjB;
    // Once the write actually lands, the Firestore listener folds it into
    // f out from under this still-open sheet (the success beat holds it
    // open for SAVE_SUCCESS_DISPLAY_MS before closing itself) — at that
    // point "before -> after" is no longer a preview of anything, it's
    // just the same settled figure twice with an arrow between them. Show
    // it plainly instead once saved; the two-sided preview is only useful
    // while the write hasn't happened yet.
    if (justSaved) {
      holdingsPreview = '<div>' +
        '<div class="section-label">Your holdings</div>' +
        '<div class="stat"><div class="label">' + adminDot(state.currentAdmin) + adminName(state.currentAdmin) + '</div>' +
        '<div class="value" style="color:' + (beforeHold < 0 ? 'var(--color-danger)' : 'var(--color-text)') + ';">' + signed(beforeHold) + '</div></div>' +
      '</div>';
    } else {
      // Guards the same double-count if the listener's update happens to
      // land while still in the 'saving' state, before justSaved flips.
      var afterHold = (existingP && existingP.paid) ? beforeHold : beforeHold + group.monthlyDeposit;
      holdingsPreview = '<div>' +
        '<div class="section-label">Your holdings, if you save this</div>' +
        '<div class="stat"><div class="label">' + adminDot(state.currentAdmin) + adminName(state.currentAdmin) + '</div>' +
        '<div class="value"><span style="color:' + (beforeHold < 0 ? 'var(--color-danger)' : 'var(--color-text)') + ';">' + signed(beforeHold) + '</span> <span style="color:var(--color-text-faint);font-weight:400;">→</span> <span style="color:' + (afterHold < 0 ? 'var(--color-danger)' : 'var(--color-text)') + ';">' + signed(afterHold) + '</span></div></div>' +
      '</div>';
    }
  }

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
      rows += timelineRow('var(--color-secondary)', escapeHtml(monthNet > 0 ? adminName('A') + ' → ' + adminName('B') : adminName('B') + ' → ' + adminName('A')),
        'Accepted', 'color:var(--color-secondary);', fmt(Math.abs(monthNet)));
    }
    var pendingReq = transferReqCache.get(monthKey(gid, viewMonth));
    if (pendingReq) {
      rows += timelineRow('var(--color-secondary)', escapeHtml(pendingReq.direction === 'AtoB' ? adminName('A') + ' → ' + adminName('B') : adminName('B') + ' → ' + adminName('A')),
        'Pending acceptance', 'color:var(--color-secondary);', fmt(pendingReq.amount));
    }
    if (pendingHandoffId) {
      var pendingHandoff = handoffReqs[pendingHandoffId];
      rows += timelineRow('var(--color-secondary)', adminName(pendingHandoff.from) + ' → ' + adminName(pendingHandoff.to),
        'Pending acceptance', 'color:var(--color-secondary);', fmt(group.monthlyDeposit));
    }
    transferHistory = '<div><div class="section-label">' + iconTransfer() + 'Transfer history</div>' +
      '<div class="card" style="display:flex;flex-direction:column;gap:10px;padding:14px;">' + rows + '</div></div>';
  }

  var actionHtml = buildActionArea(pm, canMarkUnpaid, canEditMode, verifying, saving, justSaved, saveError);
  // A divider ahead of the actions reads as an intentional "content ends,
  // decisions begin" break — but only when there's something actionable:
  // a view-only sheet (someone looking at a payment they don't own, with
  // nothing to mark unpaid) would otherwise show a stray empty divider.
  var actionBlock = actionHtml
    ? '<div style="display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--color-border);padding-top:16px;">' + actionHtml + '</div>'
    : '';

  return '<div class="overlay"><div class="sheet">' +
    '<div class="sheet-header">' +
      '<div class="avatar" style="background:' + colorFor(pidx) + ';">' + initialsOf(pmem.name) + '</div>' +
      '<div style="flex:1 1 auto;min-width:0;"><div style="font-size:14px;font-weight:700;">' + escapeHtml(pmem.name) + '</div>' +
      '<div style="font-size:11.5px;color:var(--color-text-muted);">' + monthLabel(group.startYear, group.startMonthIndex, viewMonth) + ' · collected by ' + adminName(holder) + '</div></div>' +
      // Closing mid-save would race the write's own history.back() (see
      // savePaymentModal) — dropped entirely rather than just visually
      // dimmed, same "no data-action when the action shouldn't fire"
      // convention as the winner card's openable/removable flags. Stays
      // clickable during `verifying` specifically (closePaymentModal's own
      // guard allows it too) — the escape hatch for a hung biometric
      // prompt, since no write has started yet at that point.
      ((saving || justSaved) ? '<div class="sheet-close" style="opacity:0.35;">' + iconClose() + '</div>' : '<div class="sheet-close" data-action="close-payment-modal">' + iconClose() + '</div>') +
    '</div>' +
    '<div class="sheet-body">' +
      heroCard +
      modeSection +
      holdingsPreview +
      transferHistory +
      actionBlock +
    '</div>' +
  '</div></div>';
}

// Mark as unpaid and Save Payment write through the same pm.saveState
// (savePaymentModal/markUnpaidFromModal in actions/payments.js) since
// only one of the two is ever meaningful to fire at once — pm.pendingAction
// says which one actually owns the current saving/success/error state, so
// the OTHER button disappears entirely while a write is in flight rather
// than both trying to show a loading state at once.
function buildActionArea(pm, canMarkUnpaid, canEditMode, verifying, saving, justSaved, saveError) {
  var locked = verifying || saving || justSaved;
  var showMarkUnpaid = canMarkUnpaid && (!locked || pm.pendingAction === 'mark-unpaid');
  var showSavePayment = canEditMode && (!pm.isEditing || pm.mode !== pm.originalMode) && (!locked || pm.pendingAction === 'save-payment');
  var spinner = function (color) { return '<div class="spinner" style="width:16px;height:16px;border-color:rgba(255,255,255,0.35);border-top-color:' + color + ';"></div>'; };
  var successPill = function (label) { return '<div class="btn" style="width:100%;background:var(--color-success-soft);color:var(--color-success);display:flex;align-items:center;justify-content:center;gap:8px;pointer-events:none;">' + iconCheck('var(--color-success)') + label + '</div>'; };

  var html = '';
  if (showMarkUnpaid) {
    if (justSaved && pm.pendingAction === 'mark-unpaid') {
      html += successPill('Marked as unpaid');
    } else if (verifying && pm.pendingAction === 'mark-unpaid') {
      html += '<div class="btn btn-danger-soft disabled" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;">' + spinner('var(--color-danger)') + 'Confirming with biometrics…</div>';
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
    } else if (verifying && pm.pendingAction === 'save-payment') {
      // The actual OS biometric prompt is what's on screen right now (a
      // native dialog, not anything this sheet draws) — this is just the
      // button reflecting that a tap already landed and something is
      // pending, same disabled-with-spinner treatment as the write itself.
      html += '<div class="btn btn-primary disabled" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;">' + spinner('#fff') + 'Confirming with biometrics…</div>';
    } else {
      var paySaving = saving && pm.pendingAction === 'save-payment';
      html += '<button class="btn btn-primary' + (paySaving ? ' disabled' : '') + '" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;"' + (paySaving ? '' : ' data-action="save-payment"') + '>' +
        (paySaving ? spinner('#fff') + 'Saving…' : 'Save Payment') + '</button>';
    }
  }
  return html;
}
