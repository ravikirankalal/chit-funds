import { state, paymentsCache, handoffReqCache, monthKey } from '../../store.js';
import { fmt, escapeHtml, colorFor, initialsOf, adminName, formatDateTime } from '../../helpers.js';
import { iconCheck, iconTransfer, iconWallet } from '../../icons.js';

function paymentRow(r, readOnly, transferable, pending) {
  var paidAtLabel = formatDateTime(r.paidAt);
  var subtitle = r.paid
    ? 'Collected by <span style="font-weight:600;color:var(--color-success);">' + escapeHtml(adminName(r.collectedBy)) + '</span> · ' + (r.mode === 'online' ? 'Online' : 'Cash') + (paidAtLabel ? ' · ' + paidAtLabel : '') + (r.transferred ? ' · <span style="display:inline-flex;align-items:center;gap:3px;color:var(--color-secondary);">' + iconTransfer('var(--color-secondary)') + 'Transferred</span>' : '') + (pending ? ' · <span style="font-weight:600;color:var(--color-secondary);">Pending transfer</span>' : '')
    : '<span style="color:var(--color-danger);">Not paid yet' + (readOnly ? '' : ' · tap to record') + '</span>';
  var selection = state.ui.transferSelection;
  var canTransfer = transferable && r.paid && !readOnly && !pending;
  var selected = canTransfer && selection && selection.mids.indexOf(r.mm.id) !== -1;
  var showCheckbox = canTransfer && !!selection;
  return '<div class="list-row" style="' + (selected ? 'border-color:var(--color-secondary);background:var(--color-secondary-soft);' : '') + '" ' +
    (readOnly ? '' : 'data-action="open-payment-modal" data-mid="' + r.mm.id + '"') +
    (canTransfer ? ' data-transferable="1"' : '') + '>' +
    (showCheckbox ? '<div style="width:22px;height:22px;border-radius:11px;border:1.5px solid ' + (selected ? 'var(--color-secondary)' : 'var(--color-border-strong)') + ';background:' + (selected ? 'var(--color-secondary)' : 'transparent') + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (selected ? iconCheck('var(--on-brand)') : '') + '</div>' : '') +
    '<div class="avatar sm" style="background:' + colorFor(r.idx) + ';">' + initialsOf(r.mm.name) + '</div>' +
    '<div style="flex:1 1 auto;min-width:0;"><div style="font-size:13px;font-weight:500;">' + escapeHtml(r.mm.name) + '</div>' +
    '<div style="font-size:11px;color:var(--color-text-muted);margin-top:1px;">' + subtitle + '</div></div>' +
    '<div style="flex-shrink:0;display:flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:5px 10px;border-radius:20px;background:' + (r.paid ? 'var(--color-success-soft)' : 'var(--color-danger-soft)') + ';color:' + (r.paid ? 'var(--color-success)' : 'var(--color-danger)') + ';">' + (r.paid ? iconCheck('var(--color-success)') + 'Paid' : 'Unpaid') + '</div>' +
  '</div>';
}

function paymentTabChip(tab, active) {
  var amountColor = active ? 'var(--on-brand)' : tab.amountColor;
  return '<div data-action="select-payment-tab" data-key="' + tab.key + '" style="display:flex;align-items:center;gap:5px;cursor:pointer;flex-shrink:0;padding:8px 14px;border-radius:20px;font-size:12.5px;font-weight:600;white-space:nowrap;' +
    (active ? 'background:var(--color-primary);color:var(--on-brand);' : 'background:var(--color-surface);color:var(--color-text);border:1px solid var(--color-border);') + '">' +
    tab.label + ' (' + tab.rows.length + ') · <span style="color:' + amountColor + ';">' + fmt(tab.amount) + '</span>' +
  '</div>';
}

