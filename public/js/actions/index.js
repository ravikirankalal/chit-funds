// Every action here either mutates `state` and re-renders, or writes to
// Firestore (Firestore writes flow back into the UI via the listeners in
// listeners.js, not by mutating local caches directly here). "Back"-style
// actions (closing an overlay, cancelling a form) call history.back()
// instead of touching state — see router.js for why.
//
// Split by concern into sibling modules — see README.md for the full
// breakdown. events.js is the only consumer, and it needs nearly every
// export across every cluster, so this file stays a plain re-export
// barrel rather than making events.js import from six different files.
export { openGroupDetail, openGroupMembers, openMemberPayments, openMonth, selectPaymentTab, setLedgerFilter } from './navigation.js';
export { startCreateGroup, createGroupStep2, addDraftMember, addExistingDraftMember, removeDraftMember, submitCreateGroup } from './groupCreation.js';
export {
  openMemberForm, closeMemberForm, saveMemberForm,
  openAddMemberToGroup, closeAddMemberToGroup, addExistingMemberToGroup, createAndAddMemberToGroup,
  removeMemberFromGroup
} from './members.js';
export {
  openPaymentModal, closePaymentModal, setModalMode,
  savePaymentModal, markUnpaidFromModal,
  togglePaymentSelection, cancelTransferSelection
} from './payments.js';
export { confirmTransfer, acceptHandoffRequest, declineHandoffRequest, cancelHandoffRequest, dismissHandoffAction, dismissHandoffOutgoingSuccess } from './handoffs.js';
export {
  openWinnerPicker, closeWinnerPicker, selectWinnerCandidate, cancelWinnerCandidate, addWinner, removeWinner,
  openPayoutModal, closePayoutModal, setPayoutContribution
} from './winners/index.js';
export {
  requestTransferToB, requestTransferToA,
  acceptTransferRequest, declineTransferRequest, cancelTransferRequest
} from './adminTransfers.js';
