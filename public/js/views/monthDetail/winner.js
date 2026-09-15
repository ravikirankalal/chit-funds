import { fmt, escapeHtml, colorFor, initialsOf } from '../../helpers.js';
import { monthFinances } from '../../finance/monthFinances.js';
import { iconTrophy, iconClose } from '../../icons.js';

// Almost always exactly one winner; occasionally an admin adds more than
// one within the same month (see getMonthWinners in finance/shared.js), each with
// its own editable payout amount. "Remove" + "Add another winner" covers
// what used to be a single "Change" link. Each winner locks independently
// once a payout contribution has been recorded toward THEM specifically
// (see winnerLocked in actions/winners/picker.js) — one winner's payout already being
// underway never blocks adding a new winner or editing a different,
// not-yet-started one.
//
// `closedMode` (true once the month itself has closed) narrows this down
// to just the still-unpaid winners — a winner added via "Add another
// winner" after close (actions/winners/picker.js's addWinner) that hasn't
// had a payout contribution recorded yet. Already-paid winners for a
// closed month are shown with their paid amounts in the closed summary
// card instead (monthDetail/summary.js) — repeating them here, locked and
// read-only, would just be clutter. closedMode also hides the "Add
// another winner" button, since a standalone one already lives at the
// true end of the page for closed months (monthDetail/index.js).
export function renderWinnerCard(f, members, readOnly, closedMode) {
  var winners = closedMode
    ? f.winners.filter(function (w) { return !((w.paidByA || 0) > 0 || (w.paidByB || 0) > 0); })
    : f.winners;
  if (closedMode && !winners.length) return '';
  var html = '<div class="card" style="display:flex;flex-direction:column;gap:10px;">' +
    '<div style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:600;">' + iconTrophy() + (winners.length > 1 ? 'This month\'s winners' : 'This month\'s winner') + '</div>';
  if (winners.length) {
    html += winners.map(function (w) {
      var winner = members.find(function (mm) { return mm.id === w.memberId; });
      var widx = winner ? members.indexOf(winner) : -1;
      var locked = (w.paidByA > 0 || w.paidByB > 0);
      var editable = !readOnly && !locked;
      return '<div class="list-row" style="border-left:3px solid var(--color-gold);cursor:default;">' +
        '<div class="avatar sm" style="background:' + colorFor(widx) + ';box-shadow:0 0 0 2px var(--color-surface),0 0 0 3px var(--color-gold);">' + (winner ? initialsOf(winner.name) : '?') + '</div>' +
        '<div style="flex:1 1 auto;font-size:13px;font-weight:600;color:var(--color-gold);min-width:0;">' + (winner ? escapeHtml(winner.name) : '—') +
          (locked ? '<div style="font-size:10.5px;font-weight:500;color:var(--color-text-muted);">Locked — payout underway</div>' : '') + '</div>' +
        (editable
          ? '<input data-winner-amount="' + w.memberId + '" type="text" inputmode="numeric" value="' + w.payoutAmount + '" style="width:100px;text-align:right;font-size:13px;font-weight:600;padding:6px 8px;border-radius:10px;border:1px solid var(--color-border);" />' +
            '<div data-action="remove-winner" data-mid="' + w.memberId + '" style="cursor:pointer;color:var(--color-danger);font-size:12px;font-weight:600;margin-left:10px;">Remove</div>'
          : '<div class="mono" style="font-size:13px;font-weight:700;color:var(--color-gold);">' + fmt(w.payoutAmount) + '</div>') +
      '</div>';
    }).join('');
  } else if (readOnly && !closedMode) {
    html += '<div style="font-size:12.5px;color:var(--color-text-muted);">No winner selected yet.</div>';
  }
  if (!readOnly && !closedMode) {
    html += '<button class="btn btn-primary" style="width:100%;" data-action="open-winner-picker">' + (f.winners.length ? 'Add another winner' : 'Select Winner') + '</button>';
  }
  html += '</div>';
  return html;
}

export function renderWinnerPickerOverlay(gid, group, f, members) {
  var wonIds = {};
  for (var m2 = 1; m2 <= group.durationMonths; m2++) {
    var mf = monthFinances(gid, group, m2);
    if (mf.closed) mf.winners.forEach(function (w) { wonIds[w.memberId] = true; });
  }
  f.winners.forEach(function (w) { wonIds[w.memberId] = true; }); // already added to this (still-open) month
  var eligible = members.filter(function (mm) { return !wonIds[mm.id]; });
  var winnerRows = eligible.map(function (mm) {
    var idx = members.indexOf(mm);
    return '<div class="list-row" data-action="add-winner" data-mid="' + mm.id + '">' +
      '<div class="avatar sm" style="background:' + colorFor(idx) + ';">' + initialsOf(mm.name) + '</div>' +
      '<div style="flex:1 1 auto;font-size:13px;font-weight:500;">' + escapeHtml(mm.name) + '</div>' +
    '</div>';
  }).join('') || '<div style="font-size:12.5px; color:var(--color-text-muted); text-align:center; padding:20px;">Everyone has already won this cycle.</div>';

  return '<div class="overlay"><div class="sheet">' +
    '<div class="sheet-header"><div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700;">' + iconTrophy() + 'Select this month\'s winner</div>' +
    '<div class="sheet-close" data-action="close-winner-picker">' + iconClose() + '</div></div>' +
    '<div class="sheet-body">' + winnerRows + '</div>' +
  '</div></div>';
}
