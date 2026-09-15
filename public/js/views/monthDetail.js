import { ADMINS } from '../../firebase-config.js';
import { state, groupsById, membersByGroup, paymentsCache, monthsCache, transferReqCache, closeReqCache, handoffReqCache, monthKey } from '../store.js';
import { fmt, escapeHtml, initialsOf, colorFor, adminName, adminDot, isSuper, monthLabel, formatDateTime, otherAdmin } from '../helpers.js';
import { monthFinances } from '../finance.js';
import {
  iconChevronLeft, iconCheck, iconClose,
  iconTrophy, iconWallet, iconWarningTriangle, iconClock, iconCash, iconCard, iconTransfer, iconCalendar
} from '../icons.js';
import { bar, skeletonListRow } from '../skeleton.js';

function signed(n) { return (n < 0 ? '−' : '') + fmt(Math.abs(n)); }

// Matches the real layout's rhythm — topbar with a status-pill chip, a tall
// summary card (renderOpenSummary/renderClosedSummary), a "Member payments"
// section label + list, then another card (winner/payout) — rather than the
// shared skeletonTopbar() + one plain block this used to reuse, which was
// noticeably shorter and flatter than what actually loads in.
function renderMonthDetailSkeleton() {
  var rows = [0, 1, 2].map(function () { return skeletonListRow(); }).join('');
  return '<div class="screen">' +
    '<div class="topbar">' +
      '<div class="back" data-action="nav-back">' + iconChevronLeft() + '</div>' +
      '<div style="flex:1 1 auto;display:flex;flex-direction:column;gap:6px;">' + bar('150px', '15px') + bar('180px', '11px', 'margin-top:1px;') + '</div>' +
      bar('60px', '22px', 'border-radius:8px;flex-shrink:0;') +
    '</div>' +
    '<div class="content">' +
      bar('100%', '140px', 'border-radius:14px;') +
      bar('140px', '13px', 'margin:4px 0 -2px;') +
      '<div class="row-list">' + rows + '</div>' +
      bar('100%', '90px', 'border-radius:14px;') +
    '</div>' +
  '</div>';
}

export function renderMonthDetail() {
  var gid = state.activeGroupId, viewMonth = state.viewMonth;
  var group = groupsById.get(gid);
  if (!group) return state.groupsLoaded ? '<div class="content"><div class="card">Group not found.</div></div>' : renderMonthDetailSkeleton();
  var readOnly = isSuper();
  var members = membersByGroup.get(gid) || [];
  var f = monthFinances(gid, group, viewMonth);
  var isClosed = f.closed;
  var isOpen = viewMonth === group.currentMonth && !isClosed;
  var isUpcoming = viewMonth > group.currentMonth;
  // A pending close request means someone already proposed closing this
  // (still-open) month and it's waiting on the other admin — see
  // proposeCloseMonth/acceptCloseRequest in actions.js. Winner/amount
  // editing locks while this is pending (see renderWinnerCard below).
  var closeReq = isOpen ? closeReqCache.get(monthKey(gid, viewMonth)) : null;

  // Gold matches the payout-approval color used on the dashboard and group
  // detail's pending-close row — a pending close is a payout awaiting
  // acceptance, so this status pill uses the same accent.
  var statusLabel = isClosed ? 'Closed' : (closeReq ? 'Pending close' : (isOpen ? 'Open' : 'Upcoming'));
  var statusBg = isClosed ? 'var(--color-success-soft)' : (closeReq ? 'var(--color-gold-soft)' : (isOpen ? 'var(--color-secondary)' : 'var(--color-border)'));
  var statusColor = isClosed ? 'var(--color-success)' : (closeReq ? 'var(--color-gold)' : (isOpen ? 'var(--on-brand)' : 'var(--color-text-faint)'));
  var statusIcon = isClosed ? iconCheck(statusColor) : (closeReq ? iconClock(statusColor) : (isUpcoming ? iconClock(statusColor) : ''));

  var html = '<div class="screen">' +
    '<div class="topbar">' +
      '<div class="back" data-action="nav-back">' + iconChevronLeft() + '</div>' +
      '<div style="flex:1 1 auto;"><div class="title">' + iconCalendar('var(--color-primary)', 18) + monthLabel(group.startYear, group.startMonthIndex, viewMonth) + '</div><div class="subtitle">' + escapeHtml(group.name) + ' · Month ' + viewMonth + ' of ' + group.durationMonths + '</div></div>' +
      '<div style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:5px 10px;border-radius:8px;background:' + statusBg + ';color:' + statusColor + ';">' + statusIcon + statusLabel + '</div>' +
    '</div>' +
    '<div class="content">';

  if (isOpen || isClosed) html += renderHandoffRequests(gid, viewMonth, readOnly);

  if (isClosed) {
    html += renderClosedSummary(f, members, readOnly, gid, viewMonth);
  } else if (isUpcoming) {
    html += renderUpcomingNotice(group, viewMonth);
  } else if (isOpen) {
    html += renderOpenSummary(f, members, group, readOnly, gid, viewMonth);
  }

  if (isOpen || isClosed) {
    html += renderPaymentList(gid, viewMonth, members, f, readOnly, group, isOpen || isClosed);
  }

  if (isOpen) {
    html += renderWinnerCard(f, members, readOnly, !!closeReq);
    if (!readOnly) html += renderPayoutCard(f, closeReq);
  }

  html += '</div>';

  if (state.ui.showWinnerPicker) html += renderWinnerPickerOverlay(gid, group, f, members);
  if (state.ui.paymentModal) html += renderPaymentModalOverlay(gid, viewMonth, group, members);
  if (state.ui.transferSelection) html += renderTransferBar(gid, viewMonth, group);

  return html;
}

