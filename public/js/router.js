// Screen navigation + browser/hardware back-button integration.
//
// The app never changes the URL, only what's on screen — so without this,
// there's no history entry for the back button to land on and it just
// closes the app. Every "forward" navigation (goTo, opening an overlay)
// pushes a snapshot of the relevant state; every "back" control (topbar
// arrows, overlay close buttons — see actions.js and events.js) calls
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

window.addEventListener('popstate', function (e) {
  if (!e.state) return; // nothing of ours here — let the browser do its default thing
  var snap = e.state;
  state.screen = snap.screen;
  state.activeGroupId = snap.activeGroupId;
  state.viewMonth = snap.viewMonth;
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
