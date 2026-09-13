import { state, groupsById, membersByGroup } from '../store.js';
import { fmt, escapeHtml, monthLabel } from '../helpers.js';
import { monthFinances } from '../finance.js';
import { iconChevronLeft } from '../icons.js';

export function renderGroupDetail() {
  var gid = state.activeGroupId;
  var group = groupsById.get(gid);
  if (!group) return '<div class="content"><div class="card">Group not found.</div></div>';
  var members = membersByGroup.get(gid) || [];

  var collectedSoFar = 0;
  for (var i = 1; i <= group.currentMonth; i++) collectedSoFar += monthFinances(gid, group, i).totalCollected;

  var rows = [];
  // Only past + the current month are shown — future months carry no data yet.
  for (var m = 1; m <= group.currentMonth; m++) {
    var f = monthFinances(gid, group, m);
    var subtitle, statusLabel, statusColor, badgeBg, badgeColor;
    if (f.closed) {
      var winner = members.find(function (mm) { return mm.id === f.monthDoc.winnerId; });
      subtitle = 'Winner: ' + (winner ? escapeHtml(winner.name) : '—');
      statusLabel = fmt(f.payoutAmount); statusColor = '#6f6a62';
      badgeBg = '#e6f2ec'; badgeColor = '#146b52';
    } else {
      subtitle = f.paidCount + ' / ' + members.length + ' paid so far';
      statusLabel = 'In progress'; statusColor = '#146b52';
      badgeBg = '#146b52'; badgeColor = '#fff';
    }
    rows.push('<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '">' +
      '<div class="avatar sm" style="background:' + badgeBg + '; color:' + badgeColor + ';">' + m + '</div>' +
      '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">Month ' + m + '</div>' +
      '<div style="font-size:11.5px;color:var(--text-muted);margin-top:1px;">' + subtitle + '</div></div>' +
      '<div style="font-size:13px;font-weight:700;color:' + statusColor + ';">' + statusLabel + '</div>' +
    '</div>');
  }

  return '' +
    '<div class="screen">' +
      '<div class="topbar">' +
        '<div class="back" data-action="nav-back">' + iconChevronLeft() + '</div>' +
        '<div><div class="title">' + escapeHtml(group.name) + '</div>' +
        '<div class="subtitle">Month ' + group.currentMonth + ' of ' + group.durationMonths + ' · started ' + monthLabel(group.startYear, group.startMonthIndex, 1) + '</div></div>' +
      '</div>' +
      '<div class="content">' +
        '<div class="stat-row">' +
          '<div class="stat"><div class="label">Monthly deposit</div><div class="value">' + fmt(group.monthlyDeposit) + '</div></div>' +
          '<div class="stat"><div class="label">Collected so far</div><div class="value">' + fmt(collectedSoFar) + '</div></div>' +
          '<div class="stat"><div class="label">Members</div><div class="value">' + members.length + '</div></div>' +
        '</div>' +
        '<div><div class="section-label">Months</div><div class="row-list">' + rows.join('') + '</div></div>' +
      '</div>' +
    '</div>';
}
