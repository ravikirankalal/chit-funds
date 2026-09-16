import { doc, updateDoc, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../../firebase.js';
import { state, groupsById, monthsCache, monthKey } from '../../store.js';
import { isSuper, monthLabel, fmt } from '../../helpers.js';
import { getMonthWinners } from '../../finance/shared.js';
import { pushNav } from '../../router.js';
import { render } from '../../render.js';
import { delay, SAVE_SUCCESS_DISPLAY_MS } from '../shared.js';

export function openPayoutModal(memberId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  var monthDoc = monthsCache.get(monthKey(gid, m));
  var scheduled = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
  var target = getMonthWinners(monthDoc, scheduled).find(function (w) { return w.memberId === memberId; });
  if (!target) return;
  // A closed month's payout is normally frozen — but a winner added via
  // "Add another winner" AFTER the month closed (see addWinner in
  // actions/winners/picker.js) starts genuinely unpaid and needs its own
  // payment cycle to actually start. Only a winner already fully covered
  // by the time the month closed stays locked.
  var alreadyCovered = ((target.paidByA || 0) + (target.paidByB || 0)) >= (target.payoutAmount || 0);
  if (monthDoc && monthDoc.status === 'closed' && alreadyCovered) return;
  var myAmount = ((state.currentAdmin === 'A' ? target.paidByA : target.paidByB) || 0);
  var otherAmount = ((state.currentAdmin === 'A' ? target.paidByB : target.paidByA) || 0);
  var maxForMe = Math.max(0, (target.payoutAmount || 0) - otherAmount);
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
export function closePayoutModal() {
  var pm = state.ui.payoutModal;
  // See payments.js's closePaymentModal() for why — the sheet's own close
  // button already omits data-action for this case (payout.js's
  // renderPayoutModalOverlay).
  if (pm && (pm.saveState === 'saving' || pm.saveState === 'success')) return;
  history.back();
}

// Each admin records only their OWN contribution toward a winner's payout —
// there's nothing for the other admin to approve, since neither can ever
// touch the other's half. Replaces the old propose/accept close-request
// flow entirely: once every winner's paidByA + paidByB reaches its
// payoutAmount, this same write closes the month, in one transaction so a
// partial-close never gets stuck half-applied.
export async function setPayoutContribution(memberId, amount) {
  if (isSuper()) return;
  var pm = state.ui.payoutModal;
  if (!pm || pm.saveState === 'saving') return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  var monthDoc = monthsCache.get(monthKey(gid, m));
  if (!monthDoc) return;
  var scheduled = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
  var current = getMonthWinners(monthDoc, scheduled);
  var target = current.find(function (w) { return w.memberId === memberId; });
  if (!target) return;
  var monthAlreadyClosed = monthDoc.status === 'closed';
  var alreadyCovered = ((target.paidByA || 0) + (target.paidByB || 0)) >= (target.payoutAmount || 0);
  if (monthAlreadyClosed && alreadyCovered) return; // locked once closed AND covered — see openPayoutModal
  var myField = state.currentAdmin === 'A' ? 'paidByA' : 'paidByB';
  var otherAmount = (state.currentAdmin === 'A' ? target.paidByB : target.paidByA) || 0;
  amount = amount || 0;
  if (amount < 0) return;
  // Rejected inline (pm.saveError below) rather than silently clamping —
  // an admin who typed more than what's left should see why it didn't
  // save, not have their number quietly rewritten to something else.
  if (otherAmount + amount > (target.payoutAmount || 0) + 0.01) {
    pm.saveState = 'error';
    pm.saveError = 'exceeds the payout total — up to ' + fmt(Math.max(0, (target.payoutAmount || 0) - otherAmount)) + ' is available for you to contribute';
    render();
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

  // Drives the sheet's own saving/success/error states (payout.js's
  // renderPayoutModalOverlay) instead of the app-wide busy overlay — see
  // payments.js's savePaymentModal for why (the same fix, same reasoning).
  pm.saveState = 'saving';
  pm.saveError = null;
  render();
  try {
    // The close-and-advance-to-next-month side effects only belong to the
    // ORIGINAL close — a winner added after the month was already closed
    // (see addWinner in actions/winners/picker.js) shouldn't re-trigger them
    // even once their own contribution reaches full coverage.
    if (allCovered && !monthAlreadyClosed) {
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
    pm.saveState = 'success';
    render();
    // A brief beat on the success state so it's actually seen before the
    // sheet closes itself — see payments.js's savePaymentModal.
    await delay(SAVE_SUCCESS_DISPLAY_MS);
    state.ui.payoutModal = null;
    render();
    history.back(); // see payments.js's savePaymentModal()
  } catch (err) {
    pm.saveState = 'error';
    pm.saveError = err.message;
    render();
  }
}
