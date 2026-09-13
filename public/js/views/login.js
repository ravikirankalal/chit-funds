import { state } from '../store.js';
import { escapeHtml } from '../helpers.js';
import { iconGoogle } from '../icons.js';

export function renderLogin() {
  return '' +
    '<div class="screen" style="align-items:center; justify-content:center; padding:32px; gap:28px;">' +
      '<div style="display:flex; flex-direction:column; align-items:center; gap:14px;">' +
        '<div style="width:56px;height:56px;border-radius:16px;background:var(--accent);display:flex;align-items:center;justify-content:center;">' +
          '<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6V11C4 15.5 7.4 19.7 12 21C16.6 19.7 20 15.5 20 11V6L12 2Z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12L11 14L15.5 9.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</div>' +
        '<div style="text-align:center;"><div class="mono" style="font-size:22px;font-weight:700;">Chit Funds</div>' +
        '<div style="font-size:13px;color:var(--text-muted);margin-top:2px;">Admin console</div></div>' +
      '</div>' +
      '<button data-action="signin" class="btn btn-primary" style="width:100%; display:flex; align-items:center; justify-content:center; gap:10px;">' + iconGoogle() + ' Sign in with Google</button>' +
      (state.authError ? '<div class="error-text" style="text-align:center;">' + escapeHtml(state.authError) + '</div>' : '') +
      '<div style="font-size:12px;color:var(--text-muted);text-align:center;">Only the two authorized admin Google accounts can access this app</div>' +
    '</div>';
}
