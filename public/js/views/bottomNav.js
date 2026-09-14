import { iconHome, iconLedger, iconPeople } from '../icons.js';

export function renderBottomNav(active) {
  var dashColor = active === 'dashboard' ? 'var(--accent)' : '#a39d92';
  var memColor = active === 'members' ? 'var(--accent)' : '#a39d92';
  var ledColor = active === 'ledger' ? 'var(--accent)' : '#a39d92';
  return '<div class="bottom-nav">' +
    '<div class="tab ' + (active === 'dashboard' ? 'active' : '') + '" data-action="go-dashboard">' + iconHome(dashColor) + '<div>Dashboard</div></div>' +
    '<div class="tab ' + (active === 'members' ? 'active' : '') + '" data-action="go-members">' + iconPeople(memColor) + '<div>Members</div></div>' +
    '<div class="tab ' + (active === 'ledger' ? 'active' : '') + '" data-action="go-ledger">' + iconLedger(ledColor) + '<div>Ledger</div></div>' +
  '</div>';
}
