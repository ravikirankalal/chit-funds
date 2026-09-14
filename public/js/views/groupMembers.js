import { state, groupsById, membersById, membersByGroup } from '../store.js';
import { fmt, escapeHtml, monthLabel, initialsOf, colorFor, isSuper } from '../helpers.js';
import { monthFinances, memberHasPaidInGroup } from '../finance.js';
import { iconChevronLeft, iconChevronRight, iconPlus, iconPlusSmall, iconPeople, iconPeopleSmall, iconClose, iconTrophy, iconTrash } from '../icons.js';

export function renderGroupMembers() {
  var gid = state.activeGroupId;
  var group = groupsById.get(gid);
  if (!group) return '<div class="content"><div class="card">' + (state.groupsLoaded ? 'Group not found.' : 'Loading…') + '</div></div>';
  var members = membersByGroup.get(gid) || [];
  var readOnly = isSuper();

  // Who has already been paid their winning amount, and when — looked up by
  // member id (not the current members list) so it still resolves correctly
  // if a winner is ever removed from the group later.
  var winsByMember = {};
  for (var wm = 1; wm <= group.currentMonth; wm++) {
    var wf = monthFinances(gid, group, wm);
    if (wf.closed) {
      wf.winners.forEach(function (w) { winsByMember[w.memberId] = { month: wm, amount: w.payoutAmount }; });
    }
  }

  var rows = members.map(function (mm, idx) {
    var canRemove = !readOnly && !memberHasPaidInGroup(gid, group, mm.id);
    var win = winsByMember[mm.id];
    return '<div class="list-row" data-action="open-member-payments" data-gid="' + gid + '" data-mid="' + mm.id + '" style="cursor:pointer;">' +
      '<div class="avatar sm" style="background:' + colorFor(idx) + ';">' + initialsOf(mm.name) + '</div>' +
      '<div style="flex:1 1 auto; min-width:0;">' +
        '<div style="font-size:13px;font-weight:500;">' + escapeHtml(mm.name) + '</div>' +
        (win ? '<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:#146b52;margin-top:1px;">' + iconTrophy('#146b52') + 'Received ' + fmt(win.amount) + ' · ' + monthLabel(group.startYear, group.startMonthIndex, win.month) + '</div>' : '') +
      '</div>' +
      (canRemove ? '<div data-action="remove-member-from-group" data-gid="' + gid + '" data-mid="' + mm.id + '" style="display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--danger);font-size:12px;font-weight:600;">' + iconTrash('var(--danger)') + 'Remove</div>' : '') +
      iconChevronRight() +
    '</div>';
  }).join('') || '<div class="card" style="color:var(--text-muted);font-size:13px;text-align:center;">No members yet.</div>';

  var html = '' +
    '<div class="screen">' +
      '<div class="topbar">' +
        '<div class="back" data-action="nav-back">' + iconChevronLeft() + '</div>' +
        '<div><div class="title">' + iconPeople('currentColor') + 'Members</div><div class="subtitle">' + escapeHtml(group.name) + '</div></div>' +
      '</div>' +
      '<div class="content">' +
        '<div class="row-list">' + rows + '</div>' +
      '</div>' +
      (readOnly ? '' : '<button class="fab" data-action="open-add-member-to-group" data-gid="' + gid + '">' + iconPlus() + '</button>') +
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
      '<div style="display:flex;align-items:center;gap:3px;color:var(--accent);font-size:12px;font-weight:600;">' + iconPlusSmall('var(--accent)') + 'Add</div></div>';
  }).join('') || '<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Every existing member is already in this group.</div>';

  return '<div class="overlay"><div class="sheet">' +
    '<div class="sheet-header"><div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700;">' + iconPlusSmall() + 'Add member</div>' +
    '<div class="sheet-close" data-action="close-add-member-to-group">' + iconClose() + '</div></div>' +
    '<div class="sheet-body">' +
      '<div><div style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;">' + iconPeopleSmall() + 'Existing members</div><div class="row-list">' + rows + '</div></div>' +
      '<div class="field"><label>Or add a brand new member</label>' +
        '<div style="display:flex;gap:8px;"><input data-field="addMemberDraftName" value="' + escapeHtml(amg.draftName) + '" placeholder="Full name" style="flex:1 1 auto;padding:12px 14px;border-radius:10px;border:1px solid var(--border);" />' +
        '<button class="btn btn-primary" style="padding:12px 16px;" data-action="create-and-add-member-to-group" data-gid="' + gid + '">Add</button></div>' +
      '</div>' +
    '</div>' +
  '</div></div>';
}
