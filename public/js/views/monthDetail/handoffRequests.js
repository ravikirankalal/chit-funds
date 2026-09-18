import { state, handoffReqCache, monthKey } from '../../store.js';
import { fmt, escapeHtml, adminName, colorFor, initialsOf, formatDateTime } from '../../helpers.js';
import { iconTransfer, iconWarningTriangle, iconArrowUpRight, iconArrowDownLeft } from '../../icons.js';

// Pending hand-offs (see confirmTransfer/acceptHandoffRequest in
// actions/handoffs.js) for this month — shown above the collection summary in both
// open and closed months, since a late hand-off can still be proposed
// after close (same as the transfer bar itself allows). More than one can
// be pending at once, each independent, so each gets its own card and its
// own accept/decline/cancel target via data-req-id.
//
// Deliberately doesn't show either admin's before/after holdings the way
// the old version did — this card is about a set of payments changing
// hands, not a running balance; the admins' totals are already one tap
// away on the summary card above, and repeating them here just competed
// with the actual decision (accept or decline) for attention.
export function renderHandoffRequests(gid, viewMonth, readOnly, members) {
  var reqs = handoffReqCache.get(monthKey(gid, viewMonth)) || {};
  var ids = Object.keys(reqs);
  if (!ids.length) return '';
  // Scoped to the one card being acted on — see setHandoffAction in
  // actions/handoffs.js for why this replaced the app-wide busy overlay.
  var acting = state.ui.handoffAction;
  return ids.map(function (id) {
    var req = reqs[id];
    var iSent = req.from === state.currentAdmin;
    var mids = req.mids || [];
    var count = mids.length;
    // Every payment in a hand-off shares the same amount (see confirmTransfer
    // in actions/handoffs.js: amount = mids.length * group.monthlyDeposit), so
    // dividing back out is exact — no need to thread the group's
    // monthlyDeposit through just for this.
    var perAmount = count ? req.amount / count : 0;
    // Only the recipient has anything to actually decide here — the
    // sender is just waiting. Giving their card the warn (amber) banner
    // instead of the calmer info (blue) one makes that difference visible
    // at a glance instead of relying on reading the title text, matching
    // how a collection vs. payout sheet is told apart by more than its
    // label. A read-only viewer gets the calm treatment either way, since
    // there's nothing for them to act on.
    var needsMyAction = !readOnly && !iSent;
    var bannerClass = needsMyAction ? 'warn' : 'info';
    var accentColor = needsMyAction ? 'var(--color-warning)' : 'var(--color-secondary)';
    var title = readOnly ? 'Transfer pending' : (iSent ? 'Transfer pending acceptance' : 'Transfer needs your acceptance');
    // A direction pill (plus a distinct arrow icon per direction, rather
    // than the same bidirectional iconTransfer glyph for both) so a
    // request you sent and one you were sent are told apart at a glance,
    // not just by reading the title. Read-only has no side in it, so it
    // gets neither.
    var directionPill = readOnly ? '' : '<div style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:' + accentColor + ';background:' + (needsMyAction ? 'var(--color-warning-soft)' : 'var(--color-secondary-soft)') + ';padding:3px 9px;border-radius:20px;align-self:flex-start;">' +
      (iSent ? iconArrowUpRight(accentColor) + 'Outgoing' : iconArrowDownLeft(accentColor) + 'Incoming') + '</div>';
    var requestedLabel = formatDateTime(req.createdAt);
    // Each row now matches the look of an actual member-list row (avatar +
    // name) elsewhere in the app (see paymentRow in paymentList.js) instead
    // of a bare label/amount pair, so this reads as "these members" rather
    // than an anonymous line-item list.
    var memberRows = mids.map(function (mid) {
      var mm = members.find(function (x) { return x.id === mid; });
      var idx = mm ? members.indexOf(mm) : -1;
      return '<div style="display:flex;align-items:center;gap:8px;">' +
        '<div class="avatar sm" style="background:' + colorFor(idx) + ';flex-shrink:0;">' + (mm ? initialsOf(mm.name) : '?') + '</div>' +
        '<span style="flex:1 1 auto;min-width:0;font-size:12.5px;">' + escapeHtml(mm ? mm.name : '—') + '</span>' +
        '<span class="mono" style="font-weight:600;font-size:12.5px;">' + fmt(perAmount) + '</span>' +
      '</div>';
    }).join('');
    var totalRow = count > 1
      ? '<div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:700;padding-top:6px;margin-top:2px;border-top:1px solid var(--color-border);">' +
          '<span>Total</span><span class="mono" style="color:' + accentColor + ';">' + fmt(req.amount) + '</span>' +
        '</div>'
      : '';

    var isActing = acting && acting.reqId === id;
    var verifying = isActing && acting.phase === 'verifying';
    var working = isActing && acting.phase === 'working';
    var error = isActing ? acting.error : null;
    // Any card's action in flight disables every OTHER card's buttons too
    // — same single-flight guarantee the old app-wide overlay gave, just
    // without blanking the whole screen to enforce it.
    var otherDisabled = !!acting && !isActing;
    var actionArea;
    if (readOnly) {
      actionArea = '';
    } else if (verifying) {
      // The actual OS biometric prompt is what's on screen right now —
      // same treatment as paymentModal.js/payout.js's own verifying state.
      // Accept and decline both gate on it now, so this borrows whichever
      // button's own color it's standing in for instead of always the
      // accept button's blue.
      var verifyingDecline = acting.action === 'decline';
      actionArea = '<div class="btn ' + (verifyingDecline ? 'btn-danger-soft' : 'btn-primary') + ' disabled" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;">' +
        (verifyingDecline
          ? '<div class="spinner" style="width:16px;height:16px;border-color:var(--color-danger-soft);border-top-color:var(--color-danger);"></div>'
          : '<div class="spinner" style="width:16px;height:16px;border-color:rgba(255,255,255,0.35);border-top-color:#fff;"></div>') +
        'Confirming with biometrics…</div>';
    } else if (iSent) {
      var cancelling = working && acting.action === 'cancel';
      actionArea = '<button class="btn btn-danger-soft' + (otherDisabled || cancelling ? ' disabled' : '') + '" style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px;"' + (otherDisabled || cancelling ? '' : ' data-action="cancel-handoff-request" data-req-id="' + id + '"') + '>' +
        (cancelling ? '<div class="spinner" style="width:14px;height:14px;border-color:var(--color-danger-soft);border-top-color:var(--color-danger);"></div>Cancelling…' : 'Cancel') + '</button>';
    } else {
      var declining = working && acting.action === 'decline';
      var accepting = working && acting.action === 'accept';
      var busyHere = declining || accepting;
      actionArea = '<div style="display:flex;gap:8px;">' +
        '<button class="btn btn-danger-soft' + (otherDisabled || busyHere ? ' disabled' : '') + '" style="flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:6px;"' + (otherDisabled || busyHere ? '' : ' data-action="decline-handoff-request" data-req-id="' + id + '"') + '>' +
          (declining ? '<div class="spinner" style="width:14px;height:14px;border-color:var(--color-danger-soft);border-top-color:var(--color-danger);"></div>Declining…' : 'Decline') + '</button>' +
        '<button class="btn btn-primary' + (otherDisabled || busyHere ? ' disabled' : '') + '" style="flex:1 1 0;display:flex;align-items:center;justify-content:center;gap:6px;"' + (otherDisabled || busyHere ? '' : ' data-action="accept-handoff-request" data-req-id="' + id + '"') + '>' +
          (accepting ? '<div class="spinner" style="width:14px;height:14px;border-color:rgba(255,255,255,0.35);border-top-color:#fff;"></div>Accepting…' : 'Accept') + '</button>' +
      '</div>';
    }

    return '<div class="banner ' + bannerClass + '">' +
      directionPill +
      '<div class="banner-title">' + iconTransfer(accentColor) + title + '</div>' +
      '<div style="font-size:12.5px;color:var(--color-text-muted);">' + escapeHtml(adminName(req.from) + ' → ' + adminName(req.to)) + ' · ' + count + ' payment' + (count === 1 ? '' : 's') + (requestedLabel ? ' · Requested ' + requestedLabel : '') + '</div>' +
      '<div style="background:var(--color-surface);border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:8px;">' + memberRows + totalRow + '</div>' +
      (error ? '<div class="error-text" style="display:flex;align-items:center;gap:6px;font-weight:600;">' + iconWarningTriangle('var(--color-danger)') + 'Could not ' + acting.action + ': ' + escapeHtml(error) + '</div>' : '') +
      actionArea +
    '</div>';
  }).join('');
}
