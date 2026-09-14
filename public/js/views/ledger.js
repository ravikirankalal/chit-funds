import { ADMINS } from '../../firebase-config.js';
import { state } from '../store.js';
import { fmt, escapeHtml } from '../helpers.js';
import { renderBottomNav } from './bottomNav.js';

var FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'collection', label: 'Collections' },
  { key: 'payout', label: 'Payouts' },
  { key: 'transfer', label: 'Transfers' }
];

export function renderLedger() {
  var activeFilter = state.ui.ledgerFilter || 'all';
  var entries = activeFilter === 'all' ? state.ledgerEntries : state.ledgerEntries.filter(function (r) { return r.type === activeFilter; });

  var filterChips = FILTERS.map(function (f) {
    var active = f.key === activeFilter;
    return '<div data-action="set-ledger-filter" data-filter="' + f.key + '" style="cursor:pointer;flex-shrink:0;padding:8px 14px;border-radius:20px;font-size:12.5px;font-weight:600;' +
      (active ? 'background:var(--accent);color:#fff;' : 'background:#fff;color:var(--text);border:1px solid var(--border);') + '">' + f.label + '</div>';
  }).join('');

  var rows = entries.map(function (r) {
    var iconBg = r.type === 'collection' ? '#e6f2ec' : (r.type === 'payout' ? '#fdf1e4' : '#eef0f6');
    var iconColor = r.type === 'collection' ? '#146b52' : (r.type === 'payout' ? '#b45309' : '#3b4a8a');
    var icon = r.type === 'collection'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M12 19L6 13M12 19L18 13" stroke="' + iconColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : r.type === 'payout'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M12 5L6 11M12 5L18 11" stroke="' + iconColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 7H17M17 7L14 4M17 7L14 10" stroke="' + iconColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return '<div class="list-row" style="cursor:default;">' +
      '<div class="avatar sm" style="background:' + iconBg + ';">' + icon + '</div>' +
      '<div style="flex:1 1 auto; min-width:0;"><div style="font-size:13px;font-weight:600; overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(r.title) + '</div>' +
      '<div style="font-size:11.5px;color:var(--text-muted);margin-top:1px; overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(r.subtitle) + '</div></div>' +
      '<div style="text-align:right;flex-shrink:0;"><div style="font-size:13px;font-weight:700;color:' + r.amountColor + ';">' + r.amountFormatted + '</div>' +
      (r.time ? '<div style="font-size:10.5px;color:var(--text-muted);margin-top:2px;">' + escapeHtml(r.time) + '</div>' : '') + '</div>' +
    '</div>';
  }).join('') || '<div class="card" style="color:var(--text-muted); font-size:13px; text-align:center;">' + (activeFilter === 'all' ? 'No activity yet.' : 'No ' + activeFilter + 's yet.') + '</div>';

  return '' +
    '<div class="screen">' +
      '<div style="padding:20px 20px 4px;"><div class="mono" style="font-size:20px;font-weight:700;">Admin &amp; Ledger</div>' +
      '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Balances &amp; transactions across all groups</div></div>' +
      '<div class="content">' +
        '<div style="display:flex; gap:12px;">' +
          '<div class="stat"><div class="label">' + ADMINS.A.name + '</div><div class="value">' + fmt(state.balances.A) + '</div></div>' +
          '<div class="stat"><div class="label">' + ADMINS.B.name + '</div><div class="value">' + fmt(state.balances.B) + '</div></div>' +
        '</div>' +
        '<div class="card" style="display:flex;justify-content:space-between;align-items:center;">' +
          '<div style="font-size:13px;color:var(--text-muted);">Total in ledger</div><div class="mono" style="font-size:15px;font-weight:700;">' + fmt(state.balances.total) + '</div>' +
        '</div>' +
        '<div class="banner info"><div style="font-size:12px;color:var(--accent);line-height:1.4;">There\'s no direct admin-to-admin transfer here. Funds only move between admins per month, tied to what was actually collected, and need the other admin\'s acceptance — open a month to request one.</div></div>' +
        '<div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:2px;">' + filterChips + '</div>' +
        '<div><div class="section-label">Recent activity</div><div class="row-list">' + rows + '</div></div>' +
      '</div>' +
      renderBottomNav('ledger') +
    '</div>';
}
