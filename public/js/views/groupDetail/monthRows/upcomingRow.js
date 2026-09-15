import { fmt, monthLabel } from '../../../helpers.js';

// A month that hasn't started yet — dashed, faded, no live figures beyond
// its scheduled payout.
export function renderUpcomingMonthRow(gid, group, m) {
  var scheduledAmount = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
  var trend = { m: m, pct: 0, color: 'var(--color-border)' };
  var html = '<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '" style="border-style:dashed; opacity:0.65;">' +
    '<div class="avatar sm" style="background:var(--color-bg); color:var(--color-text-muted);">' + m + '</div>' +
    '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">' + monthLabel(group.startYear, group.startMonthIndex, m) + '</div>' +
    '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:1px;">Not started</div></div>' +
    '<div style="font-size:13px;font-weight:700;color:var(--color-text-muted);">' + fmt(scheduledAmount) + '</div>' +
  '</div>';
  return { html: html, trend: trend };
}
