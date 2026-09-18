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
  // Remote feature flags — kept live by listeners.js's config/app listener
  // instead of anything in firebase-config.js, since these are meant to be
  // flipped from the Firebase console without a redeploy. biometricAuthEnabled
  // defaults to off so a missing/not-yet-created config doc is never
  // accidentally "enabled"; the add* flags below default to on so the same
  // missing-doc case matches today's always-on behavior instead of silently
  // hiding those buttons before anyone has touched the doc.
  //
  // addMemberToGroupEnabled and addMemberEnabled are deliberately separate
  // flags, not one shared "add members" toggle — they gate two different
  // pages: the FAB on a single group's own Members list (add/create a
  // member for THAT group, groupMembers.js) vs. the FAB on the standalone
  // Members directory (create a brand-new person in the shared directory,
  // not tied to any group, members.js). An admin may want to freeze one
  // without freezing the other.
  //
  // admins overrides firebase-config.js's ADMINS/SUPER_ADMIN (see helpers.js's
  // adminName()) — null until the config listener delivers a real doc, or if
  // that doc has no admins field at all, in which case every id falls back to
  // firebase-config.js unchanged. IMPORTANT: this only overrides *display*
  // name/email for the app's own UI — firestore.rules hardcodes its own copy
  // of these emails as the actual security boundary (rules can't read this
  // doc's fields), so changing an email here does NOT change who Firestore
  // actually grants admin write access to; see auth.js and firebase-config.js.
  config: {
    biometricAuthEnabled: false,
    addMemberToGroupEnabled: true,
    addMemberEnabled: true,
    addGroupsEnabled: true,
    admins: null
  },
  ui: {
    showWinnerPicker: false,
    paymentModal: null,   // { memberId, mode, isEditing }
    payoutModal: null,    // { memberId } — bottom sheet for recording the current admin's own partial contribution toward a winner's payout
    newGroup: null,        // set when entering createGroup screen
    memberForm: null,      // { id, name } — add/edit overlay on the members screen
    addMemberToGroup: null, // { gid, draftName } — "add member to this group" overlay on groupDetail
    paymentTab: null, // 'unpaid' | 'A' | 'B' — which Member payments tab is active; falls back to monthDetail/paymentList.js's default when unset or the tab has no rows for the current month
    ledgerFilter: 'all', // 'all' | 'collection' | 'payout' | 'transfer' — Admin & Ledger screen's type filter
    transferSelection: null, // { mids: [] } — paid entries selected (long-press to start, tap more to add) in the logged-in admin's own section, offering to hand them all to the other admin
    profileMenuOpen: false, // dashboard header's avatar dropdown (Sign out) — a plain toggle, not pushNav()'d like the app's other overlays, since it holds no draft data worth restoring on Back/Forward
    handoffAction: null, // { reqId, action: 'accept'|'decline'|'cancel', phase: 'verifying'|'working', error } — which pending hand-off card (see renderHandoffRequests) is mid accept/decline/cancel, scoped to that one card instead of the app-wide busy overlay so other pending cards stay legible; only one at a time, same single-flight guarantee setBusy(true) gave before
    handoffOutgoingSuccess: null // { reqId, gid, m, amount } — set by the handoffRequests listener (listeners.js) when a request THIS admin SENT gets accepted on the other admin's client; mirrors handoffAction's accept-success card but for the sender's side, since handoffAction itself never leaves the accepting admin's own browser
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
