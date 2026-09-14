import { state, groupsById, membersById, monthKey, paymentsCache } from '../store.js';
import { fmt, escapeHtml, monthLabel, adminName, formatDateTime } from '../helpers.js';
import { monthFinances } from '../finance.js';
import { iconChevronLeft, iconCheck, iconWallet, iconTrophy, iconCalendar, iconPeopleSmall } from '../icons.js';

export function renderMemberPayments() {
  var gid = state.activeGroupId;
  var mid = state.viewMemberId;
  var group = groupsById.get(gid);
  var member = membersById.get(mid);
  if (!group || !member) return '<div class="content"><div class="card">' + (state.groupsLoaded ? 'Member not found.' : 'Loading…') + '</div></div>';

  var rows = [];
  var totalPaid = 0;
  for (var m = 1; m <= group.currentMonth; m++) {
    var p = (paymentsCache.get(monthKey(gid, m)) || {})[mid];
    var f = monthFinances(gid, group, m);
    var winEntry = f.closed && f.winners.find(function (w) { return w.memberId === mid; });
    var subtitle, statusBg, statusColor, statusLabel;
    if (p && p.paid) {
      totalPaid += group.monthlyDeposit;
      subtitle = 'Collected by <span style="font-weight:600;color:var(--accent);">' + adminName(p.collectedBy) + '</span> · ' + (p.mode === 'online' ? 'Online' : 'Cash') + (formatDateTime(p.paidAt) ? ' · ' + formatDateTime(p.paidAt) : '');
      statusBg = 'var(--accent-soft)'; statusColor = 'var(--accent)'; statusLabel = iconCheck('var(--accent)') + 'Paid';
    } else {
      subtitle = '<span style="color:var(--danger);">Not paid</span>';
      statusBg = '#fbe9e7'; statusColor = 'var(--danger)'; statusLabel = 'Unpaid';
    }
    if (winEntry) subtitle += ' · <span style="display:inline-flex;align-items:center;gap:3px;font-weight:600;color:var(--accent);">' + iconTrophy('var(--accent)') + 'Won ' + fmt(winEntry.payoutAmount) + '</span>';

    rows.push('<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '">' +
      '<div class="avatar sm" style="background:var(--bg); color:var(--text-muted);">' + m + '</div>' +
      '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">' + monthLabel(group.startYear, group.startMonthIndex, m) + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:1px;">' + subtitle + '</div></div>' +
      '<div style="flex-shrink:0;display:flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:5px 10px;border-radius:20px;background:' + statusBg + ';color:' + statusColor + ';">' + statusLabel + '</div>' +
    '</div>');
  }

  return '' +
    '<div class="screen">' +
      '<div class="topbar">' +
        '<div class="back" data-action="nav-back">' + iconChevronLeft() + '</div>' +
        '<div><div class="title">' + iconPeopleSmall('currentColor', 18) + escapeHtml(member.name) + '</div><div class="subtitle">' + escapeHtml(group.name) + ' · Payment history</div></div>' +
      '</div>' +
      '<div class="content">' +
        '<div class="stat-row">' +
          '<div class="stat"><div class="label">' + iconWallet() + 'Paid so far</div><div class="value">' + fmt(totalPaid) + '</div></div>' +
        '</div>' +
        '<div><div class="section-label">' + iconCalendar() + 'Payments</div><div class="row-list">' + (rows.join('') || '<div class="card" style="color:var(--text-muted);font-size:13px;text-align:center;">No months yet.</div>') + '</div></div>' +
      '</div>' +
    '</div>';
}
