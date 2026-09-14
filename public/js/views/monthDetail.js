import { ADMINS } from '../../firebase-config.js';
import { state, groupsById, membersByGroup, paymentsCache, monthsCache, transferReqCache, monthKey } from '../store.js';
import { fmt, escapeHtml, initialsOf, colorFor, adminName, isSuper, monthLabel } from '../helpers.js';
import { monthFinances } from '../finance.js';
import { iconChevronLeft, iconChevronRight, iconCheck, iconClose } from '../icons.js';

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
      '<div style="flex:1 1 auto;"><div class="title">' + monthLabel(group.startYear, group.startMonthIndex, viewMonth) + '</div><div class="subtitle">' + escapeHtml(group.name) + ' · of ' + group.durationMonths + '</div></div>' +
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
    html += renderPaymentList(gid, viewMonth, members, f, readOnly, group);
  }

  if (isOpen) {
    html += renderWinnerCard(f, members, readOnly);
    if (!readOnly) html += renderPayoutCard(f);
  }

  html += '</div>';

  if (state.ui.showWinnerPicker) html += renderWinnerPickerOverlay(gid, group, f, members);
  if (state.ui.paymentModal) html += renderPaymentModalOverlay(gid, viewMonth, group, members);

  return html;
}

function row(label, value) {
  return '<div style="display:flex;justify-content:space-between;"><div style="font-size:12px;color:var(--text-muted);">' + label + '</div><div style="font-size:13px;font-weight:700;">' + value + '</div></div>';
}

function timelineRow(dotColor, title, status, statusStyle, amount) {
  return '<div style="display:flex;align-items:flex-start;gap:10px;">' +
    '<div style="width:8px;height:8px;border-radius:4px;background:' + dotColor + ';margin-top:5px;flex-shrink:0;"></div>' +
    '<div style="flex:1 1 auto;"><div style="font-size:12.5px;font-weight:500;">' + title + '</div>' +
    '<div style="font-size:11px;' + statusStyle + '">' + status + (amount ? ' · ' + amount : '') + '</div></div></div>';
}

function renderClosedSummary(f, members) {
  var winner = members.find(function (mm) { return mm.id === f.monthDoc.winnerId; });
  return '<div class="card" style="display:flex;flex-direction:column;gap:10px;">' +
    row('Winner', winner ? escapeHtml(winner.name) : '—') +
    row('Payout amount', fmt(f.payoutAmount)) +
    row('Paid out by', adminName(f.monthDoc.payoutAdmin)) +
    row('Collected', fmt(f.totalCollected)) +
    '<div style="height:1px;background:var(--border);"></div>' +
    row('Split after transfer', ADMINS.A.name + ' ' + fmt(f.adjA) + ' · ' + ADMINS.B.name + ' ' + fmt(f.adjB)) +
    row('Closed', escapeHtml(f.monthDoc.closedLabel || '')) +
  '</div>';
}

function renderUpcomingNotice(group, viewMonth) {
  return '<div class="banner warn"><div class="banner-title">Not yet open</div>' +
    '<div style="font-size:12.5px;color:var(--text-muted);">Opens once ' + monthLabel(group.startYear, group.startMonthIndex, viewMonth - 1) + ' is closed. Scheduled payout: ' + fmt((group.payoutSchedule && group.payoutSchedule[viewMonth - 1]) || 0) + '.</div></div>';
}

function renderOpenSummary(f, members, group) {
  return '<div class="card" style="display:flex;justify-content:space-between;align-items:center;">' +
    '<div><div style="font-size:12px;color:var(--text-muted);">Collected</div><div class="mono" style="font-size:16px;font-weight:700;">' + fmt(f.totalCollected) + ' <span style="font-size:12px;color:var(--text-muted);font-weight:400;">/ ' + fmt(members.length * group.monthlyDeposit) + '</span></div></div>' +
    '<div style="text-align:right;"><div style="font-size:12px;color:var(--text-muted);">Scheduled payout</div><div class="mono" style="font-size:16px;font-weight:700;color:var(--accent);">' + fmt(f.payoutAmount) + '</div></div>' +
  '</div>';
}

