import { state, groupsById, membersByGroup } from '../store.js';
import { fmt, escapeHtml, adminName, adminAvatarColor, adminDot, initialsOf, colorFor, isSuper, monthLabel } from '../helpers.js';
import { monthFinances } from '../finance/monthFinances.js';
import { iconChevronRight, iconPlus, iconWallet, iconGroupStack, iconPeopleSmall, iconCalendar, iconTrophy, iconTransfer, iconClock, iconLogout } from '../icons.js';
import { renderBottomNav } from './bottomNav.js';
import { bar } from '../skeleton.js';

// The header avatar's own dropdown — a backdrop (click anywhere outside to
// dismiss) plus a small anchored card, not a full pushNav()'d overlay like
// the app's other sheets, since there's no draft here worth restoring on
// Back/Forward (see profileMenuOpen's own comment in store.js).
function renderProfileMenu() {
  if (!state.ui.profileMenuOpen) return '';
  return '<div data-action="close-profile-menu" style="position:fixed;inset:0;z-index:39;"></div>' +
    '<div style="position:absolute;top:calc(100% + 8px);right:0;min-width:172px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;box-shadow:var(--shadow-md);padding:6px;z-index:40;">' +
      '<div style="padding:8px 10px;font-size:11px;color:var(--color-text-muted);border-bottom:1px solid var(--color-border);margin-bottom:4px;">Signed in as <strong style="color:var(--color-text);">' + escapeHtml(adminName(state.currentAdmin)) + '</strong></div>' +
      '<div data-action="logout" style="display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:10px;cursor:pointer;color:var(--color-danger);font-weight:600;font-size:13px;">' + iconLogout('var(--color-danger)', 15) + 'Sign out</div>' +
    '</div>';
}

