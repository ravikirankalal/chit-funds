import { state, groupsById, membersByGroup } from '../store.js';
import { fmt, escapeHtml, monthLabel, adminName, adminDot, adminAvatarColor } from '../helpers.js';
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

// An admin's own dot + label, colored in that admin's avatar color — reused
// wherever a per-admin figure (a payout split, who paid what) needs to read
// as belonging to that admin at a glance, the same visual language as the
// "X holds" stat cells above.
function adminAmountSpan(id, label) {
  return '<span style="display:inline-flex;align-items:center;gap:4px;color:' + adminAvatarColor(id) + ';font-weight:600;white-space:nowrap;">' + adminDot(id) + label + '</span>';
}

// The right-hand column of a month row — profit as the headline (the
// number a row gets tapped open to check), collected and payout below it
// as supporting detail. Fixed colors rather than sign-dependent ones so
// each line reads as "this kind of figure" at a glance: profit green,
// collection blue (primary), payout red and shown as a negative — money
// leaving the fund, the opposite direction from collection.
function rightMoneyColumn(collected, payout) {
  var profit = collected - payout;
  return '<div style="text-align:right; flex-shrink:0;">' +
    '<div style="font-size:13px;font-weight:700;color:var(--color-success);">' + signed(profit) + '</div>' +
    '<div style="font-size:10px;color:var(--color-text-muted);margin-top:2px;white-space:nowrap;">Collected <span class="mono" style="color:var(--color-primary);font-weight:700;">' + fmt(collected) + '</span></div>' +
    '<div style="font-size:10px;color:var(--color-text-muted);margin-top:1px;white-space:nowrap;">Payout <span class="mono" style="color:var(--color-danger);font-weight:700;">−' + fmt(payout) + '</span></div>' +
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

  var rows = [];
  var trend = []; // { m, pct, color } per month — feeds the stats card's collection-trend sparkline
  // Every month is listed — a full chit fund can run 20+ months, so the
  // list scrolls in its own fixed-height region (see months markup below)
  // rather than pushing the rest of the screen off-page. Each row is
  // visually distinct by state — closed (solid, muted amount), open
  // (accent border + live collection progress bar), or never started
  // (dashed, faded) — instead of a badge color being the only cue.
  for (var m = 1; m <= group.durationMonths; m++) {
    if (m <= group.currentMonth) {
      var f = monthFinances(gid, group, m);
      var monthPct = members.length > 0 ? Math.round((f.paidCount / members.length) * 100) : 0;
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
        // Which admin handed the winner the payout — same field month
        // detail's closed summary shows, surfaced here too so it doesn't
        // take an extra tap to see who paid out a given month. Split
        // across its own lines rather than crammed into one subtitle —
        // a winner list, the payout split, and the unpaid count are three
        // separate facts, each worth its own line now that a payout can
        // be a genuine split rather than always "by one admin".
        // Winner names get the same gold used for "this month's winner"
        // everywhere else (month detail, dashboard), the payout split gets
        // each admin's own color (matching the "X holds" stat cells above),
        // and an unpaid warning always reads as warning-amber regardless of
        // the row's own closed/warning background — three distinct facts,
        // three distinct colors, instead of one blanket tone for all of them.
        var winnerNamesHtml = winnerNames.length
          ? winnerNames.map(function (n) { return '<span style="color:var(--color-gold);font-weight:600;">' + escapeHtml(n) + '</span>'; }).join(', ')
          : '—';
        var winnerLine = '<div style="display:flex;align-items:center;gap:4px;">' + iconTrophy('var(--color-gold)') + (winnerNames.length > 1 ? 'Winners: ' : 'Winner: ') + winnerNamesHtml + '</div>';
        var paidByParts = [];
        if (f.payoutPaidA > 0) paidByParts.push(adminAmountSpan('A', adminName('A') + (f.payoutPaidB > 0 ? ' (' + fmt(f.payoutPaidA) + ')' : '')));
        if (f.payoutPaidB > 0) paidByParts.push(adminAmountSpan('B', adminName('B') + (f.payoutPaidA > 0 ? ' (' + fmt(f.payoutPaidB) + ')' : '')));
        var payoutByLine = paidByParts.length ? '<div>Paid by ' + paidByParts.join(' + ') + '</div>' : '';
        var unpaidLine = hasUnpaid ? '<div style="color:var(--color-warning);font-weight:600;">' + unpaidCount + ' member' + (unpaidCount === 1 ? '' : 's') + ' still unpaid</div>' : '';
        // The trend sparkline uses one rule everywhere it appears (here,
        // the dashboard, and the per-member charts): green once every due
        // is in, red if anything's outstanding — regardless of the row's
        // own richer open/closed/warning styling above.
        trend.push({ m: m, pct: monthPct, color: hasUnpaid ? 'var(--color-danger)' : 'var(--color-success)' });
        rows.push('<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '"' + (hasUnpaid ? ' style="border-color:' + closedFg + ';"' : '') + '>' +
          '<div class="avatar sm" style="background:' + closedBg + '; color:' + closedFg + ';">' + m + '</div>' +
          '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">' + monthLabel(group.startYear, group.startMonthIndex, m) + '</div>' +
          '<div style="display:flex;flex-direction:column;gap:2px;font-size:11.5px;color:var(--color-text-muted);margin-top:2px;">' + winnerLine + payoutByLine + unpaidLine + '</div></div>' +
          rightMoneyColumn(f.totalCollected, f.payoutAmount) +
        '</div>');
      } else {
        var pct = members.length > 0 ? Math.min(100, Math.round((f.paidCount / members.length) * 100)) : 0;
        trend.push({ m: m, pct: pct, color: pct === 100 ? 'var(--color-success)' : 'var(--color-danger)' });
        // A payout in progress (some but not all of a winner's amount
        // recorded — see setPayoutContribution in actions.js) means the
        // month isn't just "open" anymore, so it gets its own gold
        // treatment instead of the usual secondary "open" styling. Gold
        // matches the payout color used on the dashboard and the winner
        // card, so it reads the same everywhere it shows up.
        var payoutStarted = f.winners.length > 0 && (f.payoutPaidA > 0 || f.payoutPaidB > 0);
        var rowColor = payoutStarted ? 'var(--color-gold)' : 'var(--color-secondary)';
        var rowBg = payoutStarted ? 'var(--color-gold-soft)' : 'var(--color-secondary-soft)';
        var rowLabel = '<span style="color:' + rowColor + ';font-weight:600;">' + (payoutStarted ? ' · Payout in progress' : ' · Open') + '</span>';
        var rowSubtitle = f.paidCount + ' / ' + members.length + ' paid so far';
        // Once there's a winner, show a fuller picture than the collection
        // bar alone: who won (gold, matching the winner styling used
        // everywhere else), each admin's own contribution so far in their
        // own color, and a second progress bar tracking the payout itself —
        // a genuinely different number from "% collected" now that a
        // payout can be split and can lag behind collection instead of
        // always trailing it in lockstep.
        var winnerRows = f.winners.map(function (w) {
          var mm = members.find(function (x) { return x.id === w.memberId; });
          return '<div style="display:flex;justify-content:space-between;gap:8px;">' +
            '<span style="display:flex;align-items:center;gap:4px;min-width:0;color:var(--color-gold);font-weight:600;">' + iconTrophy('var(--color-gold)') + (mm ? escapeHtml(mm.name) : '—') + '</span>' +
            '<span class="mono" style="flex-shrink:0;color:var(--color-accent);font-weight:700;">' + fmt(w.payoutAmount) + '</span>' +
          '</div>';
        }).join('');
        var payoutPct = f.payoutAmount > 0 ? Math.min(100, Math.round(((f.payoutPaidA + f.payoutPaidB) / f.payoutAmount) * 100)) : 0;
        var payoutSection = f.winners.length
          ? '<div style="display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:var(--color-text-muted);padding-top:2px;">' +
              winnerRows +
              (payoutStarted
                ? '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">' +
                    '<span style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
                      adminAmountSpan('A', adminName('A') + ': ' + fmt(f.payoutPaidA)) +
                      adminAmountSpan('B', adminName('B') + ': ' + fmt(f.payoutPaidB)) +
                    '</span>' +
                    '<span style="flex-shrink:0;color:var(--color-gold);font-weight:600;">' + payoutPct + '% paid out</span>' +
                  '</div>' +
                  '<div class="progress-track"><div class="progress-fill" style="width:' + payoutPct + '%; background:var(--color-gold);"></div></div>'
                : '') +
            '</div>'
          : '';
        rows.push('<div class="list-row" data-action="open-month" data-gid="' + gid + '" data-m="' + m + '" style="border-color:' + rowColor + ';background:' + rowBg + ';flex-direction:column;align-items:stretch;gap:6px;">' +
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<div class="avatar sm" style="background:' + rowColor + '; color:var(--on-brand);">' + m + '</div>' +
            '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600;">' + monthLabel(group.startYear, group.startMonthIndex, m) + rowLabel + '</div>' +
            '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:1px;">' + rowSubtitle + '</div></div>' +
            rightMoneyColumn(f.totalCollected, f.payoutAmount) +
          '</div>' +
          '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%; background:' + rowColor + ';"></div></div>' +
          payoutSection +
        '</div>');
      }
    } else {
      var scheduledAmount = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
      trend.push({ m: m, pct: 0, color: 'var(--color-border)' });
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

  // Sparkline of each month's collection %, one skinny bar per month —
  // bars grow from the bottom of a fixed-height track so partial months
  // are still comparable at a glance; a min-height floor keeps 0% months
  // (not started, or genuinely uncollected) visible as a sliver instead of
  // disappearing. The current month gets a primary-color ring so it's
  // findable among 20+ bars; every bar reuses the existing open-month
  // action so the sparkline doubles as another way to jump to a month.
  var trendBars = trend.map(function (t) {
    var h = Math.max(3, Math.round((t.pct / 100) * 28));
    var ring = t.m === group.currentMonth ? 'box-shadow:0 0 0 1.5px var(--color-primary);' : '';
    return '<div data-action="open-month" data-gid="' + gid + '" data-m="' + t.m + '" title="' + monthLabel(group.startYear, group.startMonthIndex, t.m) + ': ' + t.pct + '%" style="flex:1 1 0;min-width:2px;height:28px;display:flex;align-items:flex-end;cursor:pointer;">' +
      '<div style="width:100%;height:' + h + 'px;background:' + t.color + ';border-radius:2px;' + ring + '"></div>' +
    '</div>';
  }).join('');
  var trendRow = '<div style="padding:10px 12px;border-top:1px solid var(--color-border);">' +
    '<div style="font-size:10.5px;color:var(--color-text-muted);font-weight:500;display:flex;align-items:center;gap:4px;margin-bottom:6px;">' + iconTrendingUp() + 'Collection trend</div>' +
    '<div style="display:flex;align-items:flex-end;gap:2px;">' + trendBars + '</div>' +
  '</div>';

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
    trendRow +
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
