import { state, groupsById, membersById, membersByGroup } from '../store.js';
import { fmt, escapeHtml, monthLabel, initialsOf, colorFor, isSuper } from '../helpers.js';
import { monthFinances } from '../finance.js';
import { iconChevronLeft, iconClose } from '../icons.js';

export function renderGroupDetail() {
  var gid = state.activeGroupId;
  var group = groupsById.get(gid);
  if (!group) return '<div class="content"><div class="card">' + (state.groupsLoaded ? 'Group not found.' : 'Loading…') + '</div></div>';
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
      '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">' + monthLabel(group.startYear, group.startMonthIndex, m) + '</div>' +
      '<div style="font-size:11.5px;color:var(--text-muted);margin-top:1px;">' + subtitle + '</div></div>' +
      '<div style="font-size:13px;font-weight:700;color:' + statusColor + ';">' + statusLabel + '</div>' +
    '</div>');
  }

  var html = '' +
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
        (isSuper() ? '' : '<button class="btn btn-soft" style="width:100%;" data-action="open-add-member-to-group" data-gid="' + gid + '">+ Add member to this group</button>') +
        '<div><div class="section-label">Months</div><div class="row-list">' + rows.join('') + '</div></div>' +
      '</div>';

  if (state.ui.addMemberToGroup && state.ui.addMemberToGroup.gid === gid) {
    html += renderAddMemberOverlay(gid);
  }
  return html;
}

function renderAddMemberOverlay(gid) {
  var amg = state.ui.addMemberToGroup;
  var currentIds = {};
  (membersByGroup.get(gid) || []).forEach(function (m) { currentIds[m.id] = true; });
  var available = Array.from(membersById.values())
    .filter(function (m) { return !currentIds[m.id]; })
    .sort(function (a, b) { return a.name.localeCompare(b.name); });

  var rows = available.map(function (mm, idx) {
    return '<div class="list-row" data-action="add-existing-member-to-group" data-gid="' + gid + '" data-mid="' + mm.id + '">' +
      '<div class="avatar sm" style="background:' + colorFor(idx) + ';">' + initialsOf(mm.name) + '</div>' +
      '<div style="flex:1 1 auto;font-size:13px;font-weight:500;">' + escapeHtml(mm.name) + '</div>' +
      '<div style="color:var(--accent);font-size:12px;font-weight:600;">Add</div></div>';
  }).join('') || '<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Every existing member is already in this group.</div>';

  return '<div class="overlay"><div class="sheet">' +
    '<div class="sheet-header"><div style="font-size:14px;font-weight:700;">Add member</div>' +
    '<div class="sheet-close" data-action="close-add-member-to-group">' + iconClose() + '</div></div>' +
    '<div class="sheet-body">' +
      '<div><div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;">Existing members</div><div class="row-list">' + rows + '</div></div>' +
      '<div class="field"><label>Or add a brand new member</label>' +
        '<div style="display:flex;gap:8px;"><input data-field="addMemberDraftName" value="' + escapeHtml(amg.draftName) + '" placeholder="Full name" style="flex:1 1 auto;padding:12px 14px;border-radius:10px;border:1px solid var(--border);" />' +
        '<button class="btn btn-primary" style="padding:12px 16px;" data-action="create-and-add-member-to-group" data-gid="' + gid + '">Add</button></div>' +
      '</div>' +
    '</div>' +
  '</div></div>';
}
