import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../../firebase.js';
import { state, groupsById, monthsCache, monthKey } from '../../store.js';
import { isSuper } from '../../helpers.js';
import { getMonthWinners } from '../../finance.js';
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
export function closeWinnerPicker() { history.back(); }

// Once any admin has recorded a real contribution toward THIS winner's
// payout, THIS winner locks — changing who they are or their target amount
// after money has already started moving toward them would leave paidByA/
// paidByB pointing at the wrong thing. Scoped to the one winner rather than
// the whole month: with more than one winner (see getMonthWinners in
// finance.js), a payout already in progress for one shouldn't block adding
// a brand-new winner or editing a different, not-yet-started one.
function winnerLocked(w) {
  return !!w && ((w.paidByA || 0) > 0 || (w.paidByB || 0) > 0);
}

// Almost every month has exactly one winner, but admins occasionally pay
// out to more than one member within the same month (most often when
// group.durationMonths < members.length) — so winners are a list, appended
// to rather than replaced. See getMonthWinners in finance.js. Adding a new
// winner never conflicts with an existing one's payout, so there's nothing
// to lock here.
export async function addWinner(memberId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  var monthDoc = monthsCache.get(monthKey(gid, m));
  var scheduled = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
  var current = getMonthWinners(monthDoc, scheduled);
  if (current.some(function (w) { return w.memberId === memberId; })) { state.ui.showWinnerPicker = false; render(); history.back(); return; }
  setBusy(true);
  try {
    await updateDoc(doc(db, 'groups', gid, 'months', String(m)), { winners: current.concat([{ memberId: memberId, payoutAmount: scheduled }]) });
    state.ui.showWinnerPicker = false;
    history.back(); // see payments.js's savePaymentModal()
  } catch (err) { alert('Could not add winner: ' + err.message); }
  finally { setBusy(false); }
}

export async function removeWinner(memberId) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  var monthDoc = monthsCache.get(monthKey(gid, m));
  if (monthDoc && monthDoc.status === 'closed') return;
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

export function setWinnerAmount(memberId, amount) {
  if (isSuper()) return;
  var gid = state.activeGroupId, m = state.viewMonth;
  var group = groupsById.get(gid);
  var monthDoc = monthsCache.get(monthKey(gid, m));
  var scheduled = (group.payoutSchedule && group.payoutSchedule[m - 1]) || 0;
  var current = getMonthWinners(monthDoc, scheduled);
  var target = current.find(function (w) { return w.memberId === memberId; });
  if (winnerLocked(target)) return; // locked once a payout contribution has been recorded for THIS winner
  var updated = current.map(function (w) { return w.memberId === memberId ? { memberId: memberId, payoutAmount: amount } : w; });
  setBusy(true);
  updateDoc(doc(db, 'groups', gid, 'months', String(m)), { winners: updated })
    .catch(function (err) { alert('Could not update payout amount: ' + err.message); })
    .finally(function () { setBusy(false); });
}
