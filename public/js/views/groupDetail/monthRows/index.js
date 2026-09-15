import { monthFinances } from '../../../finance/monthFinances.js';
import { renderClosedMonthRow } from './closedRow.js';
import { renderOpenMonthRow } from './openRow.js';
import { renderUpcomingMonthRow } from './upcomingRow.js';

// Builds the full per-month row list AND the collection-trend sparkline
// data together — every month contributes to both in the same pass, so
// splitting the two into separate loops would mean either recomputing
// monthFinances() twice per month or threading the same intermediate
// values through two functions for no benefit.
//
// Every month is listed — a full chit fund can run 20+ months, so the
// list scrolls in its own fixed-height region (see the caller's markup)
// rather than pushing the rest of the screen off-page. Each row is
// visually distinct by state — closed (solid, muted amount), open
// (accent border + live collection progress bar), or never started
// (dashed, faded) — instead of a badge color being the only cue. Each
// state's markup lives in its own sibling file; this loop just picks
// which one to call per month and collects the results.
export function renderMonthRows(gid, group, members) {
  var rows = [];
  var trend = []; // { m, pct, color } per month — feeds the stats card's collection-trend sparkline

  for (var m = 1; m <= group.durationMonths; m++) {
    var result;
    if (m <= group.currentMonth) {
      var f = monthFinances(gid, group, m);
      var monthPct = members.length > 0 ? Math.round((f.paidCount / members.length) * 100) : 0;
      result = f.closed
        ? renderClosedMonthRow(gid, group, m, f, members, monthPct)
        : renderOpenMonthRow(gid, group, m, f, members);
    } else {
      result = renderUpcomingMonthRow(gid, group, m);
    }
    rows.push(result.html);
    trend.push(result.trend);
  }

  return { rowsHtml: rows.join(''), trend: trend };
}
