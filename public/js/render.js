// The one place that touches the DOM. Dispatches to a per-screen view
// module based on state.screen, then handles the two cross-cutting
// concerns every screen needs: preserving focus/caret across a re-render
// triggered by a background Firestore update, and the busy spinner.

import { state } from './store.js';
import { renderLogin } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderLedger } from './views/ledger.js';
import { renderGroupDetail } from './views/groupDetail.js';
import { renderCreateGroup } from './views/createGroup.js';
import { renderMonthDetail } from './views/monthDetail.js';

export function render() {
  var root = document.getElementById('app');

  // a background Firestore update can trigger a re-render while the user is
  // mid-typing; every input is state-controlled via data-field, so state
  // already has the latest value by the time we get here — we just need to
  // restore FOCUS and CARET POSITION after the innerHTML swap below (the
  // captured value is only ever equal to what state already renders; never
  // restore a raw pre-render DOM value here, or an action that deliberately
  // clears a field, like "add member", gets its clear silently undone)
  var active = document.activeElement;
  var activeSelector = null, activeSelStart = null, activeSelEnd = null;
  if (active && root.contains(active) && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
    var df = active.getAttribute('data-field');
    if (df) {
      activeSelector = '[data-field="' + df + '"]';
      activeSelStart = active.selectionStart;
      activeSelEnd = active.selectionEnd;
    }
  }

  var html;
  switch (state.screen) {
    case 'login': html = renderLogin(); break;
    case 'dashboard': html = renderDashboard(); break;
    case 'groupDetail': html = renderGroupDetail(); break;
    case 'createGroup': html = renderCreateGroup(); break;
    case 'monthDetail': html = renderMonthDetail(); break;
    case 'ledger': html = renderLedger(); break;
    default: html = '<div class="boot">Loading Chit Funds…</div>';
  }
  root.innerHTML = html;

  if (activeSelector) {
    var again = root.querySelector(activeSelector);
    if (again) {
      again.focus();
      try { again.setSelectionRange(activeSelStart, activeSelEnd); } catch (e2) {}
    }
  }

  if (state.busy) {
    var overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.style.background = 'rgba(28,27,25,0.25)';
    overlay.style.alignItems = 'center';
    overlay.innerHTML = '<div class="spinner"></div>';
    root.appendChild(overlay);
  }
}
