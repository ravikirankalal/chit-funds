import { state, groupsById, membersByGroup } from '../store.js';
import { fmt, escapeHtml, monthLabel, adminName, adminDot } from '../helpers.js';
import { monthFinances } from '../finance.js';
import { iconChevronLeft, iconChevronRight, iconWallet, iconPeopleSmall, iconTrendingUp, iconCalendar, iconTrophy, iconGroupStack } from '../icons.js';
import { bar, skeletonTopbar, skeletonListRow } from '../skeleton.js';

function signed(n) { return (n < 0 ? '−' : '') + fmt(Math.abs(n)); }

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

// One dense card replaces what used to be three separate stat-row/card
// blocks (each with its own border+padding+shadow) — a single-line
// label+value per cell, divider rules instead of per-cell chrome, and an
// inline 3px progress sliver only where a fraction is the point (collected
// / paid out) instead of a full-height progress card.
function statCell(labelHtml, valueHtml, opts) {
  opts = opts || {};
  return '<div style="flex:1 1 0; min-width:0; padding:10px 12px;' + (opts.border ? 'border-left:1px solid var(--color-border);' : '') + (opts.style || '') + '"' + (opts.attrs || '') + '>' +
    '<div style="font-size:10.5px;color:var(--color-text-muted);font-weight:500;display:flex;align-items:center;gap:4px;">' + labelHtml + '</div>' +
    '<div style="font-family:var(--font-display);font-size:14px;font-weight:700;margin-top:2px;display:flex;align-items:center;justify-content:space-between;gap:6px;">' + valueHtml + '</div>' +
    (opts.below || '') +
  '</div>';
}

function statRow(cells, borderTop) {
  return '<div style="display:flex;' + (borderTop ? 'border-top:1px solid var(--color-border);' : '') + '">' + cells + '</div>';
}

function progressSliver(pct, barColor) {
  return '<div class="progress-track" style="height:3px;margin-top:5px;"><div class="progress-fill" style="width:' + pct + '%; background:' + barColor + ';"></div></div>';
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

  var rows = [];
  // Every month is listed — a full chit fund can run 20+ months, so the
  // list scrolls in its own fixed-height region (see months markup below)
  // rather than pushing the rest of the screen off-page. Each row is
  // visually distinct by state — closed (solid, muted amount), open
  // (accent border + live collection progress bar), or never started
  // (dashed, faded) — instead of a badge color being the only cue.
  for (var m = 1; m <= group.durationMonths; m++) {
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
        var closedBg = hasUnpaid ? 'var(--color-warning-soft)' : 'var(--color-success-soft)';
        var closedFg = hasUnpaid ? 'var(--color-warning)' : 'var(--color-success)';
        var subtitle = '<span style="display:inline-flex;align-items:center;gap:4px;">' + iconTrophy() + (winnerNames.length > 1 ? 'Winners: ' : 'Winner: ') + (winnerNames.length ? winnerNames.map(escapeHtml).join(', ') : '—') + '</span>' + (hasUnpaid ? ' · ' + unpaidCount + ' unpaid' : '');
        rows.push('<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '"' + (hasUnpaid ? ' style="border-color:' + closedFg + ';"' : '') + '>' +
          '<div class="avatar sm" style="background:' + closedBg + '; color:' + closedFg + ';">' + m + '</div>' +
          '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">' + monthLabel(group.startYear, group.startMonthIndex, m) + '</div>' +
          '<div style="font-size:11.5px;color:' + (hasUnpaid ? closedFg : 'var(--color-text-muted)') + ';margin-top:1px;">' + subtitle + '</div></div>' +
          '<div style="text-align:right; flex-shrink:0;"><div style="font-size:13px;font-weight:700;color:' + closedFg + ';">' + fmt(f.payoutAmount) + '</div>' +
          '<div style="font-size:11px;color:var(--color-text-muted);">won</div></div>' +
        '</div>');
      } else {
        var pct = members.length > 0 ? Math.min(100, Math.round((f.paidCount / members.length) * 100)) : 0;
        // Blue (not green — green already means "closed/paid out" elsewhere,
        // and reusing it for "in progress" would blur that distinction).
        // Same blue already used for transfer ledger entries in finance.js.
        rows.push('<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '" style="border-color:var(--color-secondary);background:var(--color-secondary-soft);flex-direction:column;align-items:stretch;gap:6px;">' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<div class="avatar sm" style="background:var(--color-secondary); color:var(--on-brand);">' + m + '</div>' +
            '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">' + monthLabel(group.startYear, group.startMonthIndex, m) + ' · Open</div>' +
            '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:1px;">' + f.paidCount + ' / ' + members.length + ' paid so far</div></div>' +
            '<div style="text-align:right; flex-shrink:0;"><div style="font-size:13px;font-weight:700;color:var(--color-secondary);">' + fmt(f.payoutAmount) + '</div>' +
            '<div style="font-size:11px;color:var(--color-text-muted);">' + pct + '% collected</div></div>' +
          '</div>' +
          '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%; background:var(--color-secondary);"></div></div>' +
        '</div>');
      }
    } else {
      var scheduledAmount = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
      rows.push('<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '" style="border-style:dashed; opacity:0.65;">' +
        '<div class="avatar sm" style="background:var(--color-bg); color:var(--color-text-muted);">' + m + '</div>' +
        '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">' + monthLabel(group.startYear, group.startMonthIndex, m) + '</div>' +
        '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:1px;">Not started</div></div>' +
        '<div style="font-size:13px;font-weight:700;color:var(--color-text-muted);">' + fmt(scheduledAmount) + '</div>' +
      '</div>');
    }
  }

  var collectedPct = totalCollection > 0 ? Math.min(100, Math.round((collectedSoFar / totalCollection) * 100)) : 0;
  var payoutPct = totalPayout > 0 ? Math.min(100, Math.round((payoutSoFar / totalPayout) * 100)) : 0;
  var pctTag = function (pct) { return '<span style="font-size:10.5px;color:var(--color-text-muted);font-weight:600;flex-shrink:0;">' + pct + '%</span>'; };

  var statsCard = '<div class="card" style="padding:0;">' +
    statRow(
      statCell(iconWallet() + 'Monthly deposit', '<span>' + fmt(group.monthlyDeposit) + '</span>') +
      statCell(iconPeopleSmall() + 'Members', '<span>' + members.length + '</span>' + iconChevronRight(), { border: true, style: 'cursor:pointer;', attrs: ' data-action="open-group-members" data-gid="' + gid + '"' })
    ) +
    statRow(
      statCell('Collected so far', '<span>' + fmt(collectedSoFar) + '</span>' + pctTag(collectedPct), { below: progressSliver(collectedPct, 'var(--color-success)') }) +
      statCell('Payouts so far', '<span>' + fmt(payoutSoFar) + '</span>' + pctTag(payoutPct), { border: true, below: progressSliver(payoutPct, 'var(--color-accent)') }),
      true
    ) +
    statRow(
      statCell(adminDot('A') + adminName('A') + ' holds', '<span style="' + (holdA < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(holdA) + '</span>') +
      statCell(adminDot('B') + adminName('B') + ' holds', '<span style="' + (holdB < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(holdB) + '</span>', { border: true }),
      true
    ) +
  '</div>';

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
          '<div style="flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;"><div class="row-list">' + rows.join('') + '</div></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  return html;
}
