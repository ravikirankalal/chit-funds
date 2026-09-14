import { ADMINS } from '../../firebase-config.js';
import { state } from '../store.js';
import { fmt, escapeHtml, adminDot } from '../helpers.js';
import { renderBottomNav } from './bottomNav.js';
import { iconCollection, iconPayout, iconTransfer, iconInfo, iconCalendar, iconLedger, iconWallet } from '../icons.js';

var FILTERS = [
  { key: 'all', label: 'All', icon: iconLedger },
  { key: 'collection', label: 'Collections', icon: iconCollection },
  { key: 'payout', label: 'Payouts', icon: iconPayout },
  { key: 'transfer', label: 'Transfers', icon: iconTransfer }
];

export function renderLedger() {
  var activeFilter = state.ui.ledgerFilter || 'all';
  var entries = activeFilter === 'all' ? state.ledgerEntries : state.ledgerEntries.filter(function (r) { return r.type === activeFilter; });

  var filterChips = FILTERS.map(function (f) {
    var active = f.key === activeFilter;
    var color = active ? 'var(--on-brand)' : 'var(--color-text-muted)';
    return '<div data-action="set-ledger-filter" data-filter="' + f.key + '" style="display:flex;align-items:center;gap:5px;cursor:pointer;flex-shrink:0;padding:8px 14px;border-radius:20px;font-size:12.5px;font-weight:600;' +
      (active ? 'background:var(--color-primary);color:var(--on-brand);' : 'background:var(--color-surface);color:var(--color-text);border:1px solid var(--color-border);') + '">' + f.icon(color) + f.label + '</div>';
  }).join('');

  var rows = entries.map(function (r) {
    var iconBg = r.type === 'collection' ? 'var(--color-success-soft)' : (r.type === 'payout' ? 'var(--color-accent-soft)' : 'var(--color-secondary-soft)');
    var iconColor = r.type === 'collection' ? 'var(--color-success)' : (r.type === 'payout' ? 'var(--color-accent)' : 'var(--color-secondary)');
    var icon = r.type === 'collection' ? iconCollection(iconColor) : (r.type === 'payout' ? iconPayout(iconColor) : iconTransfer(iconColor));
    return '<div class="list-row" style="cursor:default;">' +
      '<div class="avatar sm" style="background:' + iconBg + ';">' + icon + '</div>' +
      '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600; overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(r.title) + '</div>' +
      '<div style="font-size:11.5px;color:var(--color-text-muted);margin-top:1px; overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(r.subtitle) + '</div></div>' +
      '<div style="text-align:right;flex-shrink:0;"><div style="font-size:13px;font-weight:700;color:' + r.amountColor + ';">' + r.amountFormatted + '</div>' +
      (r.time ? '<div style="font-size:10.5px;color:var(--color-text-muted);margin-top:2px;">' + escapeHtml(r.time) + '</div>' : '') + '</div>' +
    '</div>';
  }).join('') || '<div class="card" style="color:var(--color-text-muted); font-size:13px; text-align:center;">' + (activeFilter === 'all' ? 'No activity yet.' : 'No ' + activeFilter + 's yet.') + '</div>';

  return '' +
    '<div class="screen">' +
      '<div style="padding:20px 20px 4px;"><div class="mono" style="display:flex;align-items:center;gap:7px;font-size:20px;font-weight:700;">' + iconLedger('var(--color-primary)') + 'Admin &amp; Ledger</div>' +
      '<div style="font-size:12px;color:var(--color-text-muted);margin-top:2px;">Balances &amp; transactions across all groups</div></div>' +
      '<div class="content">' +
        '<div style="display:flex; gap:12px;">' +
          '<div class="stat"><div class="label">' + adminDot('A') + ADMINS.A.name + '</div><div class="value">' + fmt(state.balances.A) + '</div></div>' +
          '<div class="stat"><div class="label">' + adminDot('B') + ADMINS.B.name + '</div><div class="value">' + fmt(state.balances.B) + '</div></div>' +
        '</div>' +
        '<div class="card" style="display:flex;justify-content:space-between;align-items:center;">' +
          '<div style="display:flex;align-items:center;gap:5px;font-size:13px;color:var(--color-text-muted);">' + iconWallet() + 'Total in ledger</div><div class="mono" style="font-size:15px;font-weight:700;">' + fmt(state.balances.total) + '</div>' +
        '</div>' +
        '<div class="banner info"><div class="banner-title">' + iconInfo('var(--color-secondary)') + 'How transfers work</div><div style="font-size:12px;color:var(--color-secondary);line-height:1.4;">There\'s no direct admin-to-admin transfer here. Funds only move between admins per month, tied to what was actually collected, and need the other admin\'s acceptance — open a month to request one.</div></div>' +
        '<div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:2px;">' + filterChips + '</div>' +
        '<div><div class="section-label">' + iconCalendar() + 'Recent activity</div><div class="row-list">' + rows + '</div></div>' +
      '</div>' +
      renderBottomNav('ledger') +
    '</div>';
}
