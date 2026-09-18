import { state, groupsById, membersById, monthKey, paymentsCache } from '../store.js';
import { fmt, escapeHtml, monthLabel, adminName, formatDateTime } from '../helpers.js';
import { monthFinances } from '../finance/monthFinances.js';
import { iconChevronLeft, iconCheck, iconWallet, iconTrophy, iconCalendar, iconPeopleSmall } from '../icons.js';
import { bar, skeletonTopbar, skeletonListRow } from '../skeleton.js';

function renderMemberPaymentsSkeleton() {
  var rows = [0, 1, 2].map(function () { return skeletonListRow(); }).join('');
  return '<div class="screen">' + skeletonTopbar() +
    '<div class="content">' +
      '<div class="stat-row"><div class="stat">' + bar('60%', '10.5px') + bar('40%', '15px', 'margin-top:8px;') + '</div></div>' +
      '<div class="row-list">' + rows + '</div>' +
    '</div>' +
  '</div>';
}

export function renderMemberPayments() {
  var gid = state.activeGroupId;
  var mid = state.viewMemberId;
  var group = groupsById.get(gid);
  var member = membersById.get(mid);
  if (!group || !member) return state.groupsLoaded ? '<div class="content"><div class="card">Member not found.</div></div>' : renderMemberPaymentsSkeleton();

  var rows = [];
  var trend = []; // { m, paid } per month this member owed dues for — feeds the payment-trend strip below
  var totalPaid = 0, wonTotal = 0;
  for (var m = 1; m <= group.currentMonth; m++) {
    var p = (paymentsCache.get(monthKey(gid, m)) || {})[mid];
    var f = monthFinances(gid, group, m);
    var winEntry = f.closed && f.winners.find(function (w) { return w.memberId === mid; });
    var subtitle, statusBg, statusColor, statusLabel;
    if (p && p.paid) {
      totalPaid += group.monthlyDeposit;
      subtitle = 'Collected by <span style="font-weight:600;color:var(--color-success);">' + escapeHtml(adminName(p.collectedBy)) + '</span> · ' + (p.mode === 'online' ? 'Online' : 'Cash') + (formatDateTime(p.paidAt) ? ' · ' + formatDateTime(p.paidAt) : '');
      statusBg = 'var(--color-success-soft)'; statusColor = 'var(--color-success)'; statusLabel = iconCheck('var(--color-success)') + 'Paid';
    } else {
      subtitle = '<span style="color:var(--color-danger);">Not paid</span>';
      statusBg = 'var(--color-danger-soft)'; statusColor = 'var(--color-danger)'; statusLabel = 'Unpaid';
    }
    // Its own pill under the status pill, not folded into the subtitle
    // sentence — a win is a distinct enough fact (and rare enough) that it
    // deserves the same badge treatment status gets elsewhere, rather than
    // being one more clause to parse in a line of running text.
    var wonPill = '';
    if (winEntry) {
      wonTotal += winEntry.payoutAmount;
      wonPill = '<div style="margin-top:4px;display:flex;align-items:center;justify-content:flex-end;gap:3px;font-size:10px;font-weight:700;color:var(--color-accent);">' + iconTrophy('var(--color-accent)', 11) + 'Won ' + fmt(winEntry.payoutAmount) + '</div>';
    }
    trend.push({ m: m, state: (p && p.paid) ? 'paid' : 'unpaid' });

    // The avatar carries the same paid/unpaid color the status pill does —
    // a colored strip down the list is readable at a glance without
    // reading every pill, same reasoning as the group month rows' avatar.
    rows.push('<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '">' +
      '<div class="avatar sm" style="background:' + (p && p.paid ? 'var(--color-success-soft)' : 'var(--color-danger-soft)') + '; color:' + (p && p.paid ? 'var(--color-success)' : 'var(--color-danger)') + ';">' + m + '</div>' +
      '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">' + monthLabel(group.startYear, group.startMonthIndex, m) + '</div>' +
      '<div style="font-size:11px;color:var(--color-text-muted);margin-top:1px;">' + subtitle + '</div></div>' +
      '<div style="flex-shrink:0;text-align:right;">' +
        '<div style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:5px 10px;border-radius:20px;background:' + statusBg + ';color:' + statusColor + ';">' + statusLabel + '</div>' +
        wonPill +
      '</div>' +
    '</div>');
  }
  var totalDueSoFar = group.currentMonth * group.monthlyDeposit;
  var amountDue = totalDueSoFar - totalPaid;
  // The list above only covers months this member has actually owed dues
  // for (1..currentMonth) — the trend strip covers the group's FULL
  // duration, same as the group detail collection-trend sparkline, so a
  // member 3 months into a 24-month fund doesn't read as "almost done".
  for (var fm = group.currentMonth + 1; fm <= group.durationMonths; fm++) {
    trend.push({ m: fm, state: 'future' });
  }

  // Same paid=full/green, unpaid=short/red bar strip as the month detail
  // page's "Who's paid" (public/js/views/monthDetail/shared.js), but one bar per
  // MONTH for this one member instead of one bar per member for one month
  // — a quick visual read of this member's overall reliability. Each bar
  // reuses the row list's own 'open-month' action, so it's another way to
  // jump to a given month.
  var trendColors = { paid: 'var(--color-success)', unpaid: 'var(--color-danger)', future: 'var(--color-border)' };
  var trendHeights = { paid: 20, unpaid: 6, future: 3 };
  var trendLabels = { paid: 'Paid', unpaid: 'Unpaid', future: 'Not started' };
  var trendStrip = trend.length ? '<div class="card" style="margin-bottom:12px;">' +
    '<div style="font-size:11px;color:var(--color-text-muted);margin-bottom:4px;">Payment trend</div>' +
    '<div style="display:flex;align-items:flex-end;gap:2px;">' + trend.map(function (t) {
      return '<div data-action="open-month" data-gid="' + gid + '" data-m="' + t.m + '" title="' + monthLabel(group.startYear, group.startMonthIndex, t.m) + ': ' + trendLabels[t.state] + '" style="flex:1 1 0;min-width:2px;height:20px;display:flex;align-items:flex-end;cursor:pointer;">' +
        '<div style="width:100%;height:' + trendHeights[t.state] + 'px;background:' + trendColors[t.state] + ';border-radius:2px;"></div>' +
      '</div>';
    }).join('') + '</div>' +
  '</div>' : '';

  return '' +
    '<div class="screen">' +
      '<div class="topbar">' +
        '<div class="back" data-action="nav-back">' + iconChevronLeft() + '</div>' +
        '<div><div class="title">' + iconPeopleSmall('var(--color-primary)', 18) + escapeHtml(member.name) + '</div><div class="subtitle">' + escapeHtml(group.name) + ' · Payment history</div></div>' +
      '</div>' +
      '<div class="content">' +
        trendStrip +
        '<div class="stat-row">' +
          '<div class="stat"><div class="label">' + iconWallet() + 'Paid so far</div><div class="value">' + fmt(totalPaid) + ' <span style="font-size:12px;color:var(--color-text-muted);font-weight:400;">/ ' + fmt(totalDueSoFar) + '</span></div></div>' +
          '<div class="stat"><div class="label">Amount due</div><div class="value" style="color:' + (amountDue > 0 ? 'var(--color-danger)' : 'var(--color-text)') + ';">' + fmt(amountDue) + '</div></div>' +
          (wonTotal > 0 ? '<div class="stat"><div class="label">' + iconTrophy() + 'Received</div><div class="value" style="color:var(--color-accent);">' + fmt(wonTotal) + '</div></div>' : '') +
        '</div>' +
        '<div><div class="section-label">' + iconCalendar() + 'Payments</div><div class="row-list">' + (rows.join('') || '<div class="card" style="color:var(--color-text-muted);font-size:13px;text-align:center;">No months yet.</div>') + '</div></div>' +
      '</div>' +
    '</div>';
}
