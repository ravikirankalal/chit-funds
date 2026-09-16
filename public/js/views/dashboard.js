import { ADMINS } from '../../firebase-config.js';
import { state, groupsById, membersByGroup } from '../store.js';
import { fmt, escapeHtml, adminName, adminAvatarColor, adminDot, initialsOf, isSuper, monthLabel } from '../helpers.js';
import { monthFinances } from '../finance/monthFinances.js';
import { iconChevronRight, iconPlus, iconWallet, iconGroupStack, iconPeopleSmall, iconCalendar, iconTrophy, iconTrendingUp, iconTransfer, iconClock } from '../icons.js';
import { renderBottomNav } from './bottomNav.js';
import { bar } from '../skeleton.js';

// Mimics the real layout (hero balance card, stat row, group cards) with
// shimmering placeholder blocks instead of a single centered message —
// so the page you're waiting for is recognizable while it's still loading.
function renderLoadingSkeleton() {
  var hero = '<div style="background:var(--color-surface); border-radius:20px; padding:20px; display:flex; flex-direction:column; gap:10px; box-shadow:var(--shadow-sm);">' +
    bar('45%', '11px') + bar('55%', '28px', 'margin-top:2px;') + bar('70%', '11px') +
  '</div>';
  var statRow = '<div style="display:flex; gap:12px;">' +
    '<div class="stat">' + bar('40%', '10.5px') + bar('65%', '15px', 'margin-top:8px;') + '</div>' +
    '<div class="stat">' + bar('40%', '10.5px') + bar('65%', '15px', 'margin-top:8px;') + '</div>' +
  '</div>';
  var groupCards = [0, 1, 2].map(function () {
    return '<div class="card" style="display:flex;flex-direction:column;gap:12px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
        '<div style="display:flex;flex-direction:column;gap:6px;">' + bar('130px', '14px') + bar('90px', '11px') + '</div>' +
        bar('18px', '18px') +
      '</div>' +
      bar('100%', '6px') +
    '</div>';
  }).join('');
  return hero + statRow + '<div>' + bar('60px', '13px', 'margin-bottom:10px;') + '<div class="row-list">' + groupCards + '</div></div>';
}

// Pending approvals still needing THIS admin's action are hand-offs and
// the net-balance transfer request — payouts no longer need approval (see
// setPayoutContribution in actions/winners/payout.js: each admin just records their own
// share). Secondary is the transfer/info color used everywhere else money
// moves between admins (see the handoff banner in month detail, which is
// also `.banner.info` = secondary).
function approvalCardConfig(a) {
  var monthText = (function () {
    var ag = groupsById.get(a.groupId);
    return ag ? monthLabel(ag.startYear, ag.startMonthIndex, a.month) : 'Month ' + a.month;
  })();
  // `who` and `amount` are the two facts worth a second look at a glance;
  // everything else in headline/subtitle stays plain/muted so those two
  // don't have to compete with a wall of same-weight text.
  if (a.kind === 'handoff') {
    return {
      colorVar: 'secondary', icon: iconTransfer('var(--color-secondary)'),
      who: adminName(a.requestedBy), amountText: fmt(a.amount), headlineRest: ' wants to send you ',
      subtitle: escapeHtml(a.groupName) + ' · ' + monthText + ' · ' + a.count + ' payment' + (a.count === 1 ? '' : 's')
    };
  }
  // kind === 'transfer' — the net-balance request.
  return {
    colorVar: 'secondary', icon: iconTransfer('var(--color-secondary)'),
    who: adminName(a.requestedBy), amountText: fmt(a.amount), headlineRest: ' wants to send ',
    subtitle: escapeHtml(a.groupName) + ' · ' + monthText + ' · ' +
      (a.direction === 'AtoB' ? adminName('A') + ' → ' + adminName('B') : adminName('B') + ' → ' + adminName('A'))
  };
}

