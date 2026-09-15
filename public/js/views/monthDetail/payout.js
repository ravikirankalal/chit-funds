import { state } from '../../store.js';
import { fmt, escapeHtml, colorFor, initialsOf, adminName, adminDot, otherAdmin } from '../../helpers.js';
import { iconWallet, iconCheck, iconClose } from '../../icons.js';
import { signed } from './shared.js';

// Each admin records their own contribution toward a winner's payout —
// there's no approval step (see setPayoutContribution in actions/winners/payout.js): the
// month closes itself automatically the moment every winner's paidByA +
// paidByB reaches its payoutAmount. Tapping a winner row opens
// renderPayoutModalOverlay to enter/adjust the signed-in admin's own share.
export function renderPayoutCard(f, members) {
  if (!f.winners.length) return '';
  var rows = f.winners.map(function (w) {
    var winner = members.find(function (mm) { return mm.id === w.memberId; });
    var widx = winner ? members.indexOf(winner) : -1;
    var covered = w.remaining <= 0;
    return '<div class="list-row" data-action="open-payout-modal" data-mid="' + w.memberId + '" style="cursor:pointer;' + (covered ? 'border-left:3px solid var(--color-success);' : '') + '">' +
      '<div class="avatar sm" style="background:' + colorFor(widx) + ';">' + (winner ? initialsOf(winner.name) : '?') + '</div>' +
      '<div style="flex:1 1 auto;min-width:0;"><div style="font-size:13px;font-weight:600;">' + (winner ? escapeHtml(winner.name) : '—') + '</div>' +
      '<div style="font-size:11px;color:var(--color-text-muted);margin-top:1px;">' + adminName('A') + ': ' + fmt(w.paidByA) + ' · ' + adminName('B') + ': ' + fmt(w.paidByB) + '</div></div>' +
      (covered
        ? '<div style="flex-shrink:0;display:flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:5px 10px;border-radius:20px;background:var(--color-success-soft);color:var(--color-success);">' + iconCheck('var(--color-success)') + 'Paid</div>'
        : '<div style="text-align:right;flex-shrink:0;"><div style="font-size:10.5px;color:var(--color-text-muted);">Remaining</div><div class="mono" style="font-size:13px;font-weight:700;color:var(--color-gold);">' + fmt(w.remaining) + '</div></div>') +
    '</div>';
  }).join('');
  return '<div class="card" style="display:flex;flex-direction:column;gap:10px;">' +
    '<div style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:600;">' + iconWallet() + 'Record payout</div>' +
    rows +
  '</div>';
}

export function renderPayoutModalOverlay(f, members) {
  var pm = state.ui.payoutModal;
  var w = f.winners.find(function (x) { return x.memberId === pm.memberId; });
  if (!w) return '';
  var winner = members.find(function (mm) { return mm.id === w.memberId; });
  var widx = winner ? members.indexOf(winner) : -1;
  var myField = state.currentAdmin === 'A' ? 'paidByA' : 'paidByB';
  var otherField = state.currentAdmin === 'A' ? 'paidByB' : 'paidByA';
  var myAmount = w[myField] || 0;
  var otherAmount = w[otherField] || 0;
  var maxForMe = Math.max(0, w.payoutAmount - otherAmount);
  // Live preview of what Save would do, recomputed on every keystroke (see
  // the 'payoutDraftAmount' input handler in events.js). Typing past
  // maxForMe is allowed (so the raw number stays visible with an error),
  // but setPayoutContribution in actions/winners/payout.js rejects it outright rather
  // than clamping — so the preview below freezes at the valid max instead
  // of showing a false "what if" for an amount that won't actually save.
  var rawDraft = pm.draftAmount || 0;
  var exceeds = rawDraft > maxForMe;
  var draftAmount = exceeds ? maxForMe : rawDraft;
  var draftRemaining = Math.max(0, w.payoutAmount - otherAmount - draftAmount);
  var myBefore = state.currentAdmin === 'A' ? f.adjA : f.adjB;
  var myAfter = myBefore - (draftAmount - myAmount);

  return '<div class="overlay"><div class="sheet">' +
    '<div class="sheet-header">' +
      '<div class="avatar sm" style="background:' + colorFor(widx) + ';">' + (winner ? initialsOf(winner.name) : '?') + '</div>' +
      '<div style="flex:1 1 auto;min-width:0;"><div style="font-size:14px;font-weight:700;">' + (winner ? escapeHtml(winner.name) : '—') + '</div>' +
      '<div style="font-size:11.5px;color:var(--color-text-muted);">Payout target ' + fmt(w.payoutAmount) + '</div></div>' +
      '<div class="sheet-close" data-action="close-payout-modal">' + iconClose() + '</div>' +
    '</div>' +
    '<div class="sheet-body">' +
      '<div style="text-align:center;padding:8px 0 4px;">' +
        '<div style="font-size:11px;color:var(--color-text-muted);margin-bottom:2px;">Remaining</div>' +
        '<div class="mono" style="font-size:32px;font-weight:700;color:' + (draftRemaining > 0 ? 'var(--color-gold)' : 'var(--color-success)') + ';">' + fmt(draftRemaining) + '</div>' +
        (otherAmount > 0
          ? '<div style="display:flex;align-items:center;justify-content:center;gap:5px;font-size:11.5px;color:var(--color-text-muted);margin-top:4px;">' + adminDot(otherAdmin(state.currentAdmin)) + escapeHtml(adminName(otherAdmin(state.currentAdmin))) + ' already paid <span class="mono" style="font-weight:700;color:var(--color-text);">' + fmt(otherAmount) + '</span></div>'
          : '') +
      '</div>' +
      '<div>' +
        '<div style="font-size:12px;font-weight:600;color:var(--color-text-muted);margin-bottom:8px;">Your contribution</div>' +
        '<div style="display:flex;gap:8px;">' +
          '<input data-field="payoutDraftAmount" type="text" inputmode="numeric" value="' + rawDraft + '" style="flex:1 1 auto;min-width:0;font-size:16px;font-weight:700;padding:10px 12px;border-radius:10px;border:1px solid ' + (exceeds ? 'var(--color-danger)' : 'var(--color-border)') + ';" />' +
          '<button class="btn btn-outline" style="flex-shrink:0;" data-action="fill-remaining-payout" data-mid="' + w.memberId + '" data-amount="' + maxForMe + '">Fill remaining</button>' +
        '</div>' +
        (exceeds
          ? '<div style="font-size:11px;color:var(--color-danger);margin-top:6px;">Exceeds the payout total by ' + fmt(rawDraft - maxForMe) + ' — reduce to save.</div>'
          : '<div style="font-size:11px;color:var(--color-text-muted);margin-top:6px;">Up to ' + fmt(maxForMe) + ' — the rest of the target after ' + adminName(otherAdmin(state.currentAdmin)) + '\'s share.</div>') +
      '</div>' +
      '<div>' +
        '<div style="font-size:12px;font-weight:600;color:var(--color-text-muted);margin-bottom:8px;">Your holdings, if you save this</div>' +
        '<div class="stat"><div class="label">' + adminDot(state.currentAdmin) + adminName(state.currentAdmin) + '</div><div class="value" style="' + (myAfter < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(myBefore) + ' <span style="color:var(--color-text-faint);font-weight:400;">→</span> ' + signed(myAfter) + '</div></div>' +
      '</div>' +
      '<button class="btn btn-primary ' + (exceeds ? 'disabled' : '') + '" style="width:100%;" data-action="save-payout" data-mid="' + w.memberId + '">Save</button>' +
    '</div>' +
  '</div></div>';
}
