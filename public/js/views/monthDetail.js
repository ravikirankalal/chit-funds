import { ADMINS } from '../../firebase-config.js';
import { state, groupsById, membersByGroup, paymentsCache, monthsCache, transferReqCache, monthKey } from '../store.js';
import { fmt, escapeHtml, initialsOf, colorFor, adminName, otherAdmin, isSuper, monthLabel } from '../helpers.js';
import { monthFinances } from '../finance.js';
import { iconChevronLeft, iconCheck, iconClose } from '../icons.js';

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
    html += renderPaymentList(gid, viewMonth, members, f, readOnly);
  }

  if (isOpen) {
    html += renderFundPosition(f, readOnly);
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

function renderPaymentList(gid, viewMonth, members, f, readOnly) {
  var payments = paymentsCache.get(monthKey(gid, viewMonth)) || {};
  var payRows = members.map(function (mm, idx) {
    var p = payments[mm.id] || { paid: false };
    return { mm: mm, idx: idx, paid: !!p.paid, collectedBy: p.collectedBy, mode: p.mode };
  });
  payRows.sort(function (a, b) { if (a.paid === b.paid) return 0; return a.paid ? 1 : -1; });
  var rowsHtml = payRows.map(function (r) {
    var subtitle = r.paid
      ? 'Collected by <span style="font-weight:600;color:var(--accent);">' + adminName(r.collectedBy) + '</span> · ' + (r.mode === 'online' ? 'Online' : 'Cash')
      : '<span style="color:var(--danger);">Not paid yet' + (readOnly ? '' : ' · tap to record') + '</span>';
    return '<div class="list-row" ' + (readOnly ? '' : 'data-action="open-payment-modal" data-mid="' + r.mm.id + '"') + '>' +
      '<div class="avatar sm" style="background:' + colorFor(r.idx) + ';">' + initialsOf(r.mm.name) + '</div>' +
      '<div style="flex:1 1 auto;min-width:0;"><div style="font-size:13px;font-weight:500;">' + escapeHtml(r.mm.name) + '</div>' +
      '<div style="font-size:11px;color:var(--text-muted);margin-top:1px;">' + subtitle + '</div></div>' +
      '<div style="width:24px;height:24px;border-radius:7px;background:' + (r.paid ? 'var(--accent)' : 'transparent') + ';border:1.5px solid ' + (r.paid ? 'var(--accent)' : '#d8d4cb') + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (r.paid ? iconCheck('#fff') : '') + '</div>' +
    '</div>';
  }).join('');
  return '<div><div class="section-label">Member payments (' + f.paidCount + '/' + members.length + ')</div><div class="row-list">' + rowsHtml + '</div></div>';
}

function renderFundPosition(f, readOnly) {
  var req = transferReqCache.get(monthKey(state.activeGroupId, state.viewMonth));
  var html = '<div class="card" style="display:flex;flex-direction:column;gap:12px;">' +
    '<div style="font-size:13px;font-weight:600;">This month\'s fund position</div>' +
    '<div style="display:flex;gap:12px;">' +
      '<div style="flex:1 1 0;"><div style="font-size:11px;color:var(--text-muted);">' + ADMINS.A.name + ' holds</div><div class="mono" style="font-size:15px;font-weight:700;">' + fmt(f.adjA) + '</div></div>' +
      '<div style="flex:1 1 0;text-align:right;"><div style="font-size:11px;color:var(--text-muted);">' + ADMINS.B.name + ' holds</div><div class="mono" style="font-size:15px;font-weight:700;">' + fmt(f.adjB) + '</div></div>' +
    '</div>';
  if (readOnly) {
    if (req) {
      html += '<div style="font-size:11.5px;color:var(--warning);">' + adminName(req.requestedBy) + ' requested to send ' + fmt(req.amount) + ' (' + (req.direction === 'AtoB' ? ADMINS.A.name + ' → ' + ADMINS.B.name : ADMINS.B.name + ' → ' + ADMINS.A.name) + ') — pending acceptance.</div>';
    }
  } else if (!req) {
    html += '<div class="pill-row"><button class="btn btn-soft" style="flex:1 1 0;" data-action="request-transfer-b">Send all to ' + ADMINS.B.name + ' →</button>' +
      '<button class="btn btn-soft" style="flex:1 1 0;" data-action="request-transfer-a">← Send all to ' + ADMINS.A.name + '</button></div>' +
      '<div style="font-size:11px;color:var(--text-muted);line-height:1.4;">No free-amount transfers — sending funds still needs ' + adminName(otherAdmin(state.currentAdmin)) + ' to accept before it counts.</div>';
  } else if (req.requestedBy === state.currentAdmin) {
    html += '<div class="banner warn"><div class="banner-title">Waiting for ' + adminName(otherAdmin(req.requestedBy)) + ' to accept</div>' +
      '<div style="font-size:12px;">' + fmt(req.amount) + ' · ' + (req.direction === 'AtoB' ? ADMINS.A.name + ' → ' + ADMINS.B.name : ADMINS.B.name + ' → ' + ADMINS.A.name) + '</div>' +
      '<button class="btn btn-outline" style="width:100%;" data-action="cancel-transfer-request">Cancel request</button></div>';
  } else {
    html += '<div class="banner warn"><div class="banner-title">' + adminName(req.requestedBy) + ' wants to send ' + fmt(req.amount) + '</div>' +
      '<div style="font-size:12px;">' + (req.direction === 'AtoB' ? ADMINS.A.name + ' → ' + ADMINS.B.name : ADMINS.B.name + ' → ' + ADMINS.A.name) + '</div>' +
      '<div class="pill-row"><button class="btn btn-outline" style="flex:1 1 0;" data-action="decline-transfer-request">Decline</button>' +
      '<button class="btn btn-primary" style="flex:1 1 0;" data-action="accept-transfer-request">Accept</button></div></div>';
  }
  html += '</div>';
  return html;
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
    '<div class="pill-row">' +
      '<button class="pill ' + (state.ui.payoutAdminChoice === 'A' ? 'active' : '') + '" data-action="set-payout-admin" data-id="A">Paid by ' + ADMINS.A.name + '</button>' +
      '<button class="pill ' + (state.ui.payoutAdminChoice === 'B' ? 'active' : '') + '" data-action="set-payout-admin" data-id="B">Paid by ' + ADMINS.B.name + '</button>' +
    '</div>' +
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
