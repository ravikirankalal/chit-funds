import { ADMINS } from '../../firebase-config.js';
import { state, groupsById } from '../store.js';
import { fmt, escapeHtml, adminName, adminAvatarColor, initialsOf, isSuper, monthLabel } from '../helpers.js';
import { iconChevronRight, iconPlus } from '../icons.js';
import { renderBottomNav } from './bottomNav.js';

export function renderDashboard() {
  var groups = Array.from(groupsById.values());
  var approval = !isSuper() && state.pendingApprovals.find(function (a) { return a.requestedBy !== state.currentAdmin; });

  var groupCards = groups.map(function (g) {
    var pct = Math.round((g.currentMonth / g.durationMonths) * 100);
    return '<div class="card" data-action="open-current-month" data-gid="' + g.id + '" style="display:flex;flex-direction:column;gap:10px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
        '<div><div style="font-size:15px;font-weight:600;">' + escapeHtml(g.name) + '</div>' +
        '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">' + g.memberCount + ' members · ' + fmt(g.monthlyDeposit) + ' / month</div></div>' +
        iconChevronRight() +
      '</div>' +
      '<div><div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;"></div></div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:6px;">' +
        '<div style="font-size:12px;color:var(--text-muted);">Month ' + g.currentMonth + ' of ' + g.durationMonths + '</div>' +
        '<div style="font-size:12px;color:var(--accent);font-weight:600;">' + (g.status === 'completed' ? 'Completed' : 'In progress') + '</div>' +
      '</div></div>' +
    '</div>';
  }).join('') || '<div class="card" style="color:var(--text-muted); font-size:13px; text-align:center;">No groups yet — tap + to create one.</div>';

  return '' +
    '<div class="screen">' +
      '<div style="padding:20px 20px 4px; display:flex; align-items:center; justify-content:space-between;">' +
        '<div><div style="font-size:12px;color:var(--text-muted);font-weight:500;">Welcome back, ' + adminName(state.currentAdmin) + '</div>' +
        '<div class="mono" style="font-size:22px;font-weight:700;">Chit Funds</div></div>' +
        '<div data-action="logout" class="avatar" style="cursor:pointer; background:' + adminAvatarColor(state.currentAdmin) + ';">' + initialsOf(adminName(state.currentAdmin)) + '</div>' +
      '</div>' +
      '<div class="content">' +
        (approval ? '<div class="banner warn" data-action="open-month" data-gid="' + approval.groupId + '" data-m="' + approval.month + '">' +
          '<div class="banner-title">Transfer needs your approval</div>' +
          '<div style="font-size:12.5px;">' + adminName(approval.requestedBy) + ' wants to send ' + fmt(approval.amount) + ' · ' +
          (approval.direction === 'AtoB' ? adminName('A') + ' → ' + adminName('B') : adminName('B') + ' → ' + adminName('A')) +
          ' (' + escapeHtml(approval.groupName) + ', ' + (function () {
            var ag = groupsById.get(approval.groupId);
            return ag ? monthLabel(ag.startYear, ag.startMonthIndex, approval.month) : 'Month ' + approval.month;
          })() + ')</div>' +
          '<div style="font-size:11.5px;color:var(--warning);font-weight:600;">Tap to review →</div></div>' : '') +
        '<div style="background:var(--accent); border-radius:16px; padding:20px; color:#fff;">' +
          '<div style="font-size:12px;opacity:0.85;font-weight:500;">Total fund available</div>' +
          '<div class="mono" style="font-size:30px;font-weight:700;margin-top:4px;">' + fmt(state.balances.total) + '</div>' +
          '<div style="font-size:12px;opacity:0.8;margin-top:2px;">Held across both admins, all groups</div>' +
        '</div>' +
        '<div style="display:flex; gap:12px;">' +
          '<div class="stat" data-action="go-ledger" style="cursor:pointer;"><div class="label">' + ADMINS.A.name + '</div><div class="value">' + fmt(state.balances.A) + '</div></div>' +
          '<div class="stat" data-action="go-ledger" style="cursor:pointer;"><div class="label">' + ADMINS.B.name + '</div><div class="value">' + fmt(state.balances.B) + '</div></div>' +
        '</div>' +
        '<div><div class="section-label">Groups</div><div class="row-list">' + groupCards + '</div></div>' +
      '</div>' +
      (isSuper() ? '' : '<button class="fab" data-action="create-group">' + iconPlus() + '</button>') +
      renderBottomNav('dashboard') +
    '</div>';
}
