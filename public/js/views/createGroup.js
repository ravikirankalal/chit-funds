import { state } from '../store.js';
import { fmt, escapeHtml, initialsOf, colorFor } from '../helpers.js';
import { iconChevronLeft } from '../icons.js';

export function renderCreateGroup() {
  var g = state.ui.newGroup;
  if (g.step === 1) return renderStep1(g);
  return renderStep2(g);
}

function renderStep1(g) {
  var dur = g.durationMonths, previewRows = '';
  for (var i = 0; i < dur; i++) {
    var t = dur > 1 ? i / (dur - 1) : 0;
    var amt = g.payoutStart + (g.payoutEnd - g.payoutStart) * t;
    previewRows += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--border);">' +
      '<div style="font-size:12.5px;color:var(--text-muted);">Month ' + (i + 1) + '</div><div style="font-size:13px;font-weight:600;">' + fmt(amt) + '</div></div>';
  }
  return '' +
    '<div class="screen">' +
      '<div class="topbar"><div class="back" data-action="cancel-create-group">' + iconChevronLeft() + '</div><div class="title">New Chit Group</div></div>' +
      '<div class="content">' +
        '<div class="field"><label>Group name</label><input data-field="name" value="' + escapeHtml(g.name) + '" placeholder="e.g. Friends Chit 2027" /></div>' +
        '<div class="field-row">' +
          '<div class="field"><label>Duration (months)</label><input data-field="durationMonths" type="number" value="' + g.durationMonths + '" /></div>' +
          '<div class="field"><label>Monthly deposit (₹)</label><input data-field="monthlyDeposit" type="number" value="' + g.monthlyDeposit + '" /></div>' +
        '</div>' +
        '<div style="height:1px;background:var(--border);"></div>' +
        '<div>' +
          '<div style="font-size:13px;font-weight:600;margin-bottom:2px;">Payout schedule</div>' +
          '<div style="font-size:11.5px;color:var(--text-muted);margin-bottom:12px;">Set the first and last month\'s payout — the months in between are generated automatically.</div>' +
          '<div class="field-row">' +
            '<div class="field"><label>Month 1 payout (₹)</label><input data-field="payoutStart" type="number" value="' + g.payoutStart + '" /></div>' +
            '<div class="field"><label>Final month payout (₹)</label><input data-field="payoutEnd" type="number" value="' + g.payoutEnd + '" /></div>' +
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
  var memberRows = g.members.map(function (m, idx) {
    return '<div class="list-row" style="cursor:default;"><div class="avatar sm" style="background:' + colorFor(idx) + ';">' + initialsOf(m.name) + '</div>' +
      '<div style="flex:1 1 auto;font-size:13px;font-weight:500;">' + escapeHtml(m.name) + '</div>' +
      '<div data-action="remove-draft-member" data-idx="' + idx + '" style="cursor:pointer; color:var(--danger); font-size:12px; font-weight:600;">Remove</div></div>';
  }).join('');

  return '' +
    '<div class="screen">' +
      '<div class="topbar"><div class="back" data-action="create-group-back-step1">' + iconChevronLeft() + '</div><div class="title">Add Members</div></div>' +
      '<div class="content">' +
        '<div class="field"><label>Member name</label>' +
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
