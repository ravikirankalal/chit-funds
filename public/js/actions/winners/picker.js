import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../../firebase.js';
import { state, groupsById, monthsCache, monthKey } from '../../store.js';
import { isSuper } from '../../helpers.js';
import { getMonthWinners } from '../../finance/shared.js';
import { pushNav } from '../../router.js';
import { render } from '../../render.js';
import { setBusy } from '../shared.js';

export function openWinnerPicker() {
  if (isSuper()) return;
  var group = groupsById.get(state.activeGroupId);
  if (state.viewMonth > group.currentMonth) return; // any current-or-past month is fair game, just not a not-yet-open one
  state.ui.showWinnerPicker = true; render();
  pushNav();
}
export function closeWinnerPicker() { state.ui.winnerPickerConfirm = null; history.back(); }

// Tapping a name in the list used to call addWinner() immediately —
// one tap, no way back if it was the wrong row. This just shows a confirm
// step (renderWinnerPickerOverlay) with the name/BC/month/amount spelled
// out; the actual Firestore write still only happens from confirmAddWinner
// below. In-place, not its own history entry — see winnerPickerConfirm in
// store.js.
export function selectWinnerCandidate(memberId) { state.ui.winnerPickerConfirm = memberId; render(); }
export function cancelWinnerCandidate() { state.ui.winnerPickerConfirm = null; render(); }

// Once any admin has recorded a real contribution toward THIS winner's
// payout, THIS winner locks — removing them once money has already started
// moving toward them would leave that paidByA/paidByB pointing at nothing.
// Scoped to the one winner rather than the whole month: with more than one
// winner (see getMonthWinners in finance/shared.js), a payout already in
// progress for one shouldn't block adding a brand-new winner or removing a
// different, not-yet-started one.
function winnerLocked(w) {
  return !!w && ((w.paidByA || 0) > 0 || (w.paidByB || 0) > 0);
}

// Almost every month has exactly one winner, but admins occasionally pay
// out to more than one member within the same month (most often when
// group.durationMonths < members.length) — so winners are a list, appended
// to rather than replaced. See getMonthWinners in finance/shared.js. Adding a new
// winner never conflicts with an existing one's payout, so there's nothing
// to lock here.
export async function addWinner(memberId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  var monthDoc = monthsCache.get(monthKey(gid, m));
  var scheduled = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
  var current = getMonthWinners(monthDoc, scheduled);
  if (current.some(function (w) { return w.memberId === memberId; })) { state.ui.showWinnerPicker = false; state.ui.winnerPickerConfirm = null; render(); history.back(); return; }
  // Migrating off the legacy single-winnerId field (monthDoc.winners
  // doesn't exist yet) loses monthDoc.payoutAdmin's meaning the moment a
  // real winners array is written — finance/monthFinances.js's
  // getWinnerPaid only honors payoutAdmin while monthDoc.winners is still
  // absent, so it can tell "old data" apart from a genuinely-unpaid entry
  // in a real array. Stamp the synthesized winner(s) with their historical
  // paidByA/paidByB now, before adding the brand-new (actually unpaid) one,
  // so a month that was already closed doesn't retroactively look unpaid.
  if (!(monthDoc && monthDoc.winners) && monthDoc && monthDoc.status === 'closed' && monthDoc.payoutAdmin) {
    current = current.map(function (w) {
      return monthDoc.payoutAdmin === 'A'
        ? { memberId: w.memberId, payoutAmount: w.payoutAmount, paidByA: w.payoutAmount || 0, paidByB: 0 }
        : { memberId: w.memberId, payoutAmount: w.payoutAmount, paidByA: 0, paidByB: w.payoutAmount || 0 };
    });
  }
  setBusy(true);
  try {
    await updateDoc(doc(db, 'groups', gid, 'months', String(m)), { winners: current.concat([{ memberId: memberId, payoutAmount: scheduled }]) });
    state.ui.showWinnerPicker = false;
    state.ui.winnerPickerConfirm = null;
    history.back(); // see payments.js's savePaymentModal()
  } catch (err) { alert('Could not add winner: ' + err.message); }
  finally { setBusy(false); }
}

export async function removeWinner(memberId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  var monthDoc = monthsCache.get(monthKey(gid, m));
  // No blanket "month closed" block: a winner added via addWinner AFTER
  // close (see its own comment above) starts genuinely unpaid, and an
  // admin catching a mistaken addition should be able to remove them the
  // same as any other not-yet-started winner. winnerLocked below is what
  // actually protects a payout in progress, closed month or not.
  var scheduled = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
  var current = getMonthWinners(monthDoc, scheduled);
  var target = current.find(function (w) { return w.memberId === memberId; });
  if (winnerLocked(target)) return; // locked once a payout contribution has been recorded for THIS winner
  var updated = current.filter(function (w) { return w.memberId !== memberId; });
  if (updated.length === current.length) return;
  setBusy(true);
  updateDoc(doc(db, 'groups', gid, 'months', String(m)), { winners: updated })
    .catch(function (err) { alert('Could not remove winner: ' + err.message); })
    .finally(function () { setBusy(false); });
}
