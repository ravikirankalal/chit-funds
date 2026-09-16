import { state, handoffReqCache, monthKey } from '../store.js';
import { render, setBusyOverlay } from '../render.js';

// Going busy just shows a spinner over whatever's already on screen — see
// setBusyOverlay() in render.js for why that's a targeted DOM toggle rather
// than a full render() (a full render re-creates any open sheet/overlay,
// restarting its entrance animation — visible as a flash right as the
// payment drawer, member form, etc. is about to close). Coming back off
// busy DOES need the full render(): that's the point where the action's
// own state changes (a saved payment, a closed overlay) actually need to
// reach the screen, and there's no longer an open overlay for it to
// disrupt by then.
export function setBusy(v) {
  state.busy = v;
  if (v) setBusyOverlay(true);
  else render();
}


// A brief pause after a sheet's own saveState flips to 'success', so the
// checkmark is actually seen before the sheet closes itself — used by
// every sheet-scoped save flow (payments.js, actions/winners/payout.js)
// instead of each duplicating its own setTimeout/Promise plumbing.
// How long a sheet's success checkmark stays up before it closes itself —
// one shared constant so every save flow's "did that work?" beat stays in
// sync if this ever needs tuning again, rather than three separate
// hardcoded numbers drifting apart.
export var SAVE_SUCCESS_DISPLAY_MS = 1200;

export function delay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// Whether this payment is named in some still-pending hand-off request for
// the month — used to lock editing while a transfer against it is in
// flight, same reasoning as the `transferred` lock once one actually goes
// through (see payments.js/handoffs.js).
export function isPendingHandoff(gid, m, mid) {
  var reqs = handoffReqCache.get(monthKey(gid, m)) || {};
  return Object.keys(reqs).some(function (id) { return (reqs[id].mids || []).indexOf(mid) !== -1; });
}
