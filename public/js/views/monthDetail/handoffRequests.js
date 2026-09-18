import { state, handoffReqCache, monthKey } from '../../store.js';
import { fmt, escapeHtml, adminName, otherAdmin, colorFor, initialsOf, formatDateTime } from '../../helpers.js';
import { iconTransfer, iconWarningTriangle, iconArrowUpRight, iconArrowDownLeft, iconCheck } from '../../icons.js';
import { signed } from './shared.js';

// Pending hand-offs (see confirmTransfer/acceptHandoffRequest in
// actions/handoffs.js) for this month — shown above the collection summary in both
// open and closed months, since a late hand-off can still be proposed
// after close (same as the transfer bar itself allows). More than one can
// be pending at once, each independent, so each gets its own card and its
// own accept/decline/cancel target via data-req-id.
//
// Deliberately doesn't show either admin's before/after holdings on the
// PENDING card the way an earlier version did — that one was about a set
// of payments changing hands, not a running balance, and the admins'
// totals were already one tap away on the summary card above. The
// accept SUCCESS card below is a different, narrower case: confirming
// what accepting actually just did to your own holdings.
//
// Sourced straight from state.ui.handoffAction rather than the request
// doc, because by the time accept succeeds the doc is already deleted
// (see acceptHandoffRequest in actions/handoffs.js) — this has to
// survive the listener pulling the pending card out from under it.
// Decline/cancel don't get one: no holdings change, nothing to confirm.
function renderAcceptSuccessCard(acting, f, isClosed) {
  var after = state.currentAdmin === 'A' ? (isClosed ? f.finalA : f.adjA) : (isClosed ? f.finalB : f.adjB);
  var before = after - acting.amount;
  // The top border doubles as a 10s countdown bar (shrinks via the
  // countdown-bar CSS animation) rather than a plain static stripe —
  // gives the auto-close a visible "how much longer" cue instead of the
  // card just vanishing out of nowhere. Its duration must stay in sync
  // with HANDOFF_SUCCESS_AUTOCLOSE_MS in actions/handoffs.js, which is
  // what actually fires the close; "Done" below still closes it early.
  return '<div class="banner card" style="position:relative;overflow:hidden;">' +
    '<div class="countdown-bar" style="background:var(--color-success);"></div>' +
    '<div class="banner-title" style="color:var(--color-success);">' + iconCheck('var(--color-success)') + 'Transfer accepted</div>' +
    '<div style="font-size:12.5px;color:var(--color-text-muted);">You accepted <span class="mono" style="font-weight:700;color:var(--color-success);">' + fmt(acting.amount) + '</span></div>' +
    '<div class="stat">' +
      '<div class="label">' + escapeHtml(adminName(state.currentAdmin)) + ' now holds</div>' +
      '<div class="value" style="' + (after < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(before) + ' <span style="color:var(--color-text-faint);font-weight:400;">→</span> ' + signed(after) + '</div>' +
    '</div>' +
    '<button class="btn btn-soft" style="width:100%;" data-action="dismiss-handoff-success">Done</button>' +
  '</div>';
}

// The sender-side counterpart to renderAcceptSuccessCard above — shown on
// the OTHER admin's client when a request this admin sent gets accepted
// over there (see the handoffRequests listener in listeners.js, which
// sets state.ui.handoffOutgoingSuccess once it sees the doc flip to
// status:'accepted' with from === this admin). The sender's holdings went
// DOWN by the handed-off amount rather than up, so before/after run the
// opposite direction from the accept card's.
function renderOutgoingSuccessCard(outgoing, f, isClosed) {
  var after = state.currentAdmin === 'A' ? (isClosed ? f.finalA : f.adjA) : (isClosed ? f.finalB : f.adjB);
  var before = after + outgoing.amount;
  return '<div class="banner card" style="position:relative;overflow:hidden;">' +
    '<div class="countdown-bar" style="background:var(--color-success);"></div>' +
    '<div class="banner-title" style="color:var(--color-success);">' + iconCheck('var(--color-success)') + 'Transfer accepted</div>' +
    '<div style="font-size:12.5px;color:var(--color-text-muted);">' + escapeHtml(adminName(otherAdmin(state.currentAdmin))) + ' accepted <span class="mono" style="font-weight:700;color:var(--color-success);">' + fmt(outgoing.amount) + '</span></div>' +
    '<div class="stat">' +
      '<div class="label">' + escapeHtml(adminName(state.currentAdmin)) + ' now holds</div>' +
      '<div class="value" style="' + (after < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(before) + ' <span style="color:var(--color-text-faint);font-weight:400;">→</span> ' + signed(after) + '</div>' +
    '</div>' +
    '<button class="btn btn-soft" style="width:100%;" data-action="dismiss-handoff-outgoing-success">Done</button>' +
  '</div>';
}

export function renderHandoffRequests(gid, viewMonth, readOnly, members, f, isClosed) {
  var reqs = handoffReqCache.get(monthKey(gid, viewMonth)) || {};
  // A doc lingers briefly with status:'accepted' after acceptHandoffRequest
  // marks it (real cleanup happens later — see the delay() in
  // actions/handoffs.js) purely so the sender's client gets a chance to
  // see the transition; it's not "pending" anymore, so it's excluded here
  // rather than still showing Accept/Decline buttons for something already
  // settled.
  var ids = Object.keys(reqs).filter(function (id) { return reqs[id].status !== 'accepted'; });
  // Scoped to the one card being acted on — see setHandoffAction in
  // actions/handoffs.js for why this replaced the app-wide busy overlay.
  var acting = state.ui.handoffAction;
  var outgoing = state.ui.handoffOutgoingSuccess;
  var successCard = (acting && acting.phase === 'success' && acting.action === 'accept') ? renderAcceptSuccessCard(acting, f, isClosed)
    : (outgoing && outgoing.gid === gid && outgoing.m === viewMonth) ? renderOutgoingSuccessCard(outgoing, f, isClosed)
    : '';
  if (!ids.length && !successCard) return '';
  var cards = ids.map(function (id) {
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
    // sender is just waiting. Gold vs. blue carries that difference (gold
    // already means "needs attention" elsewhere — the month status pill's
    // "Payout pending"/"in progress" state — so this reuses a meaning
    // instead of adding a new one). A read-only viewer gets the calm blue
    // either way, since there's nothing for them to act on.
    //
    // The card itself stays a plain white surface rather than a full
    // color wash (an earlier pass tried tinting the whole incoming card
    // pale yellow — it read as duller/heavier than the rest of the app's
    // white cards, not more urgent). All the color lives in the direction
    // pill/icon/border instead, matching how the payment/payout sheets
    // carry their own color on a badge + border, not a tinted background.
    var needsMyAction = !readOnly && !iSent;
    var accentColor = needsMyAction ? 'var(--color-gold)' : 'var(--color-secondary)';
    var accentSoft = needsMyAction ? 'var(--color-gold-soft)' : 'var(--color-secondary-soft)';
    // The Total figure always renders in the app's actual "money" blue
    // (--color-primary, same as the dashboard's own totals) regardless of
    // direction, rather than following the outgoing/incoming accent —
    // that accent already has a full job on the pill/border, and a
    // consistent blue reads as "this is the amount" the same way on
    // either card.
    var accentStrong = 'var(--color-primary)';
    var title = readOnly ? 'Transfer pending' : (iSent ? 'Transfer pending acceptance' : 'Transfer needs your acceptance');
    // A direction pill (plus a distinct arrow icon per direction, rather
    // than the same bidirectional iconTransfer glyph for both) so a
    // request you sent and one you were sent are told apart at a glance,
    // not just by reading the title. Read-only has no side in it, so it
    // gets neither.
    var directionPill = readOnly ? '' : '<div style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:' + accentColor + ';background:' + accentSoft + ';padding:3px 9px;border-radius:20px;align-self:flex-start;">' +
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
          '<span>Total</span><span class="mono" style="color:' + accentStrong + ';">' + fmt(req.amount) + '</span>' +
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

    return '<div class="banner card" style="border-top:4px solid ' + accentColor + ';">' +
      directionPill +
      '<div class="banner-title">' + iconTransfer(accentColor) + title + '</div>' +
      '<div style="font-size:12.5px;color:var(--color-text-muted);">' + escapeHtml(adminName(req.from) + ' → ' + adminName(req.to)) + ' · ' + count + ' payment' + (count === 1 ? '' : 's') + (requestedLabel ? ' · Requested ' + requestedLabel : '') + '</div>' +
      '<div style="background:var(--color-bg);border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:8px;">' + memberRows + totalRow + '</div>' +
      (error ? '<div class="error-text" style="display:flex;align-items:center;gap:6px;font-weight:600;">' + iconWarningTriangle('var(--color-danger)') + 'Could not ' + acting.action + ': ' + escapeHtml(error) + '</div>' : '') +
      actionArea +
    '</div>';
  }).join('');
  return successCard + cards;
}
