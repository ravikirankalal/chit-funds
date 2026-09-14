import { state, membersById } from '../store.js';
import { escapeHtml, initialsOf, colorFor, monthLabel } from '../helpers.js';
import { iconChevronLeft } from '../icons.js';

export function renderCreateGroup() {
  var g = state.ui.newGroup;
  if (g.step === 1) return renderStep1(g);
  return renderStep2(g);
}

function renderStep1(g) {
  var dur = g.durationMonths, previewRows = '';
  var now = new Date();
  for (var i = 0; i < dur; i++) {
    var amt = g.payoutSchedule[i] || 0;
    previewRows += '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border);">' +
      '<div style="font-size:12.5px;color:var(--text-muted);">' + monthLabel(now.getFullYear(), now.getMonth(), i + 1) + '</div>' +
      '<input data-field="payoutMonth" data-idx="' + i + '" type="text" inputmode="numeric" value="' + amt + '" style="width:110px;text-align:right;font-size:13px;font-weight:600;padding:6px 8px;border-radius:8px;border:1px solid var(--border);" />' +
    '</div>';
  }
  return '' +
    '<div class="screen">' +
      '<div class="topbar"><div class="back" data-action="cancel-create-group">' + iconChevronLeft() + '</div><div class="title">New Chit Group</div></div>' +
      '<div class="content">' +
        '<div class="field"><label>Group name</label><input data-field="name" value="' + escapeHtml(g.name) + '" placeholder="e.g. Friends Chit 2027" /></div>' +
        '<div class="field-row">' +
          '<div class="field"><label>Duration (months)</label><input data-field="durationMonths" type="text" inputmode="numeric" value="' + g.durationMonths + '" /></div>' +
          '<div class="field"><label>Monthly deposit (₹)</label><input data-field="monthlyDeposit" type="text" inputmode="numeric" value="' + g.monthlyDeposit + '" /></div>' +
        '</div>' +
        '<div style="height:1px;background:var(--border);"></div>' +
        '<div>' +
          '<div style="font-size:13px;font-weight:600;margin-bottom:2px;">Payout schedule</div>' +
          '<div style="font-size:11.5px;color:var(--text-muted);margin-bottom:12px;">Set the first and last month\'s payout to auto-fill the months in between, then fine-tune any individual month below. This locks once the group is created.</div>' +
          '<div class="field-row">' +
            '<div class="field"><label>' + monthLabel(now.getFullYear(), now.getMonth(), 1) + ' payout (₹)</label><input data-field="payoutStart" type="text" inputmode="numeric" value="' + g.payoutStart + '" /></div>' +
            '<div class="field"><label>Final month payout (₹)</label><input data-field="payoutEnd" type="text" inputmode="numeric" value="' + g.payoutEnd + '" /></div>' +
          '</div>' +
          '<div style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:12px;background:var(--surface);margin-top:12px;">' + previewRows + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="flex-shrink:0;padding:14px 20px;border-top:1px solid var(--border);background:var(--surface);">' +
        '<button class="btn btn-primary" style="width:100%;" data-action="create-group-step2" ' + (g.name.trim() ? '' : 'disabled') + '>Next: Add Members</button>' +
      '</div>' +
    '</div>';
}

function renderStep2(g) {
  var selectedIds = {};
  g.members.forEach(function (m) { if (m.id) selectedIds[m.id] = true; });
  var available = Array.from(membersById.values())
    .filter(function (m) { return !selectedIds[m.id]; })
    .sort(function (a, b) { return a.name.localeCompare(b.name); });

  var availableRows = available.map(function (mm, idx) {
    return '<div class="list-row" data-action="add-existing-draft-member" data-mid="' + mm.id + '">' +
      '<div class="avatar sm" style="background:' + colorFor(idx) + ';">' + initialsOf(mm.name) + '</div>' +
      '<div style="flex:1 1 auto;font-size:13px;font-weight:500;">' + escapeHtml(mm.name) + '</div>' +
      '<div style="color:var(--accent);font-size:12px;font-weight:600;">Add</div></div>';
  }).join('') || '<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">No other existing members — add a brand new one below.</div>';

  var memberRows = g.members.map(function (m, idx) {
    return '<div class="list-row" style="cursor:default;"><div class="avatar sm" style="background:' + colorFor(idx) + ';">' + initialsOf(m.name) + '</div>' +
      '<div style="flex:1 1 auto;font-size:13px;font-weight:500;">' + escapeHtml(m.name) + '</div>' +
      '<div data-action="remove-draft-member" data-idx="' + idx + '" style="cursor:pointer; color:var(--danger); font-size:12px; font-weight:600;">Remove</div></div>';
  }).join('');

  return '' +
    '<div class="screen">' +
      '<div class="topbar"><div class="back" data-action="create-group-back-step1">' + iconChevronLeft() + '</div><div class="title">Add Members</div></div>' +
      '<div class="content">' +
        '<div><div class="section-label">Existing members</div><div class="row-list">' + availableRows + '</div></div>' +
        '<div class="field"><label>Or add a brand new member</label>' +
          '<div style="display:flex; gap:8px;"><input data-field="draftMemberName" value="' + escapeHtml(g.draftMemberName) + '" placeholder="Full name" style="flex:1 1 auto; padding:12px 14px; border-radius:10px; border:1px solid var(--border);" />' +
          '<button class="btn btn-primary" style="padding:12px 16px;" data-action="add-draft-member">Add</button></div>' +
        '</div>' +
        '<div><div class="section-label">' + g.members.length + ' member' + (g.members.length === 1 ? '' : 's') + ' added</div><div class="row-list">' + memberRows + '</div></div>' +
      '</div>' +
      '<div style="flex-shrink:0;padding:14px 20px;border-top:1px solid var(--border);background:var(--surface);">' +
        '<button class="btn btn-primary" style="width:100%;" data-action="submit-create-group" ' + (g.members.length ? '' : 'disabled') + '>Create Group (' + g.members.length + ' members)</button>' +
      '</div>' +
    '</div>';
}
