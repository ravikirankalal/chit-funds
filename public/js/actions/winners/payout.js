import { doc, updateDoc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../../firebase.js';
import { state, groupsById, monthsCache, monthKey } from '../../store.js';
import { isSuper, monthLabel, fmt } from '../../helpers.js';
import { getMonthWinners } from '../../finance/shared.js';
import { pushNav } from '../../router.js';
import { render } from '../../render.js';
import { setBusy } from '../shared.js';

export function openPayoutModal(memberId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  var monthDoc = monthsCache.get(monthKey(gid, m));
  if (monthDoc && monthDoc.status === 'closed') return;
  var scheduled = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
  var target = getMonthWinners(monthDoc, scheduled).find(function (w) { return w.memberId === memberId; });
  var myAmount = target ? ((state.currentAdmin === 'A' ? target.paidByA : target.paidByB) || 0) : 0;
  var otherAmount = target ? ((state.currentAdmin === 'A' ? target.paidByB : target.paidByA) || 0) : 0;
  var maxForMe = target ? Math.max(0, (target.payoutAmount || 0) - otherAmount) : 0;
  // draftAmount is local UI state, not yet saved — the input is state-
  // controlled (see events.js's 'payoutDraftAmount' field) so every
  // keystroke re-renders with a live before/after holdings preview,
  // committed to Firestore only on Save (setPayoutContribution below).
  // Defaults to the full remaining share on a first-time entry (most
  // admins opening this mean to cover what's left, and can dial it down
  // for a genuinely partial contribution) — but to whatever was already
  // saved when reopening to review or adjust it, so tapping Save without
  // changing anything can't silently bump a deliberate partial payment
  // up to the full remaining share.
  state.ui.payoutModal = { memberId: memberId, draftAmount: myAmount > 0 ? myAmount : maxForMe };
  render();
  pushNav();
}
export function closePayoutModal() { history.back(); }

// Each admin records only their OWN contribution toward a winner's payout —
// there's nothing for the other admin to approve, since neither can ever
// touch the other's half. Replaces the old propose/accept close-request
// flow entirely: once every winner's paidByA + paidByB reaches its
// payoutAmount, this same write closes the month, in one transaction so a
// partial-close never gets stuck half-applied.
export async function setPayoutContribution(memberId, amount) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  var monthDoc = monthsCache.get(monthKey(gid, m));
  if (!monthDoc || monthDoc.status === 'closed') return;
  var scheduled = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
  var current = getMonthWinners(monthDoc, scheduled);
  var target = current.find(function (w) { return w.memberId === memberId; });
  if (!target) return;
  var myField = state.currentAdmin === 'A' ? 'paidByA' : 'paidByB';
  var otherAmount = (state.currentAdmin === 'A' ? target.paidByB : target.paidByA) || 0;
  amount = amount || 0;
  if (amount < 0) return;
  // Reject outright rather than silently clamping — an admin who typed
  // more than what's left should see why it didn't save, not have their
  // number quietly rewritten to something else.
  if (otherAmount + amount > (target.payoutAmount || 0) + 0.01) {
    alert('That would exceed the payout total — up to ' + fmt(Math.max(0, (target.payoutAmount || 0) - otherAmount)) + ' is available for you to contribute.');
    return;
  }
  var updated = current.map(function (w) {
    if (w.memberId !== memberId) return w;
    var next = { memberId: w.memberId, payoutAmount: w.payoutAmount, paidByA: w.paidByA || 0, paidByB: w.paidByB || 0 };
    next[myField] = amount;
    return next;
  });
  var allCovered = updated.length > 0 && updated.every(function (w) {
    return (w.paidByA || 0) + (w.paidByB || 0) >= (w.payoutAmount || 0);
  });

  setBusy(true);
  try {
    if (allCovered) {
      await runTransaction(db, async function (tx) {
        var groupRef = doc(db, 'groups', gid);
        var groupSnap = await tx.get(groupRef);
        var gData = groupSnap.data();
        var nextMonth = m + 1;
        var hasNext = nextMonth <= gData.durationMonths;
        var nextRef = hasNext ? doc(db, 'groups', gid, 'months', String(nextMonth)) : null;
        var nextSnap = hasNext ? await tx.get(nextRef) : null;

        var closedLabel = monthLabel(gData.startYear, gData.startMonthIndex, m);
        tx.update(doc(db, 'groups', gid, 'months', String(m)), {
          winners: updated, status: 'closed', closedAt: serverTimestamp(), closedLabel: closedLabel
        });
        if (hasNext) {
          if (!nextSnap.exists()) {
            tx.set(nextRef, { status: 'open', winners: [], transferNet: 0, closedAt: null, closedLabel: null });
          }
          tx.update(groupRef, { currentMonth: nextMonth });
        } else {
          tx.update(groupRef, { status: 'completed' });
        }
      });
    } else {
      await updateDoc(doc(db, 'groups', gid, 'months', String(m)), { winners: updated });
    }
    state.ui.payoutModal = null;
    history.back(); // see payments.js's savePaymentModal()
  } catch (err) {
    alert('Could not record payout: ' + err.message);
  } finally { setBusy(false); }
}