// Unpaid always leads; whichever admin is currently signed in gets their own
// "collected by" tab second, so each admin sees their own collections first
// without having to scan past the other admin's. Only one tab's rows render
// at a time — with ~20 members split across up to three groups, stacking all
// of them (the old accordion layout) meant scrolling past everyone already
// paid just to reach the winner/payout card below; a tab bar bounds the
// list to whichever group you're actually looking at. Only the logged-in
// admin's own tab is hold-to-transfer eligible — open or closed, so a
// late/misattributed payment can still be handed off after close, but not
// a not-yet-open future month. See togglePaymentSelection in actions/payments.js.
export function renderPaymentList(gid, viewMonth, members, f, readOnly, group, canTransfer) {
  var payments = paymentsCache.get(monthKey(gid, viewMonth)) || {};
  var handoffReqs = handoffReqCache.get(monthKey(gid, viewMonth)) || {};
  var pendingMids = {};
  // Skips a request already marked 'accepted' — same reasoning as
  // isPendingHandoff in actions/shared.js: acceptHandoffRequest leaves that
  // status on the doc for a few seconds after the transfer actually
  // completed (real deletion happens slightly later, purely so the
  // sender's own client gets a chance to notice — see handoffOutgoingSuccess
  // in listeners.js), so it's not "pending" from this list's point of view
  // even while the doc briefly still exists.
  Object.keys(handoffReqs).forEach(function (id) { if (handoffReqs[id].status !== 'accepted') (handoffReqs[id].mids || []).forEach(function (mid) { pendingMids[mid] = true; }); });
  var payRows = members.map(function (mm, idx) {
    var p = payments[mm.id] || { paid: false };
    return { mm: mm, idx: idx, paid: !!p.paid, collectedBy: p.collectedBy, mode: p.mode, paidAt: p.paidAt, transferred: !!p.transferred, pending: !!pendingMids[mm.id] };
  });

  var unpaidRows = payRows.filter(function (r) { return !r.paid; });
  var byARows = payRows.filter(function (r) { return r.paid && r.collectedBy === 'A'; });
  var byBRows = payRows.filter(function (r) { return r.paid && r.collectedBy === 'B'; });
  var unpaidAmount = unpaidRows.length * group.monthlyDeposit;

  var currentIsB = state.currentAdmin === 'B';
  var firstKey = currentIsB ? 'B' : 'A';
  var firstRows = currentIsB ? byBRows : byARows;
  var firstAmount = currentIsB ? f.rawB : f.rawA;
  var secondKey = currentIsB ? 'A' : 'B';
  var secondRows = currentIsB ? byARows : byBRows;
  var secondAmount = currentIsB ? f.rawA : f.rawB;

  // All three tabs always show, even at 0 — hiding a tab the moment it
  // empties out (e.g. "Unpaid" once everyone's paid) made the bar jump
  // around as you collected; a stable set of tabs is easier to navigate
  // than one that reflows on every save.
  var tabs = [
    { key: 'unpaid', label: 'Unpaid', rows: unpaidRows, amount: unpaidAmount, amountColor: 'var(--color-danger)', transferable: false },
    { key: firstKey, label: escapeHtml(adminName(firstKey)), rows: firstRows, amount: firstAmount, amountColor: 'var(--color-success)', transferable: canTransfer },
    { key: secondKey, label: escapeHtml(adminName(secondKey)), rows: secondRows, amount: secondAmount, amountColor: 'var(--color-success)', transferable: false }
  ];

  if (!members.length) return '<div><div class="section-label">' + iconWallet() + 'Member payments (' + f.paidCount + '/' + members.length + ')</div></div>';

  // Unpaid is the default focus mid-collection; once everyone's paid, fall
  // back to the signed-in admin's own tab.
  var defaultKey = unpaidRows.length ? 'unpaid' : firstKey;
  var activeKey = state.ui.paymentTab;
  if (!tabs.some(function (t) { return t.key === activeKey; })) activeKey = defaultKey;
  var activeTab = tabs.filter(function (t) { return t.key === activeKey; })[0];

  var body = activeTab.rows.length
    ? '<div class="row-list">' + activeTab.rows.map(function (r) { return paymentRow(r, readOnly, activeTab.transferable, r.pending); }).join('') + '</div>'
    : '<div style="text-align:center;padding:24px 0;font-size:12.5px;color:var(--color-text-muted);">Nothing here yet</div>';

  return '<div><div class="section-label">' + iconWallet() + 'Member payments (' + f.paidCount + '/' + members.length + ')</div>' +
    '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:2px;margin-bottom:10px;">' +
      tabs.map(function (t) { return paymentTabChip(t, t.key === activeKey); }).join('') +
    '</div>' +
    body +
  '</div>';
}