function paymentRow(r, readOnly) {
  var subtitle = r.paid
    ? 'Collected by <span style="font-weight:600;color:var(--accent);">' + adminName(r.collectedBy) + '</span> · ' + (r.mode === 'online' ? 'Online' : 'Cash')
    : '<span style="color:var(--danger);">Not paid yet' + (readOnly ? '' : ' · tap to record') + '</span>';
  return '<div class="list-row" ' + (readOnly ? '' : 'data-action="open-payment-modal" data-mid="' + r.mm.id + '"') + '>' +
    '<div class="avatar sm" style="background:' + colorFor(r.idx) + ';">' + initialsOf(r.mm.name) + '</div>' +
    '<div style="flex:1 1 auto;min-width:0;"><div style="font-size:13px;font-weight:500;">' + escapeHtml(r.mm.name) + '</div>' +
    '<div style="font-size:11px;color:var(--text-muted);margin-top:1px;">' + subtitle + '</div></div>' +
    '<div style="flex-shrink:0;display:flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:5px 10px;border-radius:20px;background:' + (r.paid ? 'var(--accent-soft)' : '#fbe9e7') + ';color:' + (r.paid ? 'var(--accent)' : 'var(--danger)') + ';">' + (r.paid ? iconCheck('var(--accent)') + 'Paid' : 'Unpaid') + '</div>' +
  '</div>';
}

function paymentSubsection(key, label, rows, amount, readOnly) {
  if (!rows.length) return '';
  var collapsed = !!state.ui.collapsedPaymentSections[key];
  return '<div style="margin-top:14px;">' +
    '<div data-action="toggle-payment-section" data-key="' + key + '" style="display:flex;align-items:center;gap:4px;cursor:pointer;margin-bottom:6px;">' +
      '<div style="display:flex;transform:rotate(' + (collapsed ? '0' : '90') + 'deg);color:var(--text-muted);">' + iconChevronRight() + '</div>' +
      '<div style="font-size:11.5px;font-weight:600;color:var(--text-muted);">' + label + ' (' + rows.length + ') · ' + fmt(amount) + '</div>' +
    '</div>' +
    (collapsed ? '' : '<div class="row-list">' + rows.map(function (r) { return paymentRow(r, readOnly); }).join('') + '</div>') +
  '</div>';
}