function timelineRow(dotColor, title, status, statusStyle, amount) {
  return '<div style="display:flex;align-items:flex-start;gap:10px;">' +
    '<div style="width:8px;height:8px;border-radius:4px;background:' + dotColor + ';margin-top:5px;flex-shrink:0;"></div>' +
    '<div style="flex:1 1 auto;"><div style="font-size:12.5px;font-weight:500;">' + title + '</div>' +
    '<div style="font-size:11px;' + statusStyle + '">' + status + (amount ? ' · ' + amount : '') + '</div></div></div>';
}

// One bar per member — green/full for paid, red/short for unpaid — a
// visual index into the "X / Y paid" count above, since the count alone
// doesn't say WHICH members are still outstanding without opening the
// payment list below. Mirrors the collection-trend sparkline on the group
// detail screen (public/js/views/groupDetail.js), but the per-item value
// here is binary (paid/unpaid) rather than a percentage. Each bar reuses
// the existing 'open-payment-modal' action so tapping one jumps straight
// to that member, same as tapping their row in the payment list.
function renderMemberPaymentStrip(gid, viewMonth, members, readOnly) {
  if (!members.length) return '';
  var payments = paymentsCache.get(monthKey(gid, viewMonth)) || {};
  var bars = members.map(function (mm) {
    var p = payments[mm.id];
    var paid = !!(p && p.paid);
    var color = paid ? 'var(--color-success)' : 'var(--color-danger)';
    var clickable = !readOnly;
    return '<div' + (clickable ? ' data-action="open-payment-modal" data-mid="' + mm.id + '"' : '') +
      ' title="' + escapeHtml(mm.name) + ': ' + (paid ? 'Paid' : 'Unpaid') + '"' +
      ' style="flex:1 1 0;min-width:2px;height:20px;display:flex;align-items:flex-end;' + (clickable ? 'cursor:pointer;' : '') + '">' +
      '<div style="width:100%;height:' + (paid ? 20 : 6) + 'px;background:' + color + ';border-radius:2px;"></div>' +
    '</div>';
  }).join('');
  return '<div>' +
    '<div style="font-size:11px;color:var(--color-text-muted);margin-bottom:4px;">Who\'s paid</div>' +
    '<div style="display:flex;align-items:flex-end;gap:2px;">' + bars + '</div>' +
  '</div>';
}

