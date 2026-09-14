import { state, groupsById, membersByGroup } from '../store.js';
import { fmt, escapeHtml, monthLabel, adminName } from '../helpers.js';
import { monthFinances } from '../finance.js';
import { iconChevronLeft, iconChevronRight } from '../icons.js';

function signed(n) { return (n < 0 ? '−' : '') + fmt(Math.abs(n)); }

// A progress-bar comparison ("collected so far out of total collection")
// reads at a glance; the plain label/value rows this replaced didn't.
function progressCard(label, value, total, barColor) {
  var pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return '<div class="card" style="display:flex;flex-direction:column;gap:8px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:baseline;">' +
      '<div style="font-size:12px;color:var(--text-muted);font-weight:500;">' + label + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);font-weight:600;">' + pct + '%</div>' +
    '</div>' +
    '<div class="mono" style="font-size:20px;font-weight:700;">' + fmt(value) + ' <span style="font-size:12px;color:var(--text-muted);font-weight:500;">of ' + fmt(total) + '</span></div>' +
    '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%; background:' + barColor + ';"></div></div>' +
  '</div>';
}

export function renderGroupDetail() {
  var gid = state.activeGroupId;
  var group = groupsById.get(gid);
  if (!group) return '<div class="content"><div class="card">' + (state.groupsLoaded ? 'Group not found.' : 'Loading…') + '</div></div>';
  var members = membersByGroup.get(gid) || [];

  var collectedSoFar = 0, payoutSoFar = 0, holdA = 0, holdB = 0;
  for (var i = 1; i <= group.currentMonth; i++) {
    var mf = monthFinances(gid, group, i);
    collectedSoFar += mf.totalCollected;
    if (mf.closed) payoutSoFar += mf.payoutAmount;
    holdA += mf.finalA; holdB += mf.finalB;
  }
  var totalCollection = members.length * group.monthlyDeposit * group.durationMonths;
  var totalPayout = (group.payoutSchedule || []).reduce(function (a, b) { return a + b; }, 0);
  var profitSoFar = collectedSoFar - payoutSoFar;
  var profitMargin = totalCollection - totalPayout;

  var rows = [];
  // Past + current months carry real data; a few months ahead are shown too
  // (scheduled amount only) so the upcoming payout order is visible at a
  // glance without having to open the full payment schedule.
  var lastVisibleMonth = Math.min(group.currentMonth + 2, group.durationMonths);
  for (var m = 1; m <= lastVisibleMonth; m++) {
    var subtitle, statusLabel, statusColor, badgeBg, badgeColor;
    if (m <= group.currentMonth) {
      var f = monthFinances(gid, group, m);
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
    } else {
      var scheduledAmount = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
      subtitle = 'Upcoming'; statusLabel = fmt(scheduledAmount); statusColor = 'var(--text-muted)';
      badgeBg = 'var(--bg)'; badgeColor = 'var(--text-muted)';
    }
    rows.push('<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '">' +
      '<div class="avatar sm" style="background:' + badgeBg + '; color:' + badgeColor + ';">' + m + '</div>' +
      '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">' + monthLabel(group.startYear, group.startMonthIndex, m) + '</div>' +
      '<div style="font-size:11.5px;color:var(--text-muted);margin-top:1px;">' + subtitle + '</div></div>' +
      '<div style="font-size:13px;font-weight:700;color:' + statusColor + ';">' + statusLabel + '</div>' +
    '</div>');
  }

  var financeCard = '<div style="display:flex;flex-direction:column;gap:10px;">' +
    progressCard('Collected so far', collectedSoFar, totalCollection, 'var(--accent)') +
    progressCard('Payouts made so far', payoutSoFar, totalPayout, 'var(--warning)') +
    '<div class="stat-row">' +
      '<div class="stat"><div class="label">Realized profit so far</div><div class="value" style="color:' + (profitSoFar < 0 ? 'var(--danger)' : '#146b52') + ';">' + signed(profitSoFar) + '</div></div>' +
      '<div class="stat"><div class="label">Profit margin at completion</div><div class="value" style="color:' + (profitMargin < 0 ? 'var(--danger)' : '#146b52') + ';">' + signed(profitMargin) + '</div></div>' +
    '</div>' +
    '<div class="stat-row">' +
      '<div class="stat"><div class="label">' + adminName('A') + ' holds</div><div class="value" style="' + (holdA < 0 ? 'color:var(--danger);' : '') + '">' + signed(holdA) + '</div></div>' +
      '<div class="stat"><div class="label">' + adminName('B') + ' holds</div><div class="value" style="' + (holdB < 0 ? 'color:var(--danger);' : '') + '">' + signed(holdB) + '</div></div>' +
    '</div>' +
  '</div>';

  var currentAmount = (group.payoutSchedule && group.payoutSchedule[group.currentMonth - 1]) || 0;
  var currentLabel = monthLabel(group.startYear, group.startMonthIndex, group.currentMonth);
  var scheduleLink = '<div class="list-row" data-action="open-payment-schedule" data-gid="' + gid + '">' +
    '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">Payment schedule</div>' +
    '<div style="font-size:11.5px;color:var(--accent);font-weight:600;margin-top:1px;">Current: ' + currentLabel + ' · ' + fmt(currentAmount) + '</div></div>' +
    iconChevronRight() +
  '</div>';

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
          '<div class="stat" data-action="open-group-members" data-gid="' + gid + '" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:6px;">' +
            '<div><div class="label">Members</div><div class="value">' + members.length + '</div></div>' +
            iconChevronRight() +
          '</div>' +
        '</div>' +
        '<div><div class="section-label">Fund financials</div>' + financeCard + '</div>' +
        '<div class="row-list">' + scheduleLink + '</div>' +
        '<div><div class="section-label">Months</div><div class="row-list">' + rows.join('') + '</div></div>' +
      '</div>' +
    '</div>';

  return html;
}