// Unpaid always leads; whichever admin is currently signed in gets their
// own "collected by" section second, so each admin sees their own
// collections first without having to scan past the other admin's.
// Collapse state is keyed by admin id (not position) so it stays stable
// regardless of which admin is currently viewing.
function renderPaymentList(gid, viewMonth, members, f, readOnly, group) {
  var payments = paymentsCache.get(monthKey(gid, viewMonth)) || {};
  var payRows = members.map(function (mm, idx) {
    var p = payments[mm.id] || { paid: false };
    return { mm: mm, idx: idx, paid: !!p.paid, collectedBy: p.collectedBy, mode: p.mode };
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
    paymentSubsection('unpaid', 'Unpaid', unpaidRows, unpaidAmount, readOnly) +
    paymentSubsection(firstKey, firstLabel, firstRows, firstAmount, readOnly) +
    paymentSubsection(secondKey, secondLabel, secondRows, secondAmount, readOnly) +
  '</div>';
}

function renderWinnerCard(f, members, readOnly) {
  var winnerId = f.monthDoc && f.monthDoc.winnerId;
  var winner = winnerId && members.find(function (mm) { return mm.id === winnerId; });
  var html = '<div class="card" style="display:flex;flex-direction:column;gap:10px;">' +
    '<div style="font-size:13px;font-weight:600;">This month\'s winner</div>';
  if (winner) {
    var widx = members.findIndex(function (mm) { return mm.id === winner.id; });
    html += '<div class="list-row" style="background:var(--accent-soft); cursor:' + (readOnly ? 'default' : 'pointer') + ';" ' + (readOnly ? '' : 'data-action="open-winner-picker"') + '>' +
      '<div class="avatar sm" style="background:' + colorFor(widx) + ';">' + initialsOf(winner.name) + '</div>' +
      '<div style="flex:1 1 auto;font-size:13px;font-weight:600;color:var(--accent);">' + escapeHtml(winner.name) + '</div>' +
      (readOnly ? '' : '<div style="font-size:12px;color:var(--accent);font-weight:600;">Change</div>') + '</div>';
  } else if (readOnly) {
    html += '<div style="font-size:12.5px;color:var(--text-muted);">No winner selected yet.</div>';
  } else {
    html += '<button class="btn btn-primary" style="width:100%;" data-action="open-winner-picker">Select Winner</button>';
  }
  html += '</div>';
  return html;
}

function renderPayoutCard(f) {
  var winnerId = f.monthDoc && f.monthDoc.winnerId;
  var req = transferReqCache.get(monthKey(state.activeGroupId, state.viewMonth));
  return '<div class="card" style="display:flex;flex-direction:column;gap:12px;">' +
    '<div style="font-size:13px;font-weight:600;">Record payout</div>' +
    (req ? '<div style="font-size:11px;color:var(--warning);">Resolve the pending transfer request above before closing this month.</div>' : '') +
    '<button class="btn btn-primary ' + (winnerId && !req ? '' : 'disabled') + '" style="width:100%; background:' + (winnerId && !req ? 'var(--accent)' : '#c7c2b8') + ';" data-action="close-month">Close Month &amp; Pay ' + fmt(f.payoutAmount) + '</button>' +
  '</div>';
}

function renderWinnerPickerOverlay(gid, group, f, members) {
  var wonIds = {};
  for (var m2 = 1; m2 <= group.durationMonths; m2++) {
    var mf = monthFinances(gid, group, m2);
    if (mf.closed && mf.monthDoc.winnerId) wonIds[mf.monthDoc.winnerId] = true;
  }
  var eligible = members.filter(function (mm) { return !wonIds[mm.id]; });
  var winnerRows = eligible.map(function (mm) {
    var idx = members.indexOf(mm);
    var selected = f.monthDoc && f.monthDoc.winnerId === mm.id;
    return '<div class="list-row" data-action="select-winner" data-mid="' + mm.id + '" style="background:' + (selected ? 'var(--accent-soft)' : '#fff') + '; border-color:' + (selected ? 'var(--accent)' : 'var(--border)') + ';">' +
      '<div class="avatar sm" style="background:' + colorFor(idx) + ';">' + initialsOf(mm.name) + '</div>' +
      '<div style="flex:1 1 auto;font-size:13px;font-weight:500;">' + escapeHtml(mm.name) + '</div>' +
      (selected ? '<div style="width:22px;height:22px;border-radius:11px;background:var(--accent);display:flex;align-items:center;justify-content:center;">' + iconCheck() + '</div>' : '') +
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
      '<div style="font-size:11.5px;color:var(--text-muted);">' + monthLabel(group.startYear, group.startMonthIndex, viewMonth) + ' · ' + fmt(group.monthlyDeposit) + ' · collected by ' + adminName(state.currentAdmin) + '</div></div>' +
      '<div class="sheet-close" data-action="close-payment-modal">' + iconClose() + '</div>' +
    '</div>' +
    '<div class="sheet-body">' +
      '<div><div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;">Payment mode</div>' +
      '<div class="pill-row">' +
        '<button class="pill ' + (pm.mode === 'cash' ? 'active' : '') + '" data-action="set-modal-mode" data-mode="cash">Cash</button>' +
        '<button class="pill ' + (pm.mode === 'online' ? 'active' : '') + '" data-action="set-modal-mode" data-mode="online">Online</button>' +
      '</div></div>' +
      transferHistory +
      (pm.isEditing ? '<button class="btn btn-danger-text" style="width:100%;" data-action="mark-unpaid">Mark as unpaid</button>' : '') +
      '<button class="btn btn-primary" style="width:100%;" data-action="save-payment">Save Payment</button>' +
    '</div>' +
  '</div></div>';
}