// Pending hand-offs (see confirmTransfer/acceptHandoffRequest in
// actions.js) for this month — shown above the collection summary in both
// open and closed months, since a late hand-off can still be proposed
// after close (same as the transfer bar itself allows). More than one can
// be pending at once, each independent, so each gets its own card and its
// own accept/decline/cancel target via data-req-id.
function renderHandoffRequests(gid, viewMonth, readOnly) {
  var reqs = handoffReqCache.get(monthKey(gid, viewMonth)) || {};
  var ids = Object.keys(reqs);
  if (!ids.length) return '';
  return ids.map(function (id) {
    var req = reqs[id];
    var iSent = req.from === state.currentAdmin;
    var count = (req.mids || []).length;
    var title = readOnly ? 'Transfer pending' : (iSent ? 'Transfer pending acceptance' : 'Transfer needs your acceptance');
    return '<div class="banner info">' +
      '<div class="banner-title">' + iconTransfer('var(--color-secondary)') + title + '</div>' +
      '<div style="font-size:12.5px;color:var(--color-text-muted);">' + adminName(req.from) + ' → ' + adminName(req.to) + ' · ' + count + ' payment' + (count === 1 ? '' : 's') + ' · <span class="mono" style="font-weight:700;color:var(--color-text);">' + fmt(req.amount) + '</span></div>' +
      (readOnly ? '' : iSent
        ? '<button class="btn btn-danger-soft" style="width:100%;" data-action="cancel-handoff-request" data-req-id="' + id + '">Cancel</button>'
        : '<div style="display:flex;gap:8px;">' +
            '<button class="btn btn-danger-soft" style="flex:1 1 0;" data-action="decline-handoff-request" data-req-id="' + id + '">Decline</button>' +
            '<button class="btn btn-primary" style="flex:1 1 0;" data-action="accept-handoff-request" data-req-id="' + id + '">Accept</button>' +
          '</div>') +
    '</div>';
  }).join('');
}

