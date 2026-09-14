// All DOM event wiring lives here: one delegated click listener (matched
// against the data-action attributes the view modules render), a keydown
// listener for "Enter submits the add-member field", and an input
// listener that keeps the create-group form's fields in sync with state.
//
// Deliberately the only module that imports both actions.js and auth.js —
// everything else only needs one or the other.

import { state } from './store.js';
import { render } from './render.js';
import { goTo } from './router.js';
import { signInGoogle, doLogout } from './auth.js';
import { flatPayoutSchedule } from './helpers.js';
import {
  startCreateGroup, createGroupStep2, addDraftMember, addExistingDraftMember, removeDraftMember, submitCreateGroup,
  openGroupDetail, openGroupMembers, openMemberPayments, removeMemberFromGroup, openMonth, openPaymentModal, closePaymentModal, setModalMode,
  savePaymentModal, markUnpaidFromModal, togglePaymentSection, setLedgerFilter, openWinnerPicker, closeWinnerPicker, addWinner, removeWinner, setWinnerAmount,
  closeMonthAction, requestTransferToB, requestTransferToA,
  acceptTransferRequest, declineTransferRequest, cancelTransferRequest,
  openMemberForm, closeMemberForm, saveMemberForm,
  openAddMemberToGroup, closeAddMemberToGroup, addExistingMemberToGroup, createAndAddMemberToGroup,
  togglePaymentSelection, cancelTransferSelection, confirmTransfer
} from './actions.js';

// Holding a payment row (in the logged-in admin's own "collected by"
// section) starts a multi-select for handing payments off to the other
// admin — see togglePaymentSelection. Once selection is active, a plain
// tap on another eligible row adds/removes it too (handled in the
// 'open-payment-modal' case below); a short tap outside selection mode
// still opens the payment modal as usual — only a press held past
// LONG_PRESS_MS starts selecting.
var LONG_PRESS_MS = 550;
var pressTimer = null;
var suppressNextClick = false;

function clearPressTimer() { clearTimeout(pressTimer); pressTimer = null; }

document.addEventListener('pointerdown', function (e) {
  var el = e.target.closest('[data-transferable]');
  if (!el) return;
  clearPressTimer();
  pressTimer = setTimeout(function () {
    suppressNextClick = true;
    togglePaymentSelection(el.getAttribute('data-mid'));
  }, LONG_PRESS_MS);
});
['pointerup', 'pointerleave', 'pointercancel'].forEach(function (evt) {
  document.addEventListener(evt, clearPressTimer);
});

