// Screen navigation + browser/hardware back-button integration.
//
// The app never changes the URL, only what's on screen — so without this,
// there's no history entry for the back button to land on and it just
// closes the app. Every "forward" navigation (goTo, opening an overlay)
// pushes a snapshot of the relevant state; every "back" control (topbar
// arrows, overlay close buttons — see actions/ and events.js) calls
// history.back() instead of touching state directly, and popstate here is
// the one place that applies a popped snapshot back onto `state`.
// Dashboard/login are treated as the root — arriving at either collapses
// history instead of growing it.

import { state, membersById } from './store.js';
import { render } from './render.js';

function navSnapshot() {
  var pm = state.ui.paymentModal;
  var mf = state.ui.memberForm;
  var amg = state.ui.addMemberToGroup;
  return {
    screen: state.screen,
    activeGroupId: state.activeGroupId,
    viewMonth: state.viewMonth,
    viewMemberId: state.viewMemberId,
    showWinnerPicker: state.ui.showWinnerPicker,
    paymentModalMemberId: pm ? pm.memberId : null,
    paymentModalMode: pm ? pm.mode : null,
    paymentModalEditing: pm ? pm.isEditing : null,
    createGroupStep: state.ui.newGroup ? state.ui.newGroup.step : null,
    memberFormMode: mf ? (mf.id ? 'edit' : 'new') : null,
    memberFormId: mf ? mf.id : null,
    addMemberToGroupGid: amg ? amg.gid : null
  };
}

export function pushNav() { history.pushState(navSnapshot(), ''); }
export function replaceNav() { history.replaceState(navSnapshot(), ''); }

// A hard refresh reloads the current history entry, and the browser hands
// that entry's state back via `history.state` before any of our JS runs —
// same mechanism the back button already uses (see popstate below). Auth.js
// uses this once, right after sign-in resolves, so a refresh lands back on
// the screen you were on instead of always bouncing to the dashboard.
// Overlays aren't part of this — only the base screen + which group/month,
// since an overlay draft (a half-typed name, a pending payment edit) isn't
// preserved and would be misleading to reopen empty.
var RESTORABLE_SCREENS = { dashboard: 1, members: 1, groupDetail: 1, groupMembers: 1, memberPayments: 1, monthDetail: 1, ledger: 1 };

export function getRestorableSnapshot() {
  var snap = history.state;
  if (!snap || !RESTORABLE_SCREENS[snap.screen]) return null;
  return { screen: snap.screen, activeGroupId: snap.activeGroupId, viewMonth: snap.viewMonth, viewMemberId: snap.viewMemberId };
}

window.addEventListener('popstate', function (e) {
  if (!e.state) return; // nothing of ours here — let the browser do its default thing
  var snap = e.state;
  // submitCreateGroup() clears state.ui.newGroup on success without
  // popping the wizard's own pushNav()'d step entries, so one or more
  // stale 'createGroup' entries can sit below wherever navigation
  // continued from. Landing on one with no newGroup to show would crash
  // renderCreateGroup() — skip on past it the same way dashboard/login
  // collapse history instead of growing it.
  if (snap.screen === 'createGroup' && !state.ui.newGroup) { history.back(); return; }
  // A completion action (savePaymentModal, etc. — see actions/) applies
  // its own "overlay closed" state synchronously and then calls
  // history.back() to pop the entry pushed when the overlay opened, so Back
  // only ever needs one press even after several open+save cycles in a
  // row. That means the popstate this triggers, a moment later, is often a
  // no-op — the snapshot it's restoring already matches current state. Skip
  // the render in that case: firing it anyway would still SHOW the same
  // thing, but the extra full-DOM replace is a visible flash right as the
  // overlay closes.
  var before = navSnapshot();
  state.screen = snap.screen;
  state.activeGroupId = snap.activeGroupId;
  state.viewMonth = snap.viewMonth;
  state.viewMemberId = snap.viewMemberId;
  state.ui.showWinnerPicker = !!snap.showWinnerPicker;
  state.ui.paymentModal = snap.paymentModalMemberId
    ? { memberId: snap.paymentModalMemberId, mode: snap.paymentModalMode, isEditing: !!snap.paymentModalEditing }
    : null;
  if (state.ui.newGroup && snap.createGroupStep) state.ui.newGroup.step = snap.createGroupStep;
  state.ui.memberForm = snap.memberFormMode
    ? { id: snap.memberFormMode === 'edit' ? snap.memberFormId : null,
        name: snap.memberFormMode === 'edit' ? ((membersById.get(snap.memberFormId) || {}).name || '') : '' }
    : null;
  state.ui.addMemberToGroup = snap.addMemberToGroupGid ? { gid: snap.addMemberToGroupGid, draftName: '' } : null;
  var after = navSnapshot();
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  render();
});

export function goTo(screen, extra) {
  state.screen = screen;
  state.ui.showWinnerPicker = false;
  state.ui.paymentModal = null;
  state.ui.memberForm = null;
  state.ui.addMemberToGroup = null;
  state.ui.transferSelection = null;
  if (extra) Object.assign(state, extra);
  render();
  if (screen === 'dashboard' || screen === 'login') replaceNav();
  else pushNav();
}
