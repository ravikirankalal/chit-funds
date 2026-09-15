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
  viewMemberId: null,
  balances: { A: 0, B: 0, total: 0 },
  groupsLoaded: false, // true once the groups listener has delivered its first snapshot — lets the dashboard tell "no groups yet" apart from "still loading" instead of flashing an empty state
  ledgerEntries: [],
  pendingApprovals: [],   // [{kind:'transfer'|'handoff', groupId, groupName, month, requestedBy, amount, ...}] — see recompute() in finance/ledger.js
  busy: false,
  ui: {
    showWinnerPicker: false,
    paymentModal: null,   // { memberId, mode, isEditing }
    payoutModal: null,    // { memberId } — bottom sheet for recording the current admin's own partial contribution toward a winner's payout
    newGroup: null,        // set when entering createGroup screen
    memberForm: null,      // { id, name } — add/edit overlay on the members screen
    addMemberToGroup: null, // { gid, draftName } — "add member to this group" overlay on groupDetail
    paymentTab: null, // 'unpaid' | 'A' | 'B' — which Member payments tab is active; falls back to monthDetail/paymentList.js's default when unset or the tab has no rows for the current month
    ledgerFilter: 'all', // 'all' | 'collection' | 'payout' | 'transfer' — Admin & Ledger screen's type filter
    transferSelection: null // { mids: [] } — paid entries selected (long-press to start, tap more to add) in the logged-in admin's own section, offering to hand them all to the other admin
  }
};

export var groupsById = new Map();      // gid -> group data (incl. id, memberIds[])
export var membersById = new Map();     // memberId -> {id, name} — the shared, group-independent member directory
export var membersByGroup = new Map();  // gid -> [{id,name}], joined from groupsById[gid].memberIds + membersById
export var monthsCache = new Map();     // "gid|m" -> month data
export var paymentsCache = new Map();   // "gid|m" -> { memberId: paymentData }
export var transferReqCache = new Map(); // "gid|m" -> request data — the net-balance transfer request (unchanged, separate from handoffRequests below)
export var handoffReqCache = new Map();  // "gid|m" -> { reqId: { mids[], from, to, amount, requestedBy, createdAt } } — pending hand-offs of specific already-collected payments (see confirmTransfer in actions/handoffs.js)

export function monthKey(gid, m) { return gid + '|' + m; }

export function clearCaches() {
  groupsById.clear();
  membersById.clear();
  membersByGroup.clear();
  monthsCache.clear();
  paymentsCache.clear();
  transferReqCache.clear();
  handoffReqCache.clear();
  state.groupsLoaded = false;
}