function renderClosedSummary(f, members, readOnly, gid, viewMonth) {
  var unpaidCount = members.length - f.paidCount;
  // Almost always exactly one winner — this loop renders identically to the
  // old single-card layout in that case. A closed month occasionally has
  // more than one (see getMonthWinners in finance.js), each with its own
  // payout amount. A closed month isn't frozen — an admin can still add a
  // winner they missed, same as late payments are still editable post-close.
  var winnerCards = f.winners.map(function (w) {
    var winner = members.find(function (mm) { return mm.id === w.memberId; });
    var winnerIdx = winner ? members.indexOf(winner) : -1;
    return '<div class="card" style="display:flex;align-items:center;gap:12px;position:relative;overflow:hidden;">' +
      '<div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--color-gold);"></div>' +
      (winner ? '<div class="avatar" style="background:' + colorFor(winnerIdx) + ';box-shadow:0 0 0 2px var(--color-surface),0 0 0 3.5px var(--color-gold);">' + initialsOf(winner.name) + '</div>' : '') +
      '<div style="flex:1 1 auto; min-width:0;">' +
        '<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--color-gold);font-weight:600;">' + iconTrophy('var(--color-gold)') + (f.winners.length > 1 ? 'Winner' : 'This month\'s winner') + '</div>' +
        '<div style="font-size:16px;font-weight:700;">' + (winner ? escapeHtml(winner.name) : '—') + '</div>' +
      '</div>' +
      '<div style="text-align:right; flex-shrink:0;">' +
        '<div style="font-size:11px;color:var(--color-text-muted);">Payout</div>' +
        '<div class="mono" style="font-size:18px;font-weight:700;color:var(--color-gold);">' + fmt(w.payoutAmount) + '</div>' +
      '</div>' +
    '</div>';
  }).join('') || '<div class="card" style="color:var(--color-text-muted);font-size:13px;text-align:center;">No winner recorded.</div>';

  return '<div style="display:flex;flex-direction:column;gap:10px;">' +
    (unpaidCount > 0
      ? '<div class="banner warn"><div class="banner-title">' + iconWarningTriangle('var(--color-warning)') + unpaidCount + ' member' + (unpaidCount === 1 ? '' : 's') + ' still unpaid</div>' +
        '<div style="font-size:12.5px;color:var(--color-text-muted);">This month is closed but dues are outstanding — tap an unpaid member below to record their payment.</div></div>'
      : '') +
    winnerCards +
    (readOnly ? '' : '<button class="btn btn-primary" style="width:100%;" data-action="open-winner-picker">Add another winner</button>') +
    '<div class="card">' + renderMemberPaymentStrip(gid, viewMonth, members, readOnly) + '</div>' +
    '<div class="card" style="display:flex;justify-content:space-between;align-items:center;">' +
      '<div><div style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--color-text-muted);">' + iconWallet() + 'Collected</div><div class="mono" style="font-size:16px;font-weight:700;color:var(--color-success);">' + fmt(f.totalCollected) + '</div></div>' +
      '<div style="text-align:right;"><div style="font-size:12px;color:var(--color-text-muted);">Paid out by</div><div style="font-size:14px;font-weight:700;">' + adminName(f.monthDoc.payoutAdmin) + '</div></div>' +
    '</div>' +
    '<div class="stat-row">' +
      '<div class="stat"><div class="label">' + adminDot('A') + ADMINS.A.name + ' holds</div><div class="value" style="' + (f.finalA < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(f.finalA) + '</div></div>' +
      '<div class="stat"><div class="label">' + adminDot('B') + ADMINS.B.name + ' holds</div><div class="value" style="' + (f.finalB < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(f.finalB) + '</div></div>' +
    '</div>' +
    '<div style="display:flex;align-items:center;justify-content:center;gap:4px;font-size:11px;color:var(--color-text-muted);">' + iconCheck('var(--color-text-muted)') + 'Closed ' + escapeHtml(f.monthDoc.closedLabel || '') + '</div>' +
  '</div>';
}

function renderUpcomingNotice(group, viewMonth) {
  return '<div class="banner warn"><div class="banner-title">' + iconClock('var(--color-warning)') + 'Not yet open</div>' +
    '<div style="font-size:12.5px;color:var(--color-text-muted);">Opens once ' + monthLabel(group.startYear, group.startMonthIndex, viewMonth - 1) + ' is closed. Scheduled payout: ' + fmt((group.payoutSchedule && group.payoutSchedule[viewMonth - 1]) || 0) + '.</div></div>';
}

function renderOpenSummary(f, members, group, readOnly, gid, viewMonth) {
  var expected = members.length * group.monthlyDeposit;
  var pct = expected > 0 ? Math.min(100, Math.round((f.totalCollected / expected) * 100)) : 0;
  return '<div class="card" style="display:flex;flex-direction:column;gap:10px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;">' +
      '<div><div style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--color-text-muted);">' + iconWallet() + 'Collected</div><div class="mono" style="font-size:16px;font-weight:700;">' + fmt(f.totalCollected) + ' <span style="font-size:12px;color:var(--color-text-muted);font-weight:400;">/ ' + fmt(expected) + '</span></div></div>' +
      '<div style="text-align:right;"><div style="display:flex;align-items:center;justify-content:flex-end;gap:4px;font-size:12px;color:var(--color-text-muted);">' + iconTrophy() + (f.winners.length ? 'Payout' : 'Scheduled payout') + '</div><div class="mono" style="font-size:16px;font-weight:700;color:var(--color-accent);">' + fmt(f.payoutAmount) + '</div></div>' +
    '</div>' +
    '<div>' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><div style="font-size:11px;color:var(--color-text-muted);">' + f.paidCount + ' / ' + members.length + ' paid</div><div style="font-size:11px;color:var(--color-text-muted);font-weight:600;">' + pct + '%</div></div>' +
      '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;"></div></div>' +
    '</div>' +
    renderMemberPaymentStrip(gid, viewMonth, members, readOnly) +
    '<div class="stat-row">' +
      '<div class="stat"><div class="label">' + adminDot('A') + ADMINS.A.name + ' holds</div><div class="value" style="' + (f.adjA < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(f.adjA) + '</div></div>' +
      '<div class="stat"><div class="label">' + adminDot('B') + ADMINS.B.name + ' holds</div><div class="value" style="' + (f.adjB < 0 ? 'color:var(--color-danger);' : '') + '">' + signed(f.adjB) + '</div></div>' +
    '</div>' +
  '</div>';
}

function paymentRow(r, readOnly, transferable, pending) {
  var paidAtLabel = formatDateTime(r.paidAt);
  var subtitle = r.paid
    ? 'Collected by <span style="font-weight:600;color:var(--color-success);">' + adminName(r.collectedBy) + '</span> · ' + (r.mode === 'online' ? 'Online' : 'Cash') + (paidAtLabel ? ' · ' + paidAtLabel : '') + (r.transferred ? ' · <span style="display:inline-flex;align-items:center;gap:3px;color:var(--color-secondary);">' + iconTransfer('var(--color-secondary)') + 'Transferred</span>' : '') + (pending ? ' · <span style="font-weight:600;color:var(--color-secondary);">Pending transfer</span>' : '')
    : '<span style="color:var(--color-danger);">Not paid yet' + (readOnly ? '' : ' · tap to record') + '</span>';
  var selection = state.ui.transferSelection;
  var canTransfer = transferable && r.paid && !readOnly && !pending;
  var selected = canTransfer && selection && selection.mids.indexOf(r.mm.id) !== -1;
  var showCheckbox = canTransfer && !!selection;
  return '<div class="list-row" style="' + (selected ? 'border-color:var(--color-secondary);background:var(--color-secondary-soft);' : '') + (canTransfer ? 'user-select:none;' : '') + '" ' +
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
// a not-yet-open future month. See togglePaymentSelection in actions.js.
function renderPaymentList(gid, viewMonth, members, f, readOnly, group, canTransfer) {
  var payments = paymentsCache.get(monthKey(gid, viewMonth)) || {};
  var handoffReqs = handoffReqCache.get(monthKey(gid, viewMonth)) || {};
  var pendingMids = {};
  Object.keys(handoffReqs).forEach(function (id) { (handoffReqs[id].mids || []).forEach(function (mid) { pendingMids[mid] = true; }); });
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
    { key: firstKey, label: adminName(firstKey), rows: firstRows, amount: firstAmount, amountColor: 'var(--color-success)', transferable: canTransfer },
    { key: secondKey, label: adminName(secondKey), rows: secondRows, amount: secondAmount, amountColor: 'var(--color-success)', transferable: false }
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

// Almost always exactly one winner; occasionally an admin adds more than
// one within the same month (see getMonthWinners in finance.js), each with
// its own editable payout amount. "Remove" + "Add another winner" covers
// what used to be a single "Change" link.
function renderWinnerCard(f, members, readOnly, locked) {
  var editable = !readOnly && !locked;
  var html = '<div class="card" style="display:flex;flex-direction:column;gap:10px;">' +
    '<div style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:600;">' + iconTrophy() + (f.winners.length > 1 ? 'This month\'s winners' : 'This month\'s winner') + '</div>';
  if (f.winners.length) {
    html += f.winners.map(function (w) {
      var winner = members.find(function (mm) { return mm.id === w.memberId; });
      var widx = winner ? members.indexOf(winner) : -1;
      return '<div class="list-row" style="border-left:3px solid var(--color-gold);cursor:default;">' +
        '<div class="avatar sm" style="background:' + colorFor(widx) + ';box-shadow:0 0 0 2px var(--color-surface),0 0 0 3px var(--color-gold);">' + (winner ? initialsOf(winner.name) : '?') + '</div>' +
        '<div style="flex:1 1 auto;font-size:13px;font-weight:600;color:var(--color-gold);min-width:0;">' + (winner ? escapeHtml(winner.name) : '—') + '</div>' +
        (editable
          ? '<input data-winner-amount="' + w.memberId + '" type="text" inputmode="numeric" value="' + w.payoutAmount + '" style="width:100px;text-align:right;font-size:13px;font-weight:600;padding:6px 8px;border-radius:10px;border:1px solid var(--color-border);" />' +
            '<div data-action="remove-winner" data-mid="' + w.memberId + '" style="cursor:pointer;color:var(--color-danger);font-size:12px;font-weight:600;margin-left:10px;">Remove</div>'
          : '<div class="mono" style="font-size:13px;font-weight:700;color:var(--color-gold);">' + fmt(w.payoutAmount) + '</div>') +
      '</div>';
    }).join('');
  } else if (readOnly) {
    html += '<div style="font-size:12.5px;color:var(--color-text-muted);">No winner selected yet.</div>';
  }
  if (editable) {
    html += '<button class="btn btn-primary" style="width:100%;" data-action="open-winner-picker">' + (f.winners.length ? 'Add another winner' : 'Select Winner') + '</button>';
  } else if (locked) {
    html += '<div style="font-size:11.5px;color:var(--color-text-muted);text-align:center;">Locked while the close is pending approval.</div>';
  }
  html += '</div>';
  return html;
}

function renderPayoutCard(f, closeReq) {
  var req = transferReqCache.get(monthKey(state.activeGroupId, state.viewMonth));

  if (closeReq) {
    var iProposed = closeReq.proposedBy === state.currentAdmin;
    return '<div class="card" style="display:flex;flex-direction:column;gap:12px;">' +
      '<div style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:600;">' + iconWallet() + 'Record payout</div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;">' +
        '<div style="font-size:12px;color:var(--color-text-muted);">Payout</div>' +
        '<div class="mono" style="font-size:16px;font-weight:700;color:var(--color-gold);">' + fmt(f.payoutAmount) + '</div>' +
      '</div>' +
      (iProposed
        ? '<div style="display:flex;align-items:center;gap:4px;font-size:11.5px;color:var(--color-gold);">' + iconClock('var(--color-gold)') + 'Waiting for ' + adminName(otherAdmin(state.currentAdmin)) + ' to accept.</div>' +
          '<button class="btn btn-danger-soft" style="width:100%;" data-action="cancel-close-request">Cancel request</button>'
        : '<div style="font-size:11.5px;color:var(--color-text-muted);">' + adminName(closeReq.proposedBy) + ' wants to close this month and pay out the amount above.</div>' +
          '<div style="display:flex;gap:8px;">' +
            '<button class="btn btn-danger-soft" style="flex:1 1 0;" data-action="reject-close-request">Reject</button>' +
            '<button class="btn btn-primary" style="flex:1 1 0;background:var(--color-gold);" data-action="accept-close-request">Accept</button>' +
          '</div>') +
    '</div>';
  }

  var canClose = f.winners.length && !req;
  return '<div class="card" style="display:flex;flex-direction:column;gap:12px;">' +
    '<div style="display:flex;align-items:center;gap:5px;font-size:13px;font-weight:600;">' + iconWallet() + 'Record payout</div>' +
    (req ? '<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--color-warning);">' + iconWarningTriangle('var(--color-warning)') + 'Resolve the pending transfer request above before closing this month.</div>' : '') +
    '<button class="btn btn-primary ' + (canClose ? '' : 'disabled') + '" style="width:100%; background:' + (canClose ? 'var(--color-accent)' : 'var(--color-disabled)') + ';" data-action="propose-close-month">Close Month &amp; Pay ' + fmt(f.payoutAmount) + '</button>' +
    (f.winners.length ? '<div style="font-size:11px;color:var(--color-text-muted);text-align:center;">' + adminName(otherAdmin(state.currentAdmin)) + ' will need to accept before this is final.</div>' : '') +
  '</div>';
}

function renderWinnerPickerOverlay(gid, group, f, members) {
  var wonIds = {};
  for (var m2 = 1; m2 <= group.durationMonths; m2++) {
    var mf = monthFinances(gid, group, m2);
    if (mf.closed) mf.winners.forEach(function (w) { wonIds[w.memberId] = true; });
  }
  f.winners.forEach(function (w) { wonIds[w.memberId] = true; }); // already added to this (still-open) month
  var eligible = members.filter(function (mm) { return !wonIds[mm.id]; });
  var winnerRows = eligible.map(function (mm) {
    var idx = members.indexOf(mm);
    return '<div class="list-row" data-action="add-winner" data-mid="' + mm.id + '">' +
      '<div class="avatar sm" style="background:' + colorFor(idx) + ';">' + initialsOf(mm.name) + '</div>' +
      '<div style="flex:1 1 auto;font-size:13px;font-weight:500;">' + escapeHtml(mm.name) + '</div>' +
    '</div>';
  }).join('') || '<div style="font-size:12.5px; color:var(--color-text-muted); text-align:center; padding:20px;">Everyone has already won this cycle.</div>';

  return '<div class="overlay"><div class="sheet">' +
    '<div class="sheet-header"><div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700;">' + iconTrophy() + 'Select this month\'s winner</div>' +
    '<div class="sheet-close" data-action="close-winner-picker">' + iconClose() + '</div></div>' +
    '<div class="sheet-body">' + winnerRows + '</div>' +
  '</div></div>';
}

function renderPaymentModalOverlay(gid, viewMonth, group, members) {
  var pm = state.ui.paymentModal;
  var pmem = members.find(function (mm) { return mm.id === pm.memberId; });
  var pidx = members.indexOf(pmem);
  var existingP = (paymentsCache.get(monthKey(gid, viewMonth)) || {})[pm.memberId];
  var holder = pm.isEditing && existingP ? existingP.collectedBy : state.currentAdmin;
  var handoffReqs = handoffReqCache.get(monthKey(gid, viewMonth)) || {};
  var pendingHandoffId = Object.keys(handoffReqs).find(function (id) { return (handoffReqs[id].mids || []).indexOf(pm.memberId) !== -1; });
  // Locked the same way once-transferred payments already were: a hand-off
  // still awaiting the other admin's acceptance can't have its mode
  // changed or be marked unpaid out from under the pending request.
  var canEditMode = !pm.isEditing || (existingP && existingP.collectedBy === state.currentAdmin && !existingP.transferred && !pendingHandoffId);
  var canMarkUnpaid = pm.isEditing && existingP && existingP.collectedBy === state.currentAdmin && !existingP.transferred && !pendingHandoffId;
  var transferHistory = '';
  if (pm.isEditing && existingP) {
    // collectedBy/transferredAt only ever reflect the CURRENT holder — the
    // full chain of hand-offs (an amount can move A->B, then later B->A
    // again) lives in transferLog, appended to on every confirmTransfer
    // (see actions.js). Its first entry's `from` is who originally
    // collected it, before any transfer happened.
    var log = existingP.transferLog || [];
    var originalCollector = log.length ? log[0].from : existingP.collectedBy;
    var rows = timelineRow('var(--color-success)', escapeHtml(pmem.name) + ' collected by ' + adminName(originalCollector),
      (existingP.mode === 'online' ? 'Online' : 'Cash'), '', formatDateTime(existingP.paidAt));
    log.forEach(function (t) {
      rows += timelineRow('var(--color-secondary)', adminName(t.from) + ' → ' + adminName(t.to), 'Transferred', 'color:var(--color-secondary);', formatDateTime(t.at));
    });
    var monthNet = (monthsCache.get(monthKey(gid, viewMonth)) || {}).transferNet || 0;
    if (monthNet) {
      rows += timelineRow('var(--color-secondary)', (monthNet > 0 ? ADMINS.A.name + ' → ' + ADMINS.B.name : ADMINS.B.name + ' → ' + ADMINS.A.name),
        'Accepted', 'color:var(--color-secondary);', fmt(Math.abs(monthNet)));
    }
    var pendingReq = transferReqCache.get(monthKey(gid, viewMonth));
    if (pendingReq) {
      rows += timelineRow('var(--color-secondary)', (pendingReq.direction === 'AtoB' ? ADMINS.A.name + ' → ' + ADMINS.B.name : ADMINS.B.name + ' → ' + ADMINS.A.name),
        'Pending acceptance', 'color:var(--color-secondary);', fmt(pendingReq.amount));
    }
    if (pendingHandoffId) {
      var pendingHandoff = handoffReqs[pendingHandoffId];
      rows += timelineRow('var(--color-secondary)', adminName(pendingHandoff.from) + ' → ' + adminName(pendingHandoff.to),
        'Pending acceptance', 'color:var(--color-secondary);', fmt(group.monthlyDeposit));
    }
    transferHistory = '<div><div style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--color-text-muted);margin-bottom:8px;">' + iconTransfer() + 'Transfer history</div><div style="display:flex;flex-direction:column;gap:10px;">' + rows + '</div></div>';
  }

  return '<div class="overlay"><div class="sheet">' +
    '<div class="sheet-header">' +
      '<div class="avatar sm" style="background:' + colorFor(pidx) + ';">' + initialsOf(pmem.name) + '</div>' +
      '<div style="flex:1 1 auto;min-width:0;"><div style="font-size:14px;font-weight:700;">' + escapeHtml(pmem.name) + '</div>' +
      '<div style="font-size:11.5px;color:var(--color-text-muted);">' + monthLabel(group.startYear, group.startMonthIndex, viewMonth) + ' · ' + fmt(group.monthlyDeposit) + ' · collected by ' + adminName(holder) + '</div></div>' +
      '<div class="sheet-close" data-action="close-payment-modal">' + iconClose() + '</div>' +
    '</div>' +
    '<div class="sheet-body">' +
      '<div style="text-align:center;padding:8px 0 4px;">' +
        '<div style="font-size:11px;color:var(--color-text-muted);margin-bottom:2px;">Amount</div>' +
        '<div class="mono" style="font-size:32px;font-weight:700;">' + fmt(group.monthlyDeposit) + '</div>' +
        (pm.isEditing && existingP && formatDateTime(existingP.paidAt) ? '<div style="font-size:11px;color:var(--color-text-muted);margin-top:2px;">Paid on ' + formatDateTime(existingP.paidAt) + '</div>' : '') +
      '</div>' +
      '<div><div style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:600;color:var(--color-text-muted);margin-bottom:8px;">' + iconWallet() + 'Payment mode</div>' +
      (canEditMode
        ? '<div class="pill-row">' +
            '<button class="pill ' + (pm.mode === 'cash' ? 'active' : '') + '" style="display:flex;align-items:center;justify-content:center;gap:6px;" data-action="set-modal-mode" data-mode="cash">' + iconCash() + 'Cash</button>' +
            '<button class="pill ' + (pm.mode === 'online' ? 'active' : '') + '" style="display:flex;align-items:center;justify-content:center;gap:6px;" data-action="set-modal-mode" data-mode="online">' + iconCard() + 'Online</button>' +
          '</div>'
        : '<div class="pill-row"><div class="pill active" style="pointer-events:none;display:flex;align-items:center;justify-content:center;gap:6px;">' + (pm.mode === 'online' ? iconCard() + 'Online' : iconCash() + 'Cash') + '</div></div>' +
          '<div style="font-size:11px;color:var(--color-text-muted);margin-top:6px;">' + (existingP && existingP.transferred ? 'Locked — this amount has been transferred and can no longer be edited.' : pendingHandoffId ? 'Locked — a transfer request is pending on this amount.' : 'Only ' + adminName(holder) + ' can change this.') + '</div>'
      ) + '</div>' +
      transferHistory +
      (canMarkUnpaid ? '<button class="btn btn-danger-soft" style="width:100%;" data-action="mark-unpaid">Mark as unpaid</button>' : '') +
      (canEditMode && (!pm.isEditing || pm.mode !== pm.originalMode) ? '<button class="btn btn-primary" style="width:100%;" data-action="save-payment">Save Payment</button>' : '') +
    '</div>' +
  '</div></div>';
}

// A floating bar, not a modal overlay — the payment list underneath must
// stay tappable so more entries can be added to the selection. Long-press
// starts it; a plain tap on another eligible row (see the
// 'open-payment-modal' case in events.js) adds or removes it.
function renderTransferBar(gid, viewMonth, group) {
  var sel = state.ui.transferSelection;
  var payments = paymentsCache.get(monthKey(gid, viewMonth)) || {};
  var mids = sel.mids.filter(function (mid) { return payments[mid] && payments[mid].paid && payments[mid].collectedBy === state.currentAdmin; });
  if (!mids.length) return '';
  var target = otherAdmin(state.currentAdmin);
  var total = mids.length * group.monthlyDeposit;
  return '<div style="position:fixed;left:0;right:0;bottom:0;z-index:25;display:flex;justify-content:center;">' +
    '<div style="width:100%;max-width:var(--max-width);background:var(--color-surface);border-radius:20px 20px 0 0;padding:14px 16px;display:flex;align-items:center;gap:10px;box-shadow:0 -12px 32px rgba(28,26,22,0.16), 0 -2px 6px rgba(28,26,22,0.08);">' +
      '<div style="flex:1 1 auto;min-width:0;">' +
        '<div style="font-size:11.5px;color:var(--color-text-muted);">' + mids.length + ' payment' + (mids.length === 1 ? '' : 's') + ' selected</div>' +
        '<div class="mono" style="font-size:16px;font-weight:700;">' + fmt(total) + '</div>' +
      '</div>' +
      '<div data-action="cancel-transfer-selection" style="width:32px;height:32px;border-radius:10px;background:var(--color-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + iconClose() + '</div>' +
      '<button class="btn btn-primary" style="flex-shrink:0;padding:12px 16px;white-space:nowrap;" data-action="confirm-transfer">Request transfer to ' + adminName(target) + '</button>' +
    '</div>' +
  '</div>';
}
