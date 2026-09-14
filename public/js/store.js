// The app's single mutable state object, plus the in-memory caches kept
// live by the Firestore listeners (see listeners.js). Everything else
// imports from here rather than owning its own copy — this is the one
// module with no dependencies on the rest of the app, so it can never be
// part of an import cycle.

export var state = {
  screen: 'loading',      // loading | login | dashboard | groupDetail | createGroup | monthDetail | ledger
  authError: null,
  currentAdmin: null,     // 'A' | 'B' | 'SUPER'
  activeGroupId: null,
  viewMonth: null,
  balances: { A: 0, B: 0, total: 0 },
  ledgerEntries: [],
  pendingApprovals: [],   // [{groupId, groupName, month, direction, amount, requestedBy}]
  busy: false,
  ui: {
    showWinnerPicker: false,
    paymentModal: null,   // { memberId, mode, isEditing }
    newGroup: null,        // set when entering createGroup screen
    memberForm: null,      // { id, name } — add/edit overlay on the members screen
    addMemberToGroup: null, // { gid, draftName } — "add member to this group" overlay on groupDetail
    collapsedPaymentSections: {} // { unpaid: bool, A: bool, B: bool } — payment list subsection collapse state
  }
};

export var groupsById = new Map();      // gid -> group data (incl. id, memberIds[])
export var membersById = new Map();     // memberId -> {id, name} — the shared, group-independent member directory
export var membersByGroup = new Map();  // gid -> [{id,name}], joined from groupsById[gid].memberIds + membersById
export var monthsCache = new Map();     // "gid|m" -> month data
export var paymentsCache = new Map();   // "gid|m" -> { memberId: paymentData }
export var transferReqCache = new Map(); // "gid|m" -> request data

export function monthKey(gid, m) { return gid + '|' + m; }

export function clearCaches() {
  groupsById.clear();
  membersById.clear();
  membersByGroup.clear();
  monthsCache.clear();
  paymentsCache.clear();
  transferReqCache.clear();
}
