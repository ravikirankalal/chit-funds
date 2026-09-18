import { fmt, escapeHtml, adminDot, adminName, monthLabel } from '../../helpers.js';
import { iconWallet, iconPeopleSmall, iconChevronRight, iconTrendingUp } from '../../icons.js';
import { signed } from './shared.js';

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

function pctTag(pct) { return '<span style="font-size:10.5px;color:var(--color-text-muted);font-weight:600;flex-shrink:0;">' + pct + '%</span>'; }

// Sparkline of each month's collection %, one skinny bar per month —
// bars grow from the bottom of a fixed-height track so partial months
// are still comparable at a glance; a min-height floor keeps 0% months
// (not started, or genuinely uncollected) visible as a sliver instead of
// disappearing. The current month gets a primary-color ring so it's
// findable among 20+ bars. Purely a glance-able readout, not a control —
// a title tooltip carries the exact %, but nothing here navigates.
function trendRow(group, trend) {
  var trendBars = trend.map(function (t) {
    var h = Math.max(3, Math.round((t.pct / 100) * 28));
    var ring = t.m === group.currentMonth ? 'box-shadow:0 0 0 1.5px var(--color-primary);' : '';
    return '<div title="' + monthLabel(group.startYear, group.startMonthIndex, t.m) + ': ' + t.pct + '%" style="flex:1 1 0;min-width:2px;height:28px;display:flex;align-items:flex-end;">' +
      '<div style="width:100%;height:' + h + 'px;background:' + t.color + ';border-radius:2px;' + ring + '"></div>' +
    '</div>';
  }).join('');
  return '<div style="padding:10px 12px;border-top:1px solid var(--color-border);">' +
    '<div style="font-size:10.5px;color:var(--color-text-muted);font-weight:500;display:flex;align-items:center;gap:4px;margin-bottom:6px;">' + iconTrendingUp() + 'Collection trend</div>' +
    '<div style="display:flex;align-items:flex-end;gap:2px;">' + trendBars + '</div>' +
  '</div>';
}

export function renderStatsCard(gid, group, members, figures, trend) {
  var collectedSoFar = figures.collectedSoFar, payoutSoFar = figures.payoutSoFar, holdA = figures.holdA, holdB = figures.holdB;
  var totalCollection = figures.totalCollection, totalPayout = figures.totalPayout;
  var collectedPct = totalCollection > 0 ? Math.min(100, Math.round((collectedSoFar / totalCollection) * 100)) : 0;
  var payoutPct = totalPayout > 0 ? Math.min(100, Math.round((payoutSoFar / totalPayout) * 100)) : 0;
  var profitSoFar = collectedSoFar - payoutSoFar;
  var profitSoFarColor = profitSoFar < 0 ? 'var(--color-danger)' : 'var(--color-success)';

  return '<div class="card" style="padding:0;">' +
    statRow(
      statCell(iconWallet() + 'Monthly deposit', '<span>' + fmt(group.monthlyDeposit) + '</span>') +
      statCell(iconPeopleSmall() + 'Members', '<span>' + members.length + '</span>' + iconChevronRight(), { border: true, style: 'cursor:pointer;', attrs: ' data-action="open-group-members" data-gid="' + gid + '"' })
    ) +
    statRow(
      statCell('Collections', '<span style="color:var(--color-primary);">' + fmt(collectedSoFar) + '</span>' + pctTag(collectedPct), { below: progressSliver(collectedPct, 'var(--color-primary)') }) +
      statCell('Payouts', '<span>' + fmt(payoutSoFar) + '</span>' + pctTag(payoutPct), { border: true, below: progressSliver(payoutPct, 'var(--color-accent)') }) +
      statCell('Profit', '<span style="color:' + profitSoFarColor + ';">' + signed(profitSoFar) + '</span>', { border: true }),
      true
    ) +
    statRow(
      statCell(adminDot('A') + escapeHtml(adminName('A')) + ' holds', '<span style="' + (holdA < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(holdA) + '</span>') +
      statCell(adminDot('B') + escapeHtml(adminName('B')) + ' holds', '<span style="' + (holdB < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(holdB) + '</span>', { border: true }),
      true
    ) +
    trendRow(group, trend) +
  '</div>';
}
