import { state, groupsById, membersById } from '../store.js';
import { fmt, escapeHtml, monthLabel } from '../helpers.js';
import { monthFinances } from '../finance.js';
import { iconChevronLeft } from '../icons.js';

export function renderPaymentSchedule() {
  var gid = state.activeGroupId;
  var group = groupsById.get(gid);
  if (!group) return '<div class="content"><div class="card">' + (state.groupsLoaded ? 'Group not found.' : 'Loading…') + '</div></div>';

  var rows = [];
  for (var m = 1; m <= group.durationMonths; m++) {
    var amount = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
    var isCurrent = m === group.currentMonth;
    var subtitle, statusColor, badgeBg, badgeColor;
    if (m <= group.currentMonth) {
      var f = monthFinances(gid, group, m);
      if (f.closed) {
        var winner = membersById.get(f.monthDoc.winnerId);
        subtitle = 'Paid to ' + (winner ? escapeHtml(winner.name) : '—');
        statusColor = '#6f6a62'; badgeBg = '#e6f2ec'; badgeColor = '#146b52';
      } else {
        subtitle = 'In progress'; statusColor = '#146b52'; badgeBg = '#146b52'; badgeColor = '#fff';
      }
    } else {
      subtitle = 'Upcoming'; statusColor = 'var(--text-muted)'; badgeBg = 'var(--bg)'; badgeColor = 'var(--text-muted)';
    }
    rows.push('<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '" style="' +
      (isCurrent ? 'background:var(--accent-soft);border:1px solid var(--accent);' : '') + '">' +
      '<div class="avatar sm" style="background:' + badgeBg + '; color:' + badgeColor + ';">' + m + '</div>' +
      '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">' + monthLabel(group.startYear, group.startMonthIndex, m) + (isCurrent ? ' · Current' : '') + '</div>' +
      '<div style="font-size:11.5px;color:var(--text-muted);margin-top:1px;">' + subtitle + '</div></div>' +
      '<div style="font-size:13px;font-weight:700;color:' + statusColor + ';">' + fmt(amount) + '</div>' +
    '</div>');
  }

  return '' +
    '<div class="screen">' +
      '<div class="topbar">' +
        '<div class="back" data-action="nav-back">' + iconChevronLeft() + '</div>' +
        '<div><div class="title">Payment schedule</div><div class="subtitle">' + escapeHtml(group.name) + '</div></div>' +
      '</div>' +
      '<div class="content">' +
        '<div class="row-list">' + rows.join('') + '</div>' +
      '</div>' +
    '</div>';
}