function avatarWithMenu() {
  return '<div style="position:relative;flex-shrink:0;">' +
    '<div data-action="toggle-profile-menu" class="avatar" style="cursor:pointer; background:' + adminAvatarColor(state.currentAdmin) + ';">' + escapeHtml(initialsOf(adminName(state.currentAdmin))) + '</div>' +
    renderProfileMenu() +
  '</div>';
}

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
      who: escapeHtml(adminName(a.requestedBy)), amountText: fmt(a.amount), headlineRest: ' wants to send you ',
      subtitle: escapeHtml(a.groupName) + ' · ' + monthText + ' · ' + a.count + ' payment' + (a.count === 1 ? '' : 's')
    };
  }
  // kind === 'transfer' — the net-balance request.
  return {
    colorVar: 'secondary', icon: iconTransfer('var(--color-secondary)'),
    who: escapeHtml(adminName(a.requestedBy)), amountText: fmt(a.amount), headlineRest: ' wants to send ',
    subtitle: escapeHtml(a.groupName) + ' · ' + monthText + ' · ' +
      escapeHtml(a.direction === 'AtoB' ? adminName('A') + ' → ' + adminName('B') : adminName('B') + ' → ' + adminName('A'))
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
        '<div><div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--color-text-faint);font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">' + iconWallet('var(--color-text-faint)', 13) + 'Chit Funds</div>' +
        '<div style="font-size:19px;font-weight:700;margin-top:3px;">Welcome back, ' + escapeHtml(adminName(state.currentAdmin)) + '</div></div>' +
        avatarWithMenu() +
      '</div>' +
      '<div class="content">' + renderLoadingSkeleton() + '</div>' +
      renderBottomNav('dashboard') +
    '</div>';
  }

  var groupCards = groups.map(function (g) {
    var pct = Math.round((g.currentMonth / g.durationMonths) * 100);
    var members = membersByGroup.get(g.id) || [];
    var memberCount = members.length;
    var f = monthFinances(g.id, g, g.currentMonth);
    // Winner names resolved here rather than stored — a month doc only
    // ever holds memberIds (see getMonthWinners in finance/shared.js).
    var winnerNames = f.winners.map(function (w) {
      var mm = members.find(function (x) { return x.id === w.memberId; });
      return mm ? mm.name : '—';
    });
    var payoutLine = winnerNames.length
      ? '<div style="font-size:11.5px;color:var(--color-text-muted);"><span style="display:flex;align-items:center;gap:4px;">' + iconTrophy('var(--color-text-faint)') + (winnerNames.length > 1 ? 'Winners: ' : 'Winner: ') + escapeHtml(winnerNames.join(', ')) + '</span></div>'
      : '';
    // Collected/paid-out totals across every month so far — same real
    // (not target) paid figures as the group-detail page's own stats card.
    // Reuses f (already computed above) for the current month instead of
    // calling monthFinances on it a second time.
    var collectedSoFar = 0, payoutSoFarForGroup = 0;
    for (var tm = 1; tm <= g.currentMonth; tm++) {
      var tf = tm === g.currentMonth ? f : monthFinances(g.id, g, tm);
      collectedSoFar += tf.totalCollected;
      payoutSoFarForGroup += tf.payoutPaidA + tf.payoutPaidB;
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
    // A stack of overlapping member avatars reads as "who's in this" far
    // faster than a bare people-icon + count, and reuses the same
    // color/initials convention as the members list itself instead of
    // introducing a new visual language just for this card.
    var avatarStack = members.length
      ? '<div style="display:flex;align-items:center;">' +
          members.slice(0, 4).map(function (mm, idx) {
            return '<div class="avatar sm" style="background:' + colorFor(idx) + ';border:2px solid var(--color-surface);' + (idx > 0 ? 'margin-left:-8px;' : '') + '">' + initialsOf(mm.name) + '</div>';
          }).join('') +
          (memberCount > 4 ? '<div class="avatar sm" style="background:var(--color-border);color:var(--color-text-muted);margin-left:-8px;">+' + (memberCount - 4) + '</div>' : '') +
        '</div>'
      : '<span style="display:flex;align-items:center;gap:4px;">' + iconPeopleSmall('var(--color-text-faint)') + '0</span>';
    return '<div class="card" data-action="open-group" data-gid="' + g.id + '" style="display:flex;flex-direction:column;gap:10px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<div><div style="font-size:15px;font-weight:600;">' + escapeHtml(g.name) + '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;margin-top:5px;font-size:12px;color:var(--color-text-muted);">' +
          avatarStack +
          '<span style="display:flex;align-items:center;gap:4px;">' + iconWallet('var(--color-text-faint)') + fmt(g.monthlyDeposit) + ' / month</span>' +
        '</div></div>' +
        '<div style="text-align:right;flex-shrink:0;">' + iconChevronRight() + '</div>' +
      '</div>' +
      '<div>' +
        '<div style="display:flex;align-items:center;gap:5px;margin-bottom:6px;font-size:12px;color:var(--color-text-muted);">' + iconCalendar() + 'Month ' + g.currentMonth + ' of ' + g.durationMonths + '</div>' +
        '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;"></div></div>' +
      '</div>' +
      moneyRow +
      payoutLine +
      '</div>' +
    '</div>';
  }).join('') || '<div class="card" style="color:var(--color-text-muted); font-size:13px; text-align:center;">No groups yet — tap + to create one.</div>';

  // The hero and its per-admin split sit on a solid blue gradient, not the
  // white surface --color-danger/--color-success were tuned for — a soft
  // pink/mint tint of each keeps a negative or positive balance readable
  // at a glance without a full-strength red/green disappearing into or
  // clashing with the brand blue behind it.
  function onBrandAmountColor(n) { return n < 0 ? '#ffd2ce' : (n > 0 ? '#c9f2d8' : 'var(--on-brand)'); }

  return '' +
    '<div class="screen">' +
      '<div style="padding:20px 20px 4px; display:flex; align-items:center; justify-content:space-between;">' +
        '<div><div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--color-text-faint);font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">' + iconWallet('var(--color-text-faint)', 13) + 'Chit Funds</div>' +
        '<div style="font-size:19px;font-weight:700;margin-top:3px;">Welcome back, ' + escapeHtml(adminName(state.currentAdmin)) + '</div></div>' +
        avatarWithMenu() +
      '</div>' +
      '<div class="content">' +
        (approvals.length ? '<div><div class="section-label">' + iconClock() + 'Signature</div><div class="row-list">' + approvals.map(renderApprovalBanner).join('') + '</div></div>' : '') +
        // The per-admin split used to live in two separate white stat cards
        // right below the hero — a second, differently-styled block for
        // what's really one fact ("who holds what of the total"). Folded
        // into the hero itself as a footer strip instead, on a translucent
        // divider so it stays legible on the gradient without a hard edge.
        '<div style="background:linear-gradient(155deg, var(--color-primary) 0%, var(--color-primary-strong) 100%); border-radius:20px; padding:20px; color:var(--on-brand); box-shadow:var(--shadow-md);">' +
          '<div style="display:flex;align-items:center;gap:5px;font-size:12px;opacity:0.85;font-weight:500;">' + iconWallet('var(--on-brand)') + 'Total fund available</div>' +
          '<div class="mono" style="font-size:30px;font-weight:700;margin-top:4px;color:' + onBrandAmountColor(state.balances.total) + ';">' + fmt(state.balances.total) + '</div>' +
          '<div style="display:flex;gap:12px;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.2);">' +
            '<div data-action="go-ledger" style="flex:1 1 0;min-width:0;cursor:pointer;">' +
              '<div style="display:flex;align-items:center;gap:5px;font-size:11px;opacity:0.85;">' + adminDot('A') + escapeHtml(adminName('A')) + '</div>' +
              '<div class="mono" style="font-size:15px;font-weight:700;margin-top:3px;color:' + onBrandAmountColor(state.balances.A) + ';">' + fmt(state.balances.A) + '</div>' +
            '</div>' +
            '<div data-action="go-ledger" style="flex:1 1 0;min-width:0;cursor:pointer;padding-left:12px;border-left:1px solid rgba(255,255,255,0.2);">' +
              '<div style="display:flex;align-items:center;gap:5px;font-size:11px;opacity:0.85;">' + adminDot('B') + escapeHtml(adminName('B')) + '</div>' +
              '<div class="mono" style="font-size:15px;font-weight:700;margin-top:3px;color:' + onBrandAmountColor(state.balances.B) + ';">' + fmt(state.balances.B) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div><div class="section-label">' + iconGroupStack() + 'Groups</div><div class="row-list">' + groupCards + '</div></div>' +
      '</div>' +
      ((isSuper() || !state.config.addGroupsEnabled) ? '' : '<button class="fab" data-action="create-group">' + iconPlus() + '</button>') +
      renderBottomNav('dashboard') +
    '</div>';
}
