import { state, groupsById, membersByGroup } from '../store.js';
import { fmt, escapeHtml, monthLabel, adminName } from '../helpers.js';
import { monthFinances } from '../finance.js';
import { iconChevronLeft, iconChevronRight } from '../icons.js';

function signed(n) { return (n < 0 ? '−' : '') + fmt(Math.abs(n)); }

// A progress-bar comparison ("collected so far out of total collection")
// reads at a glance; the plain label/value rows this replaced didn't.
function progressCard(label, value, total, barColor) {
  var pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return '<div class="card" style="flex:1 1 0; min-width:0; display:flex;flex-direction:column;gap:8px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:baseline;">' +
      '<div style="font-size:11.5px;color:var(--text-muted);font-weight:500;">' + label + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);font-weight:600;">' + pct + '%</div>' +
    '</div>' +
    '<div class="mono" style="font-size:17px;font-weight:700;">' + fmt(value) + '</div>' +
    '<div style="font-size:11px;color:var(--text-muted);font-weight:500;">of ' + fmt(total) + '</div>' +
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
  // glance without having to open the full payment schedule. Each row is
  // visually distinct by state — closed (solid, muted amount), open
  // (accent border + live collection progress bar), or never started
  // (dashed, faded) — instead of a badge color being the only cue.
  var lastVisibleMonth = Math.min(group.currentMonth + 2, group.durationMonths);
  for (var m = 1; m <= lastVisibleMonth; m++) {
    if (m <= group.currentMonth) {
      var f = monthFinances(gid, group, m);
      if (f.closed) {
        // Almost always one winner; occasionally more than one (see
        // getMonthWinners in finance.js) — join their names for the subtitle.
        var winnerNames = f.winners.map(function (w) {
          var mm = members.find(function (x) { return x.id === w.memberId; });
          return mm ? mm.name : '—';
        });
        var unpaidCount = members.length - f.paidCount;
        // A closed month can still have unpaid dues (a late/missed payment) —
        // flag those with the amber "warning" palette instead of the usual
        // green closed styling, so it's obvious at a glance which closed
        // months still need follow-up.
        var hasUnpaid = unpaidCount > 0;
        var closedBg = hasUnpaid ? 'var(--warning-soft)' : '#e6f2ec';
        var closedFg = hasUnpaid ? 'var(--warning)' : '#146b52';
        var subtitle = (winnerNames.length > 1 ? 'Winners: ' : 'Winner: ') + (winnerNames.length ? winnerNames.map(escapeHtml).join(', ') : '—') + (hasUnpaid ? ' · ' + unpaidCount + ' unpaid' : '');
        rows.push('<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '"' + (hasUnpaid ? ' style="border-color:' + closedFg + ';"' : '') + '>' +
          '<div class="avatar sm" style="background:' + closedBg + '; color:' + closedFg + ';">' + m + '</div>' +
          '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">' + monthLabel(group.startYear, group.startMonthIndex, m) + '</div>' +
          '<div style="font-size:11.5px;color:' + (hasUnpaid ? closedFg : 'var(--text-muted)') + ';margin-top:1px;">' + subtitle + '</div></div>' +
          '<div style="text-align:right; flex-shrink:0;"><div style="font-size:13px;font-weight:700;color:' + closedFg + ';">' + fmt(f.payoutAmount) + '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);">won</div></div>' +
        '</div>');
      } else {
        var pct = members.length > 0 ? Math.min(100, Math.round((f.paidCount / members.length) * 100)) : 0;
        // Blue (not green — green already means "closed/paid out" elsewhere,
        // and reusing it for "in progress" would blur that distinction).
        // Same blue already used for transfer ledger entries in finance.js.
        rows.push('<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '" style="border-color:#3b4a8a;background:#eef0f9;flex-direction:column;align-items:stretch;gap:6px;">' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<div class="avatar sm" style="background:#3b4a8a; color:#fff;">' + m + '</div>' +
            '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">' + monthLabel(group.startYear, group.startMonthIndex, m) + ' · Open</div>' +
            '<div style="font-size:11.5px;color:var(--text-muted);margin-top:1px;">' + f.paidCount + ' / ' + members.length + ' paid so far</div></div>' +
            '<div style="text-align:right; flex-shrink:0;"><div style="font-size:13px;font-weight:700;color:#3b4a8a;">' + fmt(f.payoutAmount) + '</div>' +
            '<div style="font-size:11px;color:var(--text-muted);">' + pct + '% collected</div></div>' +
          '</div>' +
          '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%; background:#3b4a8a;"></div></div>' +
        '</div>');
      }
    } else {
      var scheduledAmount = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
      rows.push('<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '" style="border-style:dashed; opacity:0.65;">' +
        '<div class="avatar sm" style="background:var(--bg); color:var(--text-muted);">' + m + '</div>' +
        '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">' + monthLabel(group.startYear, group.startMonthIndex, m) + '</div>' +
        '<div style="font-size:11.5px;color:var(--text-muted);margin-top:1px;">Not started</div></div>' +
        '<div style="font-size:13px;font-weight:700;color:var(--text-muted);">' + fmt(scheduledAmount) + '</div>' +
      '</div>');
    }
  }

  var financeCard = '<div style="display:flex;flex-direction:column;gap:10px;">' +
    '<div style="display:flex;gap:10px;">' +
      progressCard('Collected so far', collectedSoFar, totalCollection, 'var(--accent)') +
      progressCard('Payouts so far', payoutSoFar, totalPayout, 'var(--warning)') +
    '</div>' +
    '<div class="stat-row">' +
      '<div class="stat"><div class="label">Realized profit so far</div><div class="value" style="color:' + (profitSoFar < 0 ? 'var(--danger)' : '#146b52') + ';">' + signed(profitSoFar) + '</div></div>' +
      '<div class="stat"><div class="label">Profit margin at completion</div><div class="value" style="color:' + (profitMargin < 0 ? 'var(--danger)' : '#146b52') + ';">' + signed(profitMargin) + '</div></div>' +
    '</div>' +
    '<div class="stat-row">' +
      '<div class="stat"><div class="label">' + adminName('A') + ' holds</div><div class="value" style="' + (holdA < 0 ? 'color:var(--danger);' : '') + '">' + signed(holdA) + '</div></div>' +
      '<div class="stat"><div class="label">' + adminName('B') + ' holds</div><div class="value" style="' + (holdB < 0 ? 'color:var(--danger);' : '') + '">' + signed(holdB) + '</div></div>' +
    '</div>' +
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
        '<div><div class="section-label">Months</div><div class="row-list">' + rows.join('') + '</div></div>' +
      '</div>' +
    '</div>';

  return html;
}
