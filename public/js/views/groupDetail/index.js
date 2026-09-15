// The group detail screen — a stats card (deposit/members/collections/
// payouts/profit/holds/collection-trend) followed by a scrollable list of
// every month in the fund. Split by concern into sibling modules:
//   shared.js     — small helpers reused across sections (signed())
//   statsCard.js  — the top stats card, including the collection-trend
//                   sparkline (which consumes the trend data monthRows/
//                   produces as a byproduct of building the month list)
//   monthRows/    — the per-month row list (closed/open/upcoming states)
//                   and the collection-trend data those rows feed into
// This file stays the orchestrator: computing the raw running totals
// (collected/payout/holds so far), the loading skeleton, and assembly.
import { state, groupsById, membersByGroup } from '../../store.js';
import { escapeHtml, monthLabel } from '../../helpers.js';
import { monthFinances } from '../../finance/monthFinances.js';
import { iconChevronLeft, iconCalendar, iconGroupStack } from '../../icons.js';
import { bar, skeletonTopbar, skeletonListRow } from '../../skeleton.js';
import { renderStatsCard } from './statsCard.js';
import { renderMonthRows } from './monthRows/index.js';

// Called by render.js after mounting this screen, until it returns true —
// group data (and so the row to scroll to) may still be loading on the
// very first render, so render() keeps retrying on the renders that
// follow rather than only trying once and giving up.
export function scrollToActiveMonth(root) {
  var group = groupsById.get(state.activeGroupId);
  if (!group) return false;
  var row = root.querySelector('.list-row[data-m="' + group.currentMonth + '"]');
  if (!row) return false;
  row.scrollIntoView({ block: 'center' });
  return true;
}

function skeletonStatCell(border) {
  return '<div style="flex:1 1 0; min-width:0; padding:10px 12px;' + (border ? 'border-left:1px solid var(--color-border);' : '') + '">' +
    bar('60%', '10.5px') + bar('50%', '15px', 'margin-top:6px;') +
  '</div>';
}

function skeletonStatRow(borderTop) {
  return '<div style="display:flex;' + (borderTop ? 'border-top:1px solid var(--color-border);' : '') + '">' + skeletonStatCell(false) + skeletonStatCell(true) + '</div>';
}

function renderGroupDetailSkeleton() {
  var statsCard = '<div class="card" style="padding:0;">' + skeletonStatRow(false) + skeletonStatRow(true) + skeletonStatRow(true) + '</div>';
  var months = [0, 1, 2].map(function () { return skeletonListRow(); }).join('');
  return '<div class="screen">' + skeletonTopbar() +
    '<div class="content">' +
      statsCard +
      '<div>' + bar('80px', '13px', 'margin-bottom:10px;') + '<div class="row-list">' + months + '</div></div>' +
    '</div>' +
  '</div>';
}

export function renderGroupDetail() {
  var gid = state.activeGroupId;
  var group = groupsById.get(gid);
  if (!group) return state.groupsLoaded ? '<div class="content"><div class="card">Group not found.</div></div>' : renderGroupDetailSkeleton();
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

  var monthData = renderMonthRows(gid, group, members);
  var statsCard = renderStatsCard(gid, group, members, {
    collectedSoFar: collectedSoFar, payoutSoFar: payoutSoFar, holdA: holdA, holdB: holdB,
    totalCollection: totalCollection, totalPayout: totalPayout
  }, monthData.trend);

  var html = '' +
    // .screen/.content are normally unbounded (base.css gives #app/.screen
    // min-height, not height, so pages just grow and the whole document
    // scrolls) — this screen instead pins itself to the viewport so the
    // months list can be the one thing that scrolls, filling every bit of
    // space below the stats card down to the bottom of the screen rather
    // than stopping at an arbitrary max-height.
    '<div class="screen" style="height:100vh;overflow:hidden;">' +
      '<div class="topbar">' +
        '<div class="back" data-action="nav-back">' + iconChevronLeft() + '</div>' +
        '<div><div class="title">' + iconGroupStack('var(--color-primary)', 18) + escapeHtml(group.name) + '</div>' +
        '<div class="subtitle">Month ' + group.currentMonth + ' of ' + group.durationMonths + ' · started ' + monthLabel(group.startYear, group.startMonthIndex, 1) + '</div></div>' +
      '</div>' +
      '<div class="content" style="min-height:0;padding-bottom:18px;">' +
        statsCard +
        '<div style="display:flex;flex-direction:column;flex:1 1 auto;min-height:0;">' +
          '<div class="section-label" style="flex-shrink:0;">' + iconCalendar() + 'Months</div>' +
          '<div style="flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;"><div class="row-list">' + monthData.rowsHtml + '</div></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  return html;
}
