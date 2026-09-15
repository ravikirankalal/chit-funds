import { state } from '../store.js';
import { goTo } from '../router.js';
import { render } from '../render.js';

// Plain screen navigation and lightweight synchronous UI toggles — nothing
// here writes to Firestore, so there's no setBusy/error-alert pattern to
// share with the other clusters.
export function openGroupDetail(gid) { goTo('groupDetail', { activeGroupId: gid }); }

export function openGroupMembers(gid) { goTo('groupMembers', { activeGroupId: gid }); }

export function openMemberPayments(gid, mid) { goTo('memberPayments', { activeGroupId: gid, viewMemberId: mid }); }

export function openMonth(gid, m) { goTo('monthDetail', { activeGroupId: gid, viewMonth: m }); }

export function selectPaymentTab(key) {
  state.ui.paymentTab = key;
  render();
}

export function setLedgerFilter(type) {
  state.ui.ledgerFilter = type;
  render();
}
