// The shared member directory — independent of any single group, so the
// same person can be added to as many groups as needed (see groupDetail/
// for the "add to this group" side of that). Tapping a row edits the
// member's own details; a group only ever stores memberIds[] pointing here.

import { state, groupsById, membersById, membersByGroup } from '../store.js';
import { escapeHtml, initialsOf, colorFor, isSuper } from '../helpers.js';
import { iconPlus, iconPlusSmall, iconClose, iconGroupStack, iconPeople } from '../icons.js';
import { renderBottomNav } from './bottomNav.js';

export function renderMembers() {
  var allMembers = Array.from(membersById.values()).sort(function (a, b) { return a.name.localeCompare(b.name); });

  var rows = allMembers.map(function (mm, idx) {
    var groupNames = [];
    groupsById.forEach(function (group, gid) {
      var list = membersByGroup.get(gid) || [];
      if (list.some(function (x) { return x.id === mm.id; })) groupNames.push(group.name);
    });
    var subtitle = groupNames.length ? groupNames.join(', ') : 'Not in any group yet';
    return '<div class="list-row" ' + (isSuper() ? '' : 'data-action="open-member-form" data-id="' + mm.id + '"') + '>' +
      '<div class="avatar sm" style="background:' + colorFor(idx) + ';">' + initialsOf(mm.name) + '</div>' +
      '<div style="flex:1 1 auto;min-width:0;"><div style="font-size:13px;font-weight:600;">' + escapeHtml(mm.name) + '</div>' +
      '<div style="display:flex;align-items:center;gap:4px;font-size:11.5px;color:var(--color-text-muted);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (groupNames.length ? iconGroupStack() : '') + escapeHtml(subtitle) + '</div></div>' +
    '</div>';
  }).join('') || '<div class="card" style="color:var(--color-text-muted);font-size:13px;text-align:center;">No members yet — tap + to add one.</div>';

  var html = '' +
    '<div class="screen">' +
      '<div style="padding:20px 20px 4px;"><div class="mono" style="display:flex;align-items:center;gap:7px;font-size:20px;font-weight:700;">' + iconPeople('var(--color-primary)') + 'Members</div>' +
      '<div style="font-size:12px;color:var(--color-text-muted);margin-top:2px;">Everyone across all groups — add once, use in any group</div></div>' +
      '<div class="content">' +
        '<div class="row-list">' + rows + '</div>' +
      '</div>' +
      (isSuper() ? '' : '<button class="fab" data-action="open-member-form">' + iconPlus() + '</button>') +
      renderBottomNav('members');

  if (state.ui.memberForm) html += renderMemberFormOverlay(state.ui.memberForm);
  return html;
}

function renderMemberFormOverlay(mf) {
  var isNew = !mf.id;
  return '<div class="overlay"><div class="sheet">' +
    '<div class="sheet-header"><div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700;">' + (isNew ? iconPlusSmall() : '') + (isNew ? 'Add member' : 'Edit member') + '</div>' +
    '<div class="sheet-close" data-action="close-member-form">' + iconClose() + '</div></div>' +
    '<div class="sheet-body">' +
      '<div class="field"><label>Name</label><input data-field="memberFormName" value="' + escapeHtml(mf.name) + '" placeholder="Full name" /></div>' +
      '<button class="btn btn-primary" style="width:100%;" data-action="save-member-form" ' + (mf.name.trim() ? '' : 'disabled') + '>' + (isNew ? 'Add Member' : 'Save Changes') + '</button>' +
    '</div>' +
  '</div></div>';
}
