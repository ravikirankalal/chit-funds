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

// Whether this payment is named in some still-pending hand-off request for
// the month — used to lock editing while a transfer against it is in
// flight, same reasoning as the `transferred` lock once one actually goes
// through (see payments.js/handoffs.js).
export function isPendingHandoff(gid, m, mid) {
  var reqs = handoffReqCache.get(monthKey(gid, m)) || {};
  return Object.keys(reqs).some(function (id) { return (reqs[id].mids || []).indexOf(mid) !== -1; });
}