function renderApprovalBanner(a) {
  var c = approvalCardConfig(a);
  return '<div data-action="open-month" data-gid="' + a.groupId + '" data-m="' + a.month + '" style="cursor:pointer; background:var(--color-' + c.colorVar + '-soft); border-radius:14px; padding:10px 12px; display:flex; align-items:center; gap:10px; box-shadow:var(--shadow-xs);">' +
    '<div style="width:26px;height:26px;border-radius:8px;background:var(--color-surface);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + c.icon + '</div>' +
    '<div style="flex:1 1 auto;min-width:0;font-size:12.5px;color:var(--color-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
      '<span style="font-weight:700;color:var(--color-' + c.colorVar + ');">' + c.who + '</span>' + c.headlineRest +
      '<span style="font-weight:700;color:var(--color-' + c.colorVar + ');">' + c.amountText + '</span>' +
      ' <span style="opacity:0.8;">· ' + c.subtitle + '</span>' +
    '</div>' +
    '<div style="flex-shrink:0;font-size:13px;font-weight:700;color:var(--color-' + c.colorVar + ');">→</div>' +
  '</div>';
}

export function renderDashboard() {
  var groups = Array.from(groupsById.values());
  var approvals = isSuper() ? [] : state.pendingApprovals.filter(function (a) { return a.requestedBy !== state.currentAdmin; });

  // Until the groups listener delivers its first snapshot, `groups` is
  // always empty and `state.balances` always zero — show a loading state
  // instead of flashing "no groups yet" / ₹0 while real data is in flight.
  if (!state.groupsLoaded) {
    return '<div class="screen">' +
      '<div style="padding:20px 20px 4px; display:flex; align-items:center; justify-content:space-between;">' +
        '<div><div style="font-size:12px;color:var(--color-text-muted);font-weight:500;">Welcome back, ' + adminName(state.currentAdmin) + '</div>' +
        '<div class="mono" style="display:flex;align-items:center;gap:8px;font-size:22px;font-weight:700;">' + iconWallet('var(--color-primary)', 22) + 'Chit Funds</div></div>' +
        '<div data-action="logout" class="avatar" style="cursor:pointer; background:' + adminAvatarColor(state.currentAdmin) + ';">' + initialsOf(adminName(state.currentAdmin)) + '</div>' +
      '</div>' +
      '<div class="content">' + renderLoadingSkeleton() + '</div>' +
      renderBottomNav('dashboard') +
    '</div>';
  }

  var groupCards = groups.map(function (g) {
    var pct = Math.round((g.currentMonth / g.durationMonths) * 100);
    var members = membersByGroup.get(g.id) || [];
    var memberCount = members.length;
    var isCompleted = g.status === 'completed';
    // "3/5 paid" for the current month replaces the old static "In
    // progress" label — a completed group's last month is always fully
    // closed, so there's nothing collection-wise left to flag for those.
    var f = monthFinances(g.id, g, g.currentMonth);
    var allPaid = memberCount > 0 && f.paidCount === memberCount;
    var statusBadge = isCompleted
      ? '<span style="font-size:12px;color:var(--color-primary);font-weight:600;">Completed</span>'
      : '<span style="display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:' + (allPaid ? 'var(--color-success-soft)' : 'var(--color-warning-soft)') + ';color:' + (allPaid ? 'var(--color-success)' : 'var(--color-warning)') + ';">' + f.paidCount + '/' + memberCount + ' paid</span>';
    // Winner names resolved here rather than stored — a month doc only
    // ever holds memberIds (see getMonthWinners in finance/shared.js).
    var winnerNames = f.winners.map(function (w) {
      var mm = members.find(function (x) { return x.id === w.memberId; });
      return mm ? mm.name : '—';
    });
    var payoutLine = winnerNames.length
      ? '<div style="font-size:11.5px;color:var(--color-text-muted);"><span style="display:flex;align-items:center;gap:4px;">' + iconTrophy('var(--color-text-faint)') + (winnerNames.length > 1 ? 'Winners: ' : 'Winner: ') + escapeHtml(winnerNames.join(', ')) + '</span></div>'
      : '';
    // Compact per-month collection-trend sparkline — one rule shared with
    // every other trend chart in the app (group detail, member payments):
    // green once a month's dues are fully in, red if anything's
    // outstanding, muted for months not yet reached. Reuses f (already
    // computed above) for the current month instead of calling
    // monthFinances on it a second time.
    // Collected/paid-out totals across every month so far — same real
    // (not target) paid figures as the group-detail page's own stats card,
    // accumulated here rather than looped again separately since the
    // trend loop below already visits every month up to currentMonth.
    var collectedSoFar = 0, payoutSoFarForGroup = 0;
    var trend = [];
    for (var tm = 1; tm <= g.durationMonths; tm++) {
      if (tm <= g.currentMonth) {
        var tf = tm === g.currentMonth ? f : monthFinances(g.id, g, tm);
        var tpct = memberCount > 0 ? Math.round((tf.paidCount / memberCount) * 100) : 0;
        trend.push({ m: tm, pct: tpct, color: tf.paidCount === memberCount ? 'var(--color-success)' : 'var(--color-danger)' });
        collectedSoFar += tf.totalCollected;
        payoutSoFarForGroup += tf.payoutPaidA + tf.payoutPaidB;
      } else {
        trend.push({ m: tm, pct: 0, color: 'var(--color-border)' });
      }
    }
    var groupProfit = collectedSoFar - payoutSoFarForGroup;
    var groupProfitColor = groupProfit < 0 ? 'var(--color-danger)' : 'var(--color-success)';
    // A recessed panel (the app's --color-bg, not --color-surface, so it
    // reads as inset against the white card) with hairline dividers between
    // cells — gives this its own "money summary" module instead of three
    // bare text columns floating between the progress row and the trend
    // strip with nothing to set them apart.
    var moneyCell = function (label, value, color, divider) {
      return '<div style="flex:1 1 0;min-width:0;text-align:center;' + (divider ? 'border-left:1px solid var(--color-border);' : '') + '">' +
        '<div style="font-size:9.5px;color:var(--color-text-muted);font-weight:600;letter-spacing:0.02em;text-transform:uppercase;">' + label + '</div>' +
        '<div class="mono" style="font-size:13.5px;font-weight:700;color:' + color + ';margin-top:2px;">' + value + '</div>' +
      '</div>';
    };
    var moneyRow = '<div style="display:flex;background:var(--color-bg);border-radius:12px;padding:8px 2px;">' +
      moneyCell('Collections', fmt(collectedSoFar), 'var(--color-primary)', false) +
      moneyCell('Payout', fmt(payoutSoFarForGroup), 'var(--color-accent)', true) +
      moneyCell('Profit', groupProfit < 0 ? '−' + fmt(Math.abs(groupProfit)) : fmt(groupProfit), groupProfitColor, true) +
    '</div>';
    var trendBars = trend.map(function (t) {
      var h = Math.max(2, Math.round((t.pct / 100) * 14));
      var ring = t.m === g.currentMonth ? 'box-shadow:0 0 0 1.5px var(--color-primary);' : '';
      return '<div data-action="open-month" data-gid="' + g.id + '" data-m="' + t.m + '" title="' + monthLabel(g.startYear, g.startMonthIndex, t.m) + ': ' + t.pct + '%" style="flex:1 1 0;min-width:2px;height:14px;display:flex;align-items:flex-end;cursor:pointer;">' +
        '<div style="width:100%;height:' + h + 'px;background:' + t.color + ';border-radius:1.5px;' + ring + '"></div>' +
      '</div>';
    }).join('');
    var trendRow = '<div style="display:flex;align-items:center;gap:6px;">' +
      '<span style="flex-shrink:0;color:var(--color-text-faint);">' + iconTrendingUp() + '</span>' +
      '<div style="flex:1 1 auto;display:flex;align-items:flex-end;gap:1.5px;">' + trendBars + '</div>' +
    '</div>';
    return '<div class="card" data-action="open-group" data-gid="' + g.id + '" style="display:flex;flex-direction:column;gap:10px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
        '<div><div style="font-size:15px;font-weight:600;">' + escapeHtml(g.name) + '</div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-top:3px;font-size:12px;color:var(--color-text-muted);">' +
          '<span style="display:flex;align-items:center;gap:4px;">' + iconPeopleSmall('var(--color-text-faint)') + memberCount + '</span>' +
          '<span style="display:flex;align-items:center;gap:4px;">' + iconWallet('var(--color-text-faint)') + fmt(g.monthlyDeposit) + ' / month</span>' +
        '</div></div>' +
        '<div style="text-align:right;flex-shrink:0;">' + iconChevronRight() + '</div>' +
      '</div>' +
      '<div><div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;"></div></div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:6px;">' +
        '<div style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--color-text-muted);">' + iconCalendar() + 'Month ' + g.currentMonth + ' of ' + g.durationMonths + '</div>' +
        statusBadge +
      '</div>' +
      moneyRow +
      payoutLine +
      trendRow +
      '</div>' +
    '</div>';
  }).join('') || '<div class="card" style="color:var(--color-text-muted); font-size:13px; text-align:center;">No groups yet — tap + to create one.</div>';

  return '' +
    '<div class="screen">' +
      '<div style="padding:20px 20px 4px; display:flex; align-items:center; justify-content:space-between;">' +
        '<div><div style="font-size:12px;color:var(--color-text-muted);font-weight:500;">Welcome back, ' + adminName(state.currentAdmin) + '</div>' +
        '<div class="mono" style="display:flex;align-items:center;gap:8px;font-size:22px;font-weight:700;">' + iconWallet('var(--color-primary)', 22) + 'Chit Funds</div></div>' +
        '<div data-action="logout" class="avatar" style="cursor:pointer; background:' + adminAvatarColor(state.currentAdmin) + ';">' + initialsOf(adminName(state.currentAdmin)) + '</div>' +
      '</div>' +
      '<div class="content">' +
        (approvals.length ? '<div><div class="section-label">' + iconClock() + 'Signature</div><div class="row-list">' + approvals.map(renderApprovalBanner).join('') + '</div></div>' : '') +
        '<div style="background:linear-gradient(155deg, var(--color-primary) 0%, var(--color-primary-strong) 100%); border-radius:20px; padding:20px; color:var(--on-brand); box-shadow:var(--shadow-md);">' +
          '<div style="display:flex;align-items:center;gap:5px;font-size:12px;opacity:0.85;font-weight:500;">' + iconWallet('var(--on-brand)') + 'Total fund available</div>' +
          '<div class="mono" style="font-size:30px;font-weight:700;margin-top:4px;">' + fmt(state.balances.total) + '</div>' +
          '<div style="font-size:12px;opacity:0.8;margin-top:2px;">Held across both admins, all groups</div>' +
        '</div>' +
        '<div style="display:flex; gap:12px;">' +
          '<div class="stat" data-action="go-ledger" style="cursor:pointer;"><div class="label">' + adminDot('A') + ADMINS.A.name + '</div><div class="value">' + fmt(state.balances.A) + '</div></div>' +
          '<div class="stat" data-action="go-ledger" style="cursor:pointer;"><div class="label">' + adminDot('B') + ADMINS.B.name + '</div><div class="value">' + fmt(state.balances.B) + '</div></div>' +
        '</div>' +
        '<div><div class="section-label">' + iconGroupStack() + 'Groups</div><div class="row-list">' + groupCards + '</div></div>' +
      '</div>' +
      (isSuper() ? '' : '<button class="fab" data-action="create-group">' + iconPlus() + '</button>') +
      renderBottomNav('dashboard') +
    '</div>';
}
