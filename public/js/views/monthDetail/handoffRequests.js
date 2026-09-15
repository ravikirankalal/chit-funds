import { state, handoffReqCache, monthKey } from '../../store.js';
import { fmt, escapeHtml, adminName, adminDot } from '../../helpers.js';
import { iconTransfer } from '../../icons.js';
import { signed } from './shared.js';

// Pending hand-offs (see confirmTransfer/acceptHandoffRequest in
// actions/handoffs.js) for this month — shown above the collection summary in both
// open and closed months, since a late hand-off can still be proposed
// after close (same as the transfer bar itself allows). More than one can
// be pending at once, each independent, so each gets its own card and its
// own accept/decline/cancel target via data-req-id.
export function renderHandoffRequests(gid, viewMonth, readOnly, members, f, isClosed) {
  var reqs = handoffReqCache.get(monthKey(gid, viewMonth)) || {};
  var ids = Object.keys(reqs);
  if (!ids.length) return '';
  // Same "X holds" figures shown on the open/closed summary card above
  // (f.adjA/adjB while open, f.finalA/finalB once closed) — a hand-off
  // hasn't moved collectedBy yet (see acceptHandoffRequest in actions/handoffs.js),
  // so these are still the pre-acceptance ("before") balances.
  var holdA = isClosed ? f.finalA : f.adjA;
  var holdB = isClosed ? f.finalB : f.adjB;
  return ids.map(function (id) {
    var req = reqs[id];
    var iSent = req.from === state.currentAdmin;
    var mids = req.mids || [];
    var count = mids.length;
    // Every payment in a hand-off shares the same amount (see confirmTransfer
    // in actions/handoffs.js: amount = mids.length * group.monthlyDeposit), so
    // dividing back out is exact — no need to thread the group's
    // monthlyDeposit through just for this.
    var perAmount = count ? req.amount / count : 0;
    var title = readOnly ? 'Transfer pending' : (iSent ? 'Transfer pending acceptance' : 'Transfer needs your acceptance');
    var memberRows = mids.map(function (mid) {
      var mm = members.find(function (x) { return x.id === mid; });
      return '<div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;">' +
        '<span>' + escapeHtml(mm ? mm.name : '—') + '</span>' +
        '<span class="mono" style="font-weight:600;">' + fmt(perAmount) + '</span>' +
      '</div>';
    }).join('');
    var totalRow = count > 1
      ? '<div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:700;padding-top:6px;margin-top:2px;border-top:1px solid var(--color-border);">' +
          '<span>Total</span><span class="mono" style="color:var(--color-secondary);">' + fmt(req.amount) + '</span>' +
        '</div>'
      : '';
    var fromBefore = req.from === 'A' ? holdA : holdB, fromAfter = fromBefore - req.amount;
    var toBefore = req.to === 'A' ? holdA : holdB, toAfter = toBefore + req.amount;
    var holdingRow = '<div class="stat-row">' +
      '<div class="stat"><div class="label">' + adminDot(req.from) + adminName(req.from) + '</div><div class="value" style="' + (fromAfter < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(fromBefore) + ' <span style="color:var(--color-text-faint);font-weight:400;">→</span> ' + signed(fromAfter) + '</div></div>' +
      '<div class="stat"><div class="label">' + adminDot(req.to) + adminName(req.to) + '</div><div class="value" style="' + (toAfter < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(toBefore) + ' <span style="color:var(--color-text-faint);font-weight:400;">→</span> ' + signed(toAfter) + '</div></div>' +
    '</div>';
    return '<div class="banner info">' +
      '<div class="banner-title">' + iconTransfer('var(--color-secondary)') + title + '</div>' +
      '<div style="font-size:12.5px;color:var(--color-text-muted);">' + adminName(req.from) + ' → ' + adminName(req.to) + ' · ' + count + ' payment' + (count === 1 ? '' : 's') + '</div>' +
      '<div style="background:var(--color-surface);border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:6px;">' + memberRows + totalRow + '</div>' +
      holdingRow +
      (readOnly ? '' : iSent
        ? '<button class="btn btn-danger-soft" style="width:100%;" data-action="cancel-handoff-request" data-req-id="' + id + '">Cancel</button>'
        : '<div style="display:flex;gap:8px;">' +
            '<button class="btn btn-danger-soft" style="flex:1 1 0;" data-action="decline-handoff-request" data-req-id="' + id + '">Decline</button>' +
            '<button class="btn btn-primary" style="flex:1 1 0;" data-action="accept-handoff-request" data-req-id="' + id + '">Accept</button>' +
          '</div>') +
    '</div>';
  }).join('');
}
