import { paymentsCache, monthKey } from '../store.js';

// Whether a member has ever paid into this group — removing a member who
// already has payment history would silently orphan that history from the
// group's membership list, so removal is only offered while this is false.
export function memberHasPaidInGroup(gid, group, mid) {
  for (var m = 1; m <= group.currentMonth; m++) {
    var p = (paymentsCache.get(monthKey(gid, m)) || {})[mid];
    if (p && p.paid) return true;
  }
  return false;
}
