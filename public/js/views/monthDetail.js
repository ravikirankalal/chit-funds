import { ADMINS } from '../../firebase-config.js';
import { state, groupsById, membersByGroup, paymentsCache, monthsCache, transferReqCache, monthKey } from '../store.js';
import { fmt, escapeHtml, initialsOf, colorFor, adminName, isSuper, monthLabel, formatDateTime, otherAdmin } from '../helpers.js';
import { monthFinances } from '../finance.js';
import { iconChevronLeft, iconChevronRight, iconCheck, iconClose } from '../icons.js';

function signed(n) { return (n < 0 ? '−' : '') + fmt(Math.abs(n)); }

export function renderMonthDetail() {
  var gid = state.activeGroupId, viewMonth = state.viewMonth;
  var group = groupsById.get(gid);
  if (!group) return '<div class="content"><div class="card">Loading…</div></div>';
  var readOnly = isSuper();
  var members = membersByGroup.get(gid) || [];
  var f = monthFinances(gid, group, viewMonth);
  var isClosed = f.closed;
  var isOpen = viewMonth === group.currentMonth && !isClosed;
  var isUpcoming = viewMonth > group.currentMonth;

  var statusLabel = isClosed ? 'Closed' : (isOpen ? 'Open' : 'Upcoming');
  var statusBg = isClosed ? '#e6f2ec' : (isOpen ? 'var(--accent)' : '#efece5');
  var statusColor = isClosed ? 'var(--accent)' : (isOpen ? '#fff' : '#a39d92');

  var html = '<div class="screen">' +
    '<div class="topbar">' +
      '<div class="back" data-action="nav-back">' + iconChevronLeft() + '</div>' +
      '<div style="flex:1 1 auto;"><div class="title">' + monthLabel(group.startYear, group.startMonthIndex, viewMonth) + '</div><div class="subtitle">' + escapeHtml(group.name) + ' · Month ' + viewMonth + ' of ' + group.durationMonths + '</div></div>' +
      '<div style="font-size:11px;font-weight:700;padding:5px 10px;border-radius:8px;background:' + statusBg + ';color:' + statusColor + ';">' + statusLabel + '</div>' +
    '</div>' +
    '<div class="content">';

  if (isClosed) {
    html += renderClosedSummary(f, members);
  } else if (isUpcoming) {
    html += renderUpcomingNotice(group, viewMonth);
  } else if (isOpen) {
    html += renderOpenSummary(f, members, group);
  }

  if (isOpen || isClosed) {
    html += renderPaymentList(gid, viewMonth, members, f, readOnly, group, isOpen || isClosed);
  }

  if (isOpen) {
    html += renderWinnerCard(f, members, readOnly);
    if (!readOnly) html += renderPayoutCard(f);
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

function renderClosedSummary(f, members) {
  var unpaidCount = members.length - f.paidCount;
  // Almost always exactly one winner — this loop renders identically to the
  // old single-card layout in that case. A closed month occasionally has
  // more than one (see getMonthWinners in finance.js), each with its own
  // payout amount.
  var winnerCards = f.winners.map(function (w) {
    var winner = members.find(function (mm) { return mm.id === w.memberId; });
    var winnerIdx = winner ? members.indexOf(winner) : -1;
    return '<div class="card" style="display:flex;align-items:center;gap:12px;background:var(--accent-soft);border-color:var(--accent);">' +
      (winner ? '<div class="avatar" style="background:' + colorFor(winnerIdx) + ';">' + initialsOf(winner.name) + '</div>' : '') +
      '<div style="flex:1 1 auto; min-width:0;">' +
        '<div style="font-size:11px;color:var(--accent);font-weight:600;">' + (f.winners.length > 1 ? 'Winner' : 'This month\'s winner') + '</div>' +
        '<div style="font-size:16px;font-weight:700;">' + (winner ? escapeHtml(winner.name) : '—') + '</div>' +
      '</div>' +
      '<div style="text-align:right; flex-shrink:0;">' +
        '<div style="font-size:11px;color:var(--text-muted);">Payout</div>' +
        '<div class="mono" style="font-size:18px;font-weight:700;color:var(--accent);">' + fmt(w.payoutAmount) + '</div>' +
      '</div>' +
    '</div>';
  }).join('') || '<div class="card" style="color:var(--text-muted);font-size:13px;text-align:center;">No winner recorded.</div>';

  return '<div style="display:flex;flex-direction:column;gap:10px;">' +
    (unpaidCount > 0
      ? '<div class="banner warn"><div class="banner-title">' + unpaidCount + ' member' + (unpaidCount === 1 ? '' : 's') + ' still unpaid</div>' +
        '<div style="font-size:12.5px;color:var(--text-muted);">This month is closed but dues are outstanding — tap an unpaid member below to record their payment.</div></div>'
      : '') +
    winnerCards +
    '<div class="card" style="display:flex;justify-content:space-between;align-items:center;">' +
      '<div><div style="font-size:12px;color:var(--text-muted);">Collected</div><div class="mono" style="font-size:16px;font-weight:700;color:#146b52;">' + fmt(f.totalCollected) + '</div></div>' +
      '<div style="text-align:right;"><div style="font-size:12px;color:var(--text-muted);">Paid out by</div><div style="font-size:14px;font-weight:700;">' + adminName(f.monthDoc.payoutAdmin) + '</div></div>' +
    '</div>' +
    '<div class="stat-row">' +
      '<div class="stat"><div class="label">' + ADMINS.A.name + ' holds</div><div class="value" style="' + (f.adjA < 0 ? 'color:var(--danger);' : '') + '">' + signed(f.adjA) + '</div></div>' +
      '<div class="stat"><div class="label">' + ADMINS.B.name + ' holds</div><div class="value" style="' + (f.adjB < 0 ? 'color:var(--danger);' : '') + '">' + signed(f.adjB) + '</div></div>' +
    '</div>' +
    '<div style="font-size:11px;color:var(--text-muted);text-align:center;">Closed ' + escapeHtml(f.monthDoc.closedLabel || '') + '</div>' +
  '</div>';
}

function renderUpcomingNotice(group, viewMonth) {
  return '<div class="banner warn"><div class="banner-title">Not yet open</div>' +
    '<div style="font-size:12.5px;color:var(--text-muted);">Opens once ' + monthLabel(group.startYear, group.startMonthIndex, viewMonth - 1) + ' is closed. Scheduled payout: ' + fmt((group.payoutSchedule && group.payoutSchedule[viewMonth - 1]) || 0) + '.</div></div>';
}

function renderOpenSummary(f, members, group) {
  var expected = members.length * group.monthlyDeposit;
  var pct = expected > 0 ? Math.min(100, Math.round((f.totalCollected / expected) * 100)) : 0;
  return '<div class="card" style="display:flex;flex-direction:column;gap:10px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;">' +
      '<div><div style="font-size:12px;color:var(--text-muted);">Collected</div><div class="mono" style="font-size:16px;font-weight:700;">' + fmt(f.totalCollected) + ' <span style="font-size:12px;color:var(--text-muted);font-weight:400;">/ ' + fmt(expected) + '</span></div></div>' +
      '<div style="text-align:right;"><div style="font-size:12px;color:var(--text-muted);">' + (f.winners.length ? 'Payout' : 'Scheduled payout') + '</div><div class="mono" style="font-size:16px;font-weight:700;color:var(--accent);">' + fmt(f.payoutAmount) + '</div></div>' +
    '</div>' +
    '<div>' +
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><div style="font-size:11px;color:var(--text-muted);">' + f.paidCount + ' / ' + members.length + ' paid</div><div style="font-size:11px;color:var(--text-muted);font-weight:600;">' + pct + '%</div></div>' +
      '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%;"></div></div>' +
    '</div>' +
    '<div class="stat-row">' +
      '<div class="stat"><div class="label">' + ADMINS.A.name + ' holds</div><div class="value" style="' + (f.adjA < 0 ? 'color:var(--danger);' : '') + '">' + signed(f.adjA) + '</div></div>' +
      '<div class="stat"><div class="label">' + ADMINS.B.name + ' holds</div><div class="value" style="' + (f.adjB < 0 ? 'color:var(--danger);' : '') + '">' + signed(f.adjB) + '</div></div>' +
    '</div>' +
  '</div>';
}

function paymentRow(r, readOnly, transferable) {
  var paidAtLabel = formatDateTime(r.paidAt);
  var subtitle = r.paid
    ? 'Collected by <span style="font-weight:600;color:var(--accent);">' + adminName(r.collectedBy) + '</span> · ' + (r.mode === 'online' ? 'Online' : 'Cash') + (paidAtLabel ? ' · ' + paidAtLabel : '') + (r.transferred ? ' · Transferred' : '')
    : '<span style="color:var(--danger);">Not paid yet' + (readOnly ? '' : ' · tap to record') + '</span>';
  var selection = state.ui.transferSelection;
  var canTransfer = transferable && r.paid && !readOnly;
  var selected = canTransfer && selection && selection.mids.indexOf(r.mm.id) !== -1;
  var showCheckbox = canTransfer && !!selection;
  return '<div class="list-row" style="' + (selected ? 'border-color:var(--accent);background:var(--accent-soft);' : '') + (canTransfer ? 'user-select:none;' : '') + '" ' +
    (readOnly ? '' : 'data-action="open-payment-modal" data-mid="' + r.mm.id + '"') +
    (canTransfer ? ' data-transferable="1"' : '') + '>' +
    (showCheckbox ? '<div style="width:22px;height:22px;border-radius:11px;border:1.5px solid ' + (selected ? 'var(--accent)' : '#d8d4cb') + ';background:' + (selected ? 'var(--accent)' : 'transparent') + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (selected ? iconCheck('#fff') : '') + '</div>' : '') +
    '<div class="avatar sm" style="background:' + colorFor(r.idx) + ';">' + initialsOf(r.mm.name) + '</div>' +
    '<div style="flex:1 1 auto;min-width:0;"><div style="font-size:13px;font-weight:500;">' + escapeHtml(r.mm.name) + '</div>' +
    '<div style="font-size:11px;color:var(--text-muted);margin-top:1px;">' + subtitle + '</div></div>' +
    '<div style="flex-shrink:0;display:flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:5px 10px;border-radius:20px;background:' + (r.paid ? 'var(--accent-soft)' : '#fbe9e7') + ';color:' + (r.paid ? 'var(--accent)' : 'var(--danger)') + ';">' + (r.paid ? iconCheck('var(--accent)') + 'Paid' : 'Unpaid') + '</div>' +
  '</div>';
}

function paymentSubsection(key, label, rows, amount, readOnly, transferable) {
  if (!rows.length) return '';
  var collapsed = !!state.ui.collapsedPaymentSections[key];
  var amountColor = key === 'unpaid' ? 'var(--danger)' : '#146b52';
  return '<div style="margin-top:14px;">' +
    '<div data-action="toggle-payment-section" data-key="' + key + '" style="display:flex;align-items:center;gap:4px;cursor:pointer;margin-bottom:6px;">' +
      '<div style="display:flex;transform:rotate(' + (collapsed ? '0' : '90') + 'deg);color:var(--text-muted);">' + iconChevronRight() + '</div>' +
      '<div style="font-size:11.5px;font-weight:600;color:var(--text-muted);">' + label + ' (' + rows.length + ') · <span style="color:' + amountColor + ';">' + fmt(amount) + '</span></div>' +
    '</div>' +
    (collapsed ? '' : '<div class="row-list">' + rows.map(function (r) { return paymentRow(r, readOnly, transferable); }).join('') + '</div>') +
  '</div>';
}

// Unpaid always leads; whichever admin is currently signed in gets their
// own "collected by" section second, so each admin sees their own
// collections first without having to scan past the other admin's.
// Collapse state is keyed by admin id (not position) so it stays stable
// regardless of which admin is currently viewing. Only the logged-in
// admin's own section is hold-to-transfer eligible — open or closed, so a
// late/misattributed payment can still be handed off after close, but not
// a not-yet-open future month. See togglePaymentSelection in actions.js.
function renderPaymentList(gid, viewMonth, members, f, readOnly, group, canTransfer) {
  var payments = paymentsCache.get(monthKey(gid, viewMonth)) || {};
  var payRows = members.map(function (mm, idx) {
    var p = payments[mm.id] || { paid: false };
    return { mm: mm, idx: idx, paid: !!p.paid, collectedBy: p.collectedBy, mode: p.mode, paidAt: p.paidAt, transferred: !!p.transferred };
  });

  var unpaidRows = payRows.filter(function (r) { return !r.paid; });
  var byARows = payRows.filter(function (r) { return r.paid && r.collectedBy === 'A'; });
  var byBRows = payRows.filter(function (r) { return r.paid && r.collectedBy === 'B'; });
  var unpaidAmount = unpaidRows.length * group.monthlyDeposit;

  var currentIsB = state.currentAdmin === 'B';
  var firstKey = currentIsB ? 'B' : 'A';
  var firstLabel = 'Collected by ' + adminName(currentIsB ? 'B' : 'A');
  var firstRows = currentIsB ? byBRows : byARows;
  var firstAmount = currentIsB ? f.rawB : f.rawA;
  var secondKey = currentIsB ? 'A' : 'B';
  var secondLabel = 'Collected by ' + adminName(currentIsB ? 'A' : 'B');
  var secondRows = currentIsB ? byARows : byBRows;
  var secondAmount = currentIsB ? f.rawA : f.rawB;

  return '<div><div class="section-label">Member payments (' + f.paidCount + '/' + members.length + ')</div>' +
    paymentSubsection('unpaid', 'Unpaid', unpaidRows, unpaidAmount, readOnly, false) +
    paymentSubsection(firstKey, firstLabel, firstRows, firstAmount, readOnly, canTransfer) +
    paymentSubsection(secondKey, secondLabel, secondRows, secondAmount, readOnly, false) +
  '</div>';
}

// Almost always exactly one winner; occasionally an admin adds more than
// one within the same month (see getMonthWinners in finance.js), each with
// its own editable payout amount. "Remove" + "Add another winner" covers
// what used to be a single "Change" link.
function renderWinnerCard(f, members, readOnly) {
  var html = '<div class="card" style="display:flex;flex-direction:column;gap:10px;">' +
    '<div style="font-size:13px;font-weight:600;">' + (f.winners.length > 1 ? 'This month\'s winners' : 'This month\'s winner') + '</div>';
  if (f.winners.length) {
    html += f.winners.map(function (w) {
      var winner = members.find(function (mm) { return mm.id === w.memberId; });
      var widx = winner ? members.indexOf(winner) : -1;
      return '<div class="list-row" style="background:var(--accent-soft);">' +
        '<div class="avatar sm" style="background:' + colorFor(widx) + ';">' + (winner ? initialsOf(winner.name) : '?') + '</div>' +
        '<div style="flex:1 1 auto;font-size:13px;font-weight:600;color:var(--accent);min-width:0;">' + (winner ? escapeHtml(winner.name) : '—') + '</div>' +
        (readOnly
          ? '<div class="mono" style="font-size:13px;font-weight:700;color:var(--accent);">' + fmt(w.payoutAmount) + '</div>'
          : '<input data-winner-amount="' + w.memberId + '" type="text" inputmode="numeric" value="' + w.payoutAmount + '" style="width:100px;text-align:right;font-size:13px;font-weight:600;padding:6px 8px;border-radius:8px;border:1px solid var(--border);" />' +
            '<div data-action="remove-winner" data-mid="' + w.memberId + '" style="cursor:pointer;color:var(--danger);font-size:12px;font-weight:600;margin-left:10px;">Remove</div>') +
      '</div>';
    }).join('');
  } else if (readOnly) {
    html += '<div style="font-size:12.5px;color:var(--text-muted);">No winner selected yet.</div>';
  }
  if (!readOnly) {
    html += '<button class="btn btn-primary" style="width:100%;" data-action="open-winner-picker">' + (f.winners.length ? 'Add another winner' : 'Select Winner') + '</button>';
  }
  html += '</div>';
  return html;
}

function renderPayoutCard(f) {
  var req = transferReqCache.get(monthKey(state.activeGroupId, state.viewMonth));
  var canClose = f.winners.length && !req;
  return '<div class="card" style="display:flex;flex-direction:column;gap:12px;">' +
    '<div style="font-size:13px;font-weight:600;">Record payout</div>' +
    (req ? '<div style="font-size:11px;color:var(--warning);">Resolve the pending transfer request above before closing this month.</div>' : '') +
    '<button class="btn btn-primary ' + (canClose ? '' : 'disabled') + '" style="width:100%; background:' + (canClose ? 'var(--accent)' : '#c7c2b8') + ';" data-action="close-month">Close Month &amp; Pay ' + fmt(f.payoutAmount) + '</button>' +
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
  }).join('') || '<div style="font-size:12.5px; color:var(--text-muted); text-align:center; padding:20px;">Everyone has already won this cycle.</div>';

  return '<div class="overlay"><div class="sheet">' +
    '<div class="sheet-header"><div style="font-size:14px;font-weight:700;">Select this month\'s winner</div>' +
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
  var canEditMode = !pm.isEditing || (existingP && existingP.collectedBy === state.currentAdmin && !existingP.transferred);
  var canMarkUnpaid = pm.isEditing && existingP && existingP.collectedBy === state.currentAdmin;
  var transferHistory = '';
  if (pm.isEditing && existingP) {
    transferHistory += '<div><div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;">Transfer history</div><div style="display:flex;flex-direction:column;gap:10px;">' +
      timelineRow('var(--accent)', escapeHtml(pmem.name) + ' → ' + adminName(existingP.collectedBy), (existingP.mode === 'online' ? 'Online' : 'Cash'), '');
    var monthNet = (monthsCache.get(monthKey(gid, viewMonth)) || {}).transferNet || 0;
    if (monthNet) {
      transferHistory += timelineRow('var(--accent)', (monthNet > 0 ? ADMINS.A.name + ' → ' + ADMINS.B.name : ADMINS.B.name + ' → ' + ADMINS.A.name),
        'Accepted', 'color:var(--accent);', fmt(Math.abs(monthNet)));
    }
    var pendingReq = transferReqCache.get(monthKey(gid, viewMonth));
    if (pendingReq) {
      transferHistory += timelineRow('var(--warning)', (pendingReq.direction === 'AtoB' ? ADMINS.A.name + ' → ' + ADMINS.B.name : ADMINS.B.name + ' → ' + ADMINS.A.name),
        'Pending acceptance', 'color:var(--warning);', fmt(pendingReq.amount));
    }
    transferHistory += '</div></div>';
  }

  return '<div class="overlay"><div class="sheet">' +
    '<div class="sheet-header">' +
      '<div class="avatar sm" style="background:' + colorFor(pidx) + ';">' + initialsOf(pmem.name) + '</div>' +
      '<div style="flex:1 1 auto;min-width:0;"><div style="font-size:14px;font-weight:700;">' + escapeHtml(pmem.name) + '</div>' +
      '<div style="font-size:11.5px;color:var(--text-muted);">' + monthLabel(group.startYear, group.startMonthIndex, viewMonth) + ' · ' + fmt(group.monthlyDeposit) + ' · collected by ' + adminName(holder) + '</div></div>' +
      '<div class="sheet-close" data-action="close-payment-modal">' + iconClose() + '</div>' +
    '</div>' +
    '<div class="sheet-body">' +
      '<div style="text-align:center;padding:8px 0 4px;">' +
        '<div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">Amount</div>' +
        '<div class="mono" style="font-size:32px;font-weight:700;">' + fmt(group.monthlyDeposit) + '</div>' +
        (pm.isEditing && existingP && formatDateTime(existingP.paidAt) ? '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Paid on ' + formatDateTime(existingP.paidAt) + '</div>' : '') +
      '</div>' +
      '<div><div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;">Payment mode</div>' +
      (canEditMode
        ? '<div class="pill-row">' +
            '<button class="pill ' + (pm.mode === 'cash' ? 'active' : '') + '" data-action="set-modal-mode" data-mode="cash">Cash</button>' +
            '<button class="pill ' + (pm.mode === 'online' ? 'active' : '') + '" data-action="set-modal-mode" data-mode="online">Online</button>' +
          '</div>'
        : '<div class="pill-row"><div class="pill active" style="pointer-events:none;">' + (pm.mode === 'online' ? 'Online' : 'Cash') + '</div></div>' +
          '<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">' + (existingP && existingP.transferred ? 'Locked — this amount has been transferred and can no longer be edited.' : 'Only ' + adminName(holder) + ' can change this.') + '</div>'
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
    '<div style="width:100%;max-width:var(--max-width);background:var(--surface);border-top:1px solid var(--border);border-radius:16px 16px 0 0;padding:14px 16px;display:flex;align-items:center;gap:10px;box-shadow:0 -6px 20px rgba(0,0,0,0.12);">' +
      '<div style="flex:1 1 auto;min-width:0;">' +
        '<div style="font-size:11.5px;color:var(--text-muted);">' + mids.length + ' payment' + (mids.length === 1 ? '' : 's') + ' selected</div>' +
        '<div class="mono" style="font-size:16px;font-weight:700;">' + fmt(total) + '</div>' +
      '</div>' +
      '<div data-action="cancel-transfer-selection" style="width:32px;height:32px;border-radius:9px;background:var(--bg);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + iconClose() + '</div>' +
      '<button class="btn btn-primary" style="flex-shrink:0;padding:12px 16px;white-space:nowrap;" data-action="confirm-transfer">Transfer to ' + adminName(target) + '</button>' +
    '</div>' +
  '</div>';
}
