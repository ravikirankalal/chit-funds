import { colorFor, initialsOf, escapeHtml } from '../../helpers.js';
import { monthFinances } from '../../finance/monthFinances.js';
import { iconTrophy, iconClose } from '../../icons.js';

// The winner picker overlay only — the winner(s) themselves are shown on
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
