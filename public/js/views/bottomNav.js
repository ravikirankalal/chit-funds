import { iconHome, iconLedger, iconPeople } from '../icons.js';

export function renderBottomNav(active) {
  var dashColor = active === 'dashboard' ? 'var(--color-primary)' : 'var(--color-text-faint)';
  var memColor = active === 'members' ? 'var(--color-primary)' : 'var(--color-text-faint)';
  var ledColor = active === 'ledger' ? 'var(--color-primary)' : 'var(--color-text-faint)';
  return '<div class="bottom-nav">' +
    '<div class="tab ' + (active === 'dashboard' ? 'active' : '') + '" data-action="go-dashboard">' + iconHome(dashColor) + '<div>Dashboard</div></div>' +
    '<div class="tab ' + (active === 'members' ? 'active' : '') + '" data-action="go-members">' + iconPeople(memColor) + '<div>Members</div></div>' +
    '<div class="tab ' + (active === 'ledger' ? 'active' : '') + '" data-action="go-ledger">' + iconLedger(ledColor) + '<div>Ledger</div></div>' +
  '</div>';
}
