// Entry point — wires everything together and paints the first frame.
// Module load order doesn't matter for correctness (ES modules resolve the
// whole graph before any of this runs), but reading top-to-bottom: connect
// to Firebase, wire auth (which will call goTo once the sign-in state
// resolves), wire DOM events, then paint the boot/loading screen.

import './firebase.js';
import './auth.js';
import './events.js';
import { render } from './render.js';

render();