document.addEventListener('click', function (e) {
  if (suppressNextClick) { suppressNextClick = false; return; }
  var el = e.target.closest('[data-action]');
  if (!el) return;
  var action = el.getAttribute('data-action');
  switch (action) {
    case 'signin': signInGoogle(); break;
    case 'logout': doLogout(); break;
    case 'go-dashboard': goTo('dashboard'); break;
    case 'go-members': goTo('members'); break;
    case 'go-ledger': goTo('ledger'); break;
    case 'nav-back': history.back(); break;
    case 'create-group': startCreateGroup(); break;
    case 'cancel-create-group': history.back(); break;
    case 'create-group-step2': createGroupStep2(); break;
    case 'create-group-back-step1': history.back(); break;
    case 'add-draft-member': addDraftMember(); break;
    case 'add-existing-draft-member': addExistingDraftMember(el.getAttribute('data-mid')); break;
    case 'remove-draft-member': removeDraftMember(parseInt(el.getAttribute('data-idx'), 10)); break;
    case 'submit-create-group': submitCreateGroup(); break;
    case 'open-group': openGroupDetail(el.getAttribute('data-gid')); break;
    case 'open-group-members': openGroupMembers(el.getAttribute('data-gid')); break;
    case 'open-member-payments': openMemberPayments(el.getAttribute('data-gid'), el.getAttribute('data-mid')); break;
    case 'remove-member-from-group': removeMemberFromGroup(el.getAttribute('data-gid'), el.getAttribute('data-mid')); break;
    case 'open-month': openMonth(el.getAttribute('data-gid'), parseInt(el.getAttribute('data-m'), 10)); break;
    case 'open-payment-modal':
      if (state.ui.transferSelection && el.hasAttribute('data-transferable')) togglePaymentSelection(el.getAttribute('data-mid'));
      else openPaymentModal(el.getAttribute('data-mid'));
      break;
    case 'close-payment-modal': closePaymentModal(); break;
    case 'set-modal-mode': setModalMode(el.getAttribute('data-mode')); break;
    case 'save-payment': savePaymentModal(); break;
    case 'mark-unpaid': markUnpaidFromModal(); break;
    case 'toggle-payment-section': togglePaymentSection(el.getAttribute('data-key')); break;
    case 'set-ledger-filter': setLedgerFilter(el.getAttribute('data-filter')); break;
    case 'open-winner-picker': openWinnerPicker(); break;
    case 'close-winner-picker': closeWinnerPicker(); break;
    case 'add-winner': addWinner(el.getAttribute('data-mid')); break;
    case 'remove-winner': removeWinner(el.getAttribute('data-mid')); break;
    case 'close-month': closeMonthAction(); break;
    case 'request-transfer-b': requestTransferToB(); break;
    case 'request-transfer-a': requestTransferToA(); break;
    case 'accept-transfer-request': acceptTransferRequest(); break;
    case 'decline-transfer-request': declineTransferRequest(); break;
    case 'cancel-transfer-request': cancelTransferRequest(); break;
    case 'cancel-transfer-selection': cancelTransferSelection(); break;
    case 'confirm-transfer': confirmTransfer(); break;
    case 'open-member-form': openMemberForm(el.getAttribute('data-id')); break;
    case 'close-member-form': closeMemberForm(); break;
    case 'save-member-form': saveMemberForm(); break;
    case 'open-add-member-to-group': openAddMemberToGroup(el.getAttribute('data-gid')); break;
    case 'close-add-member-to-group': closeAddMemberToGroup(); break;
    case 'add-existing-member-to-group': addExistingMemberToGroup(el.getAttribute('data-gid'), el.getAttribute('data-mid')); break;
    case 'create-and-add-member-to-group': createAndAddMemberToGroup(el.getAttribute('data-gid')); break;
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && e.target && e.target.getAttribute && e.target.getAttribute('data-field') === 'draftMemberName') {
    e.preventDefault();
    addDraftMember();
  }
});

document.addEventListener('input', function (e) {
  var field = e.target.getAttribute && e.target.getAttribute('data-field');
  if (!field) return;

  if (field === 'memberFormName' && state.ui.memberForm) {
    state.ui.memberForm.name = e.target.value;
    render();
    return;
  }
  if (field === 'addMemberDraftName' && state.ui.addMemberToGroup) {
    state.ui.addMemberToGroup.draftName = e.target.value;
    render();
    return;
  }

  if (!state.ui.newGroup) return;
  var g = state.ui.newGroup;
  if (field === 'name') g.name = e.target.value;
  else if (field === 'durationMonths') {
    g.durationMonths = Math.max(1, parseInt(e.target.value, 10) || 1);
    g.payoutSchedule = flatPayoutSchedule(g.payoutStart, g.durationMonths);
  }
  else if (field === 'totalMembers') g.totalMembers = Math.max(1, parseInt(e.target.value, 10) || 1);
  else if (field === 'monthlyDeposit') g.monthlyDeposit = parseFloat(e.target.value) || 0;
  else if (field === 'payoutStart') {
    g.payoutStart = parseFloat(e.target.value) || 0;
    g.payoutSchedule = flatPayoutSchedule(g.payoutStart, g.durationMonths);
  }
  else if (field === 'payoutMonth') {
    var idx = parseInt(e.target.getAttribute('data-idx'), 10);
    if (!isNaN(idx)) g.payoutSchedule[idx] = parseFloat(e.target.value) || 0;
  }
  else if (field === 'draftMemberName') g.draftMemberName = e.target.value;
  render(); // render() itself preserves focus/caret on the field being typed in
});

// A winner's payout amount is already-persisted Firestore data, not local
// draft state — commit on 'change' (blur/Enter) rather than on every
// keystroke like the draft fields above, so it doesn't write on each digit.
document.addEventListener('change', function (e) {
  var mid = e.target.getAttribute && e.target.getAttribute('data-winner-amount');
  if (!mid) return;
  setWinnerAmount(mid, parseFloat(e.target.value) || 0);
});
