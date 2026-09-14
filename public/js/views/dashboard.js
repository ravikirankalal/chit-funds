import { ADMINS } from '../../firebase-config.js';
import { state, groupsById, membersByGroup } from '../store.js';
import { fmt, escapeHtml, adminName, adminAvatarColor, adminDot, initialsOf, isSuper, monthLabel } from '../helpers.js';
import { iconChevronRight, iconPlus, iconWarningTriangle, iconWallet, iconGroupStack, iconPeopleSmall, iconCalendar } from '../icons.js';
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

export function renderDashboard() {
  var groups = Array.from(groupsById.values());
  var approval = !isSuper() && state.pendingApprovals.find(function (a) { return a.requestedBy !== state.currentAdmin; });

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
    return '<div class="card" data-action="open-group" data-gid="' + g.id + '" style="display:flex;flex-direction:column;gap:10px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
        '<div><div style="font-size:15px;font-weight:600;">' + escapeHtml(g.name) + '</div>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-top:3px;font-size:12px;color:var(--color-text-muted);">' +
          '<span style="display:flex;align-items:center;gap:4px;">' + iconPeopleSmall('var(--color-text-faint)') + (membersByGroup.get(g.id) || []).length + '</span>' +
          '<span style="display:flex;align-items:center;gap:4px;">' + iconWallet('var(--color-text-faint)') + fmt(g.monthlyDeposit) + ' / month</span>' +
        '</div></div>' +
        iconChevronRight() +
      '</div>' +
      '<div><div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;"></div></div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:6px;">' +
        '<div style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--color-text-muted);">' + iconCalendar() + 'Month ' + g.currentMonth + ' of ' + g.durationMonths + '</div>' +
        '<div style="font-size:12px;color:var(--color-primary);font-weight:600;">' + (g.status === 'completed' ? 'Completed' : 'In progress') + '</div>' +
      '</div></div>' +
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
        (approval ? '<div class="banner warn" data-action="open-month" data-gid="' + approval.groupId + '" data-m="' + approval.month + '">' +
          '<div class="banner-title">' + iconWarningTriangle('var(--color-warning)') + 'Transfer needs your approval</div>' +
          '<div style="font-size:12.5px;">' + adminName(approval.requestedBy) + ' wants to send ' + fmt(approval.amount) + ' · ' +
          (approval.direction === 'AtoB' ? adminName('A') + ' → ' + adminName('B') : adminName('B') + ' → ' + adminName('A')) +
          ' (' + escapeHtml(approval.groupName) + ', ' + (function () {
            var ag = groupsById.get(approval.groupId);
            return ag ? monthLabel(ag.startYear, ag.startMonthIndex, approval.month) : 'Month ' + approval.month;
          })() + ')</div>' +
          '<div style="font-size:11.5px;color:var(--color-warning);font-weight:600;">Tap to review →</div></div>' : '') +
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
