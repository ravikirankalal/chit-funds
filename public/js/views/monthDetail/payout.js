import { state } from '../../store.js';
import { fmt, escapeHtml, colorFor, initialsOf, adminName, adminDot, adminAvatarColor, otherAdmin } from '../../helpers.js';
import { iconClose, iconFillToMax, iconCheck, iconWarningTriangle, iconPayout } from '../../icons.js';
import { signed } from './shared.js';

// Each admin records their own contribution toward a winner's payout —
// there's no approval step: the month closes itself automatically the
// instant every winner's paidByA + paidByB reaches its payoutAmount (see
// setPayoutContribution in actions/winners/payout.js). Tapping a winner's
// card in the summary (summary.js's renderWinnerTopCards) opens this modal
// to enter/adjust the signed-in admin's own share — there's no separate
// "Record payout" card of its own any more.
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
  // The hero figure is the actual rupee amount being edited (what an admin
  // is typing into the input below), not a "Remaining" total that says
  // nothing about whose job it is to close the gap. The percentage of the
  // payout that amount represents is auto-computed as a small status line
  // underneath it, live as they type — never exceeds 100%, since
  // draftAmount is already clamped to maxForMe above.
  var pct = w.payoutAmount > 0 ? Math.round((draftAmount / w.payoutAmount) * 100) : 0;
  var pctColor = exceeds ? 'var(--color-danger)' : (draftRemaining <= 0 ? 'var(--color-success)' : 'var(--color-gold)');
  var otherPct = (otherAmount > 0 && w.payoutAmount > 0) ? Math.round((otherAmount / w.payoutAmount) * 100) : 0;
  // Three colors, three distinct facts, everything else plain text: the
  // signed-in admin's own contribution (amount + its %) in pctColor — the
  // same covering/partial/over tone the rest of the app uses; the OTHER
  // admin's already-recorded amount (+ its %) in THEIR OWN avatar color,
  // the same one their dot/holdings use everywhere else, since it's a
  // settled fact about them, not a live status; and the payout target
  // itself in blue wherever it's named, matching Collections elsewhere.
  var otherColor = adminAvatarColor(otherAdmin(state.currentAdmin));
  // setPayoutContribution (actions/winners/payout.js) drives this sheet
  // through its own saving/success/error states instead of the app-wide
  // busy overlay — see payments.js's savePaymentModal for the same fix.
  // `locked` covers both saving and the success state the sheet now sits
  // in until the admin closes it themselves.
  var saving = pm.saveState === 'saving';
  var justSaved = pm.saveState === 'success';
  var saveError = pm.saveState === 'error' ? pm.saveError : null;
  var locked = saving || justSaved;

  // Same top-edge + badge + pill trio as the payment sheet's "Collection"
  // marker (paymentModal.js) — same layout, opposite color and icon
  // (accent/payout vs. success/collection), so which sheet is open reads
  // at a glance instead of by process of elimination.
  var kindBadge = '<div style="position:absolute;right:-4px;bottom:-4px;width:20px;height:20px;border-radius:50%;background:var(--color-accent);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--color-surface);">' + iconPayout('var(--on-brand)', 11) + '</div>';
  var kindPill = '<div style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:var(--color-accent);background:var(--color-accent-soft);padding:3px 9px;border-radius:20px;margin-bottom:4px;">' + iconPayout('var(--color-accent)', 12) + 'Payout</div>';

  return '<div class="overlay"><div class="sheet" style="border-top:4px solid var(--color-accent);">' +
    '<div class="sheet-header">' +
      '<div style="position:relative;flex-shrink:0;"><div class="avatar sm" style="background:' + colorFor(widx) + ';">' + (winner ? initialsOf(winner.name) : '?') + '</div>' + kindBadge + '</div>' +
      '<div style="flex:1 1 auto;min-width:0;">' + kindPill +
      '<div style="font-size:14px;font-weight:700;">' + (winner ? escapeHtml(winner.name) : '—') + '</div>' +
      '<div style="font-size:11.5px;color:var(--color-text);">Payout target <span style="color:var(--color-primary);font-weight:700;">' + fmt(w.payoutAmount) + '</span></div></div>' +
      // Dropped entirely (not just visually dimmed) only while the write
      // is actually in flight — same convention as payments.js's payment
      // sheet. Stays clickable once justSaved, since the sheet no longer
      // closes itself: this is how the admin dismisses it afterward.
      (saving ? '<div class="sheet-close" style="opacity:0.35;">' + iconClose() + '</div>' : '<div class="sheet-close" data-action="close-payout-modal">' + iconClose() + '</div>') +
    '</div>' +
    '<div class="sheet-body">' +
      '<div style="text-align:center;padding:8px 0 4px;">' +
        '<div style="font-size:11px;color:var(--color-text);margin-bottom:2px;">Your contribution</div>' +
        '<div class="mono" style="font-size:36px;font-weight:700;color:' + pctColor + ';">' + fmt(draftAmount) + '</div>' +
        '<div style="font-size:13px;color:var(--color-text);margin-top:2px;font-weight:600;"><span style="color:' + pctColor + ';">' + pct + '%</span> of the <span style="color:var(--color-primary);">' + fmt(w.payoutAmount) + '</span> payout</div>' +
        (otherAmount > 0
          // Only worth a line when it's actually true — with nothing from
          // the other admin yet, this contribution and the before/after
          // holdings below are the whole story.
          ? '<div style="display:flex;align-items:center;justify-content:center;gap:5px;font-size:11.5px;color:var(--color-text);margin-top:8px;">' + adminDot(otherAdmin(state.currentAdmin)) + escapeHtml(adminName(otherAdmin(state.currentAdmin))) + ' paid <span class="mono" style="font-weight:700;color:' + otherColor + ';">' + fmt(otherAmount) + '</span> <span style="font-weight:700;color:' + otherColor + ';">(' + otherPct + '%)</span></div>'
          : '') +
      '</div>' +
      '<div>' +
        '<div style="display:flex;gap:8px;">' +
          '<input data-field="payoutDraftAmount" type="text" inputmode="numeric" value="' + rawDraft + '"' + (locked ? ' disabled' : '') + ' style="flex:1 1 auto;min-width:0;font-size:16px;font-weight:700;padding:10px 12px;border-radius:10px;border:1px solid ' + (exceeds ? 'var(--color-danger)' : 'var(--color-border)') + ';' + (locked ? 'opacity:0.6;' : '') + '" />' +
          (locked ? '' : '<button class="btn btn-outline" style="flex-shrink:0;display:flex;align-items:center;justify-content:center;" data-action="fill-remaining-payout" data-mid="' + w.memberId + '" data-amount="' + maxForMe + '" title="Fill remaining">' + iconFillToMax() + '</button>') +
        '</div>' +
        (exceeds
          ? '<div style="font-size:11px;color:var(--color-danger);margin-top:6px;">Exceeds the payout total by ' + fmt(rawDraft - maxForMe) + ' — reduce to save.</div>'
          : '<div style="font-size:11px;color:var(--color-text);margin-top:6px;">Up to ' + fmt(maxForMe) + ' available to contribute.</div>') +
      '</div>' +
      '<div>' +
        '<div style="font-size:12px;font-weight:600;color:var(--color-text);margin-bottom:8px;">Your holdings, if you save this</div>' +
        // Before and after each get their own sign-based color rather than
        // the after figure alone deciding the whole line's tone — a healthy
        // before sliding into a negative after (or the reverse) should read
        // as two distinct facts, not get flattened into one color.
        '<div class="stat"><div class="label">' + adminDot(state.currentAdmin) + escapeHtml(adminName(state.currentAdmin)) + '</div><div class="value"><span style="color:' + (myBefore < 0 ? 'var(--color-danger)' : 'var(--color-text)') + ';">' + signed(myBefore) + '</span> <span style="color:var(--color-text-faint);font-weight:400;">→</span> <span style="color:' + (myAfter < 0 ? 'var(--color-danger)' : 'var(--color-text)') + ';">' + signed(myAfter) + '</span></div></div>' +
      '</div>' +
      (saveError ? '<div class="error-text" style="display:flex;align-items:center;gap:6px;font-weight:600;">' + iconWarningTriangle('var(--color-danger)') + 'Could not save: ' + escapeHtml(saveError) + '</div>' : '') +
      (justSaved
        ? '<div class="btn" style="width:100%;background:var(--color-success-soft);color:var(--color-success);display:flex;align-items:center;justify-content:center;gap:8px;pointer-events:none;">' + iconCheck('var(--color-success)') + 'Saved</div>'
        : '<button class="btn btn-accent' + ((exceeds || saving) ? ' disabled' : '') + '" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;" data-mid="' + w.memberId + '"' + (saving ? '' : ' data-action="save-payout"') + '>' +
            (saving ? '<div class="spinner" style="width:16px;height:16px;border-color:rgba(255,255,255,0.35);border-top-color:#fff;"></div>Paying out…' : 'Payout') +
          '</button>'
      ) +
    '</div>' +
  '</div></div>';
}
