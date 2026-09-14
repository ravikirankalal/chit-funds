// Entry point — wires everything together and paints the first frame.
// Module load order doesn't matter for correctness (ES modules resolve the
// whole graph before any of this runs), but reading top-to-bottom: connect
// to Firebase, wire auth (which will call goTo once the sign-in state
// resolves), wire DOM events, then paint the boot/loading screen.

import './firebase.js';
import './auth.js';
import './events.js';
import { state } from './store.js';
import { getRestorableSnapshot } from './router.js';
import { render } from './render.js';

// On a hard refresh, history.state already carries the screen we're
// restoring to (see router.js) well before auth resolves — seed it here so
// this very first render paints that screen's own skeleton (and its own
// shimmer layout) right away, instead of the generic boot skeleton that
// would otherwise show first and then get swapped out once goTo() runs for
// real in auth.js, which reads as two different loading screens in a row.
var restoreSnap = getRestorableSnapshot();
if (restoreSnap) {
  state.screen = restoreSnap.screen;
  state.activeGroupId = restoreSnap.activeGroupId;
  state.viewMonth = restoreSnap.viewMonth;
  state.viewMemberId = restoreSnap.viewMemberId;
}

render();
