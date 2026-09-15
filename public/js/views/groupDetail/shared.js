// Small presentational helpers used by more than one section of the group
// detail screen (the stats card and the months list both show signed
// currency figures).
import { fmt } from '../../helpers.js';

export function signed(n) { return (n < 0 ? '−' : '') + fmt(Math.abs(n)); }
