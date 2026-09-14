// The one place that touches the DOM. Dispatches to a per-screen view
// module based on state.screen, then handles the two cross-cutting
// concerns every screen needs: preserving focus/caret across a re-render
// triggered by a background Firestore update, and the busy spinner.

import { state } from './store.js';
import { renderLogin } from './views/login.js';
import { renderDashboard } from './views/dashboard.js';
import { renderMembers } from './views/members.js';
import { renderLedger } from './views/ledger.js';
import { renderGroupDetail, scrollToActiveMonth } from './views/groupDetail.js';
import { renderGroupMembers } from './views/groupMembers.js';
import { renderMemberPayments } from './views/memberPayments.js';
import { renderCreateGroup } from './views/createGroup.js';
import { renderMonthDetail } from './views/monthDetail.js';
import { renderBootSkeleton } from './skeleton.js';

// Tracks whether the group detail screen still owes its one-time scroll to
// the active month for whatever group is currently open — reset whenever
// we're about to render a *different* visit to that screen (a fresh nav
// in, or switching to a different group), so a later re-render of the
// same visit (toggling a tab, recording a payment) never re-scrolls the
// user away from wherever they've since scrolled to.
var groupDetailScrollGid = null;
var groupDetailScrollDone = false;

export function render() {
  var root = document.getElementById('app');

  if (state.screen === 'groupDetail' && state.activeGroupId !== groupDetailScrollGid) {
    groupDetailScrollGid = state.activeGroupId;
    groupDetailScrollDone = false;
  }

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
      var didx = active.getAttribute('data-idx');
      activeSelector = didx != null ? '[data-field="' + df + '"][data-idx="' + didx + '"]' : '[data-field="' + df + '"]';
      activeSelStart = active.selectionStart;
      activeSelEnd = active.selectionEnd;
    }
  }

  // A re-render while a sheet is already open (e.g. tapping the payment
  // modal's Cash/Online toggle) still fully replaces root.innerHTML below,
  // rebuilding the .overlay/.sheet nodes — which would otherwise replay
  // their CSS entrance animation and read as a flash. Tag them 'no-anim'
  // whenever a real (non-busy) overlay was already on screen just before
  // this render. :not(.busy-overlay) excludes the spinner overlay, which
  // addBusyOverlay() appends after innerHTML runs rather than rendering
  // from html below, so its presence doesn't reflect a sheet being open.
  var hadSheet = !!root.querySelector('.overlay:not(.busy-overlay)');

  var html;
  switch (state.screen) {
    case 'login': html = renderLogin(); break;
    case 'dashboard': html = renderDashboard(); break;
    case 'members': html = renderMembers(); break;
    case 'groupDetail': html = renderGroupDetail(); break;
    case 'groupMembers': html = renderGroupMembers(); break;
    case 'memberPayments': html = renderMemberPayments(); break;
    case 'createGroup': html = renderCreateGroup(); break;
    case 'monthDetail': html = renderMonthDetail(); break;
    case 'ledger': html = renderLedger(); break;
    default: html = renderBootSkeleton();
  }
  root.innerHTML = html;

  if (hadSheet) {
    var sheetEls = root.querySelectorAll('.overlay, .sheet');
    for (var si = 0; si < sheetEls.length; si++) sheetEls[si].classList.add('no-anim');
  }

  if (state.screen === 'groupDetail' && !groupDetailScrollDone) {
    groupDetailScrollDone = scrollToActiveMonth(root);
  }

  if (activeSelector) {
    var again = root.querySelector(activeSelector);
    if (again) {
      again.focus();
      try { again.setSelectionRange(activeSelStart, activeSelEnd); } catch (e2) {}
    }
  }

  if (state.busy) addBusyOverlay(root);
}

function addBusyOverlay(root) {
  var overlay = document.createElement('div');
  overlay.className = 'overlay busy-overlay';
  overlay.style.background = 'rgba(28,27,25,0.25)';
  overlay.style.alignItems = 'center';
  overlay.innerHTML = '<div class="spinner"></div>';
  root.appendChild(overlay);
}

// setBusy(true) (actions.js) calls this directly instead of going through
// the full render() above, specifically to avoid triggering one. A full
// render() replaces root.innerHTML — rebuilding every DOM node, including
// whatever overlay/sheet is currently open — which restarts its CSS
// entrance animation (see .sheet's `animation: sheet-in` in overlays.css).
// Firing that the instant an action starts (busy=true, overlay/sheet still
// showing) made the payment drawer's entrance animation visibly replay
// right as it was about to close a moment later, reading as a flash.
// Toggling just the spinner overlay leaves the rest of the DOM (and any
// in-flight animation) untouched; nothing else reads state.busy (verified —
// render()'s own check above is the only other reader), so this is safe
// for every setBusy(true) call site. setBusy(false) still goes through the
// full render() — by then whatever action was in flight has already
// updated state, so that render is the one call that needs to show the
// result (and there's no longer an open overlay for it to disrupt).
export function setBusyOverlay(v) {
  var root = document.getElementById('app');
  var existing = root.querySelector('.busy-overlay');
  if (v) {
    if (!existing) addBusyOverlay(root);
  } else if (existing) {
    existing.remove();
  }
}
