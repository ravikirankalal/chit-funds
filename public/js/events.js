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
import {
  startCreateGroup, createGroupStep2, addDraftMember, removeDraftMember, submitCreateGroup,
  openCurrentMonth, openMonth, openPaymentModal, closePaymentModal, setModalMode,
  savePaymentModal, markUnpaidFromModal, openWinnerPicker, closeWinnerPicker, selectWinner,
  setPayoutAdminChoice, closeMonthAction, requestTransferToB, requestTransferToA,
  acceptTransferRequest, declineTransferRequest, cancelTransferRequest
} from './actions.js';

document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;
  var action = el.getAttribute('data-action');
  switch (action) {
    case 'signin': signInGoogle(); break;
    case 'logout': doLogout(); break;
    case 'go-dashboard': goTo('dashboard'); break;
    case 'go-ledger': goTo('ledger'); break;
    case 'nav-back': history.back(); break;
    case 'create-group': startCreateGroup(); break;
    case 'cancel-create-group': history.back(); break;
    case 'create-group-step2': createGroupStep2(); break;
    case 'create-group-back-step1': history.back(); break;
    case 'add-draft-member': addDraftMember(); break;
    case 'remove-draft-member': removeDraftMember(parseInt(el.getAttribute('data-idx'), 10)); break;
    case 'submit-create-group': submitCreateGroup(); break;
    case 'open-current-month': openCurrentMonth(el.getAttribute('data-gid')); break;
    case 'open-month': openMonth(el.getAttribute('data-gid'), parseInt(el.getAttribute('data-m'), 10)); break;
    case 'open-payment-modal': openPaymentModal(el.getAttribute('data-mid')); break;
    case 'close-payment-modal': closePaymentModal(); break;
    case 'set-modal-mode': setModalMode(el.getAttribute('data-mode')); break;
    case 'save-payment': savePaymentModal(); break;
    case 'mark-unpaid': markUnpaidFromModal(); break;
    case 'open-winner-picker': openWinnerPicker(); break;
    case 'close-winner-picker': closeWinnerPicker(); break;
    case 'select-winner': selectWinner(el.getAttribute('data-mid')); break;
    case 'set-payout-admin': setPayoutAdminChoice(el.getAttribute('data-id')); break;
    case 'close-month': closeMonthAction(); break;
    case 'request-transfer-b': requestTransferToB(); break;
    case 'request-transfer-a': requestTransferToA(); break;
    case 'accept-transfer-request': acceptTransferRequest(); break;
    case 'decline-transfer-request': declineTransferRequest(); break;
    case 'cancel-transfer-request': cancelTransferRequest(); break;
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
  if (!field || !state.ui.newGroup) return;
  var g = state.ui.newGroup;
  if (field === 'name') g.name = e.target.value;
  else if (field === 'durationMonths') g.durationMonths = Math.max(1, parseInt(e.target.value, 10) || 1);
  else if (field === 'monthlyDeposit') g.monthlyDeposit = parseFloat(e.target.value) || 0;
  else if (field === 'payoutStart') g.payoutStart = parseFloat(e.target.value) || 0;
  else if (field === 'payoutEnd') g.payoutEnd = parseFloat(e.target.value) || 0;
  else if (field === 'draftMemberName') g.draftMemberName = e.target.value;
  render(); // render() itself preserves focus/caret on the field being typed in
});
