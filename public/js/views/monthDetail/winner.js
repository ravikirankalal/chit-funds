import { state } from '../../store.js';
import { colorFor, initialsOf, escapeHtml, fmt, monthLabel } from '../../helpers.js';
import { monthFinances } from '../../finance/monthFinances.js';
import { iconTrophy, iconClose } from '../../icons.js';

// One labeled row in the confirm step below — a plain label/value pair,
// same shape as the app's other confirm-before-you-write moments (the
// payout modal's before/after, the hand-off success card's holdings row).
function confirmRow(label, valueHtml) {
  return '<div style="display:flex;justify-content:space-between;align-items:center;">' +
    '<span style="font-size:12.5px;color:var(--color-text-muted);">' + label + '</span>' +
    '<span style="font-size:13px;font-weight:600;">' + valueHtml + '</span>' +
  '</div>';
}

// Shown once a name is tapped in the list below, in place of it — a plain
// tap used to write the winner straight to Firestore with no way back if
// it was the wrong row (easy to fat-finger on a members list, and unlike
// most of this app's writes, there's no biometric gate in front of it to
// double as a pause). This spells out exactly what's about to be recorded
// — who, for which BC/month, and how much — before actually calling
// addWinner (actions/winners/picker.js); "Back" (cancelWinnerCandidate)
// returns to the list without writing anything.
//
// Leans on gold throughout (badge, card wash, Confirm button) rather than
// the app's usual neutral card + primary-blue button — this is the one
// moment naming this month's winner, and gold is already this app's
// established "winner" color everywhere else (the trophy badge over the
// avatar and the left border stripe on summary.js's own winner card use
// the exact same --color-gold tokens), so reusing it here ties the
// confirmation back to that same identity instead of reading as just
// another form to submit.
function renderWinnerConfirmStep(candidateId, group, members) {
  var mm = members.find(function (x) { return x.id === candidateId; });
  var idx = mm ? members.indexOf(mm) : -1;
  var m = state.viewMonth;
  var scheduled = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
  return '<div style="display:flex;flex-direction:column;gap:16px;">' +
    '<div style="display:flex;align-items:center;gap:12px;">' +
      '<div style="position:relative;flex-shrink:0;">' +
        '<div class="avatar" style="background:' + colorFor(idx) + ';box-shadow:0 0 0 2px var(--color-surface);">' + (mm ? initialsOf(mm.name) : '?') + '</div>' +
        '<div style="position:absolute;right:-4px;bottom:-4px;width:22px;height:22px;border-radius:50%;background:var(--color-gold);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px var(--color-surface);">' + iconTrophy('var(--on-brand)', 13) + '</div>' +
      '</div>' +
      '<div><div style="font-size:16px;font-weight:700;">' + escapeHtml(mm ? mm.name : '') + '</div>' +
      '<div style="font-size:12px;font-weight:600;color:var(--color-gold-strong);">This month\'s winner</div></div>' +
    '</div>' +
    '<div class="card" style="background:var(--color-gold-soft);border-color:var(--color-gold-soft);display:flex;flex-direction:column;gap:10px;">' +
      confirmRow('BC name', escapeHtml(group.name)) +
      confirmRow('Month', escapeHtml(monthLabel(group.startYear, group.startMonthIndex, m))) +
      confirmRow('Amount', '<span class="mono" style="color:var(--color-gold-strong);">' + fmt(scheduled) + '</span>') +
    '</div>' +
    '<div style="display:flex;gap:8px;">' +
      '<button class="btn btn-outline" style="flex:1 1 0;" data-action="cancel-winner-candidate">Back</button>' +
      '<button class="btn" style="flex:2 1 0;display:flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(155deg, var(--color-gold) 0%, var(--color-gold-strong) 100%);color:var(--on-brand);box-shadow:var(--shadow-sm);" data-action="add-winner" data-mid="' + candidateId + '">' + iconTrophy('var(--on-brand)', 16) + 'Confirm winner</button>' +
    '</div>' +
  '</div>';
}

// The winner picker overlay — the winner(s) themselves are shown on
// their own card at the top of the month's summary instead (monthDetail/
// summary.js's renderWinnerTopCards), for both open and closed months alike,
// complete with payout status and a Remove link while removable. That's
// also where "Add another winner"/"Select Winner" opens this from
// (monthDetail/index.js), so nothing here needs its own winner-listing card.
export function renderWinnerPickerOverlay(gid, group, f, members) {
  var wonIds = {};
  for (var m2 = 1; m2 <= group.durationMonths; m2++) {
    var mf = monthFinances(gid, group, m2);
    if (mf.closed) mf.winners.forEach(function (w) { wonIds[w.memberId] = true; });
  }
  f.winners.forEach(function (w) { wonIds[w.memberId] = true; }); // already added to this (still-open) month
  var eligible = members.filter(function (mm) { return !wonIds[mm.id]; });
  // A candidate stops being valid mid-picker if, say, a second admin's
  // session already added them as a winner elsewhere and this cache just
  // caught up — falls back to the plain list rather than confirming
  // something no longer eligible.
  var candidateId = state.ui.winnerPickerConfirm;
  var confirming = candidateId && eligible.some(function (mm) { return mm.id === candidateId; });

  var body;
  if (confirming) {
    body = renderWinnerConfirmStep(candidateId, group, members);
  } else {
    var winnerRows = eligible.map(function (mm) {
      var idx = members.indexOf(mm);
      return '<div class="list-row" data-action="select-winner-candidate" data-mid="' + mm.id + '">' +
        '<div class="avatar sm" style="background:' + colorFor(idx) + ';">' + initialsOf(mm.name) + '</div>' +
        '<div style="flex:1 1 auto;font-size:13px;font-weight:500;">' + escapeHtml(mm.name) + '</div>' +
      '</div>';
    }).join('') || '<div style="font-size:12.5px; color:var(--color-text-muted); text-align:center; padding:20px;">Everyone has already won this cycle.</div>';
    body = winnerRows;
  }

  return '<div class="overlay"><div class="sheet">' +
    '<div class="sheet-header"><div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700;' + (confirming ? 'color:var(--color-gold-strong);' : '') + '">' + iconTrophy(confirming ? 'var(--color-gold)' : undefined) + (confirming ? 'Confirm winner' : 'Select this month\'s winner') + '</div>' +
    '<div class="sheet-close" data-action="close-winner-picker">' + iconClose() + '</div></div>' +
    '<div class="sheet-body">' + body + '</div>' +
  '</div></div>';
}
