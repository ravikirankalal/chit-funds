// The month detail screen — by far the busiest screen in the app (winner
// selection, per-admin payout contributions, the member payment list with
// its tabs, hand-off requests, and the payment/payout modals). Split by
// concern into sibling modules instead of one file, so each piece can be
// read and changed on its own:
//   shared.js          — small helpers reused across sections (signed(),
//                         summaryStat(), timelineRow(), the paid/unpaid strip)
//   handoffRequests.js — pending transfer hand-off cards
//   summary.js         — the closed/open/upcoming summary card
//   paymentList.js      — the tabbed member payment list
//   winner.js           — the winner card + winner-picker overlay
//   payout.js            — the payout card + payout modal
//   paymentModal.js      — the per-member payment detail/edit modal
//   transferBar.js       — the floating "N payments selected" bar
// This file stays the orchestrator: screen-level state (open/closed/
// upcoming, the status pill, which overlay is showing) and assembly only.
import { state, groupsById, membersByGroup } from '../../store.js';
import { isSuper, escapeHtml, monthLabel } from '../../helpers.js';
import { monthFinances } from '../../finance/monthFinances.js';
import { iconChevronLeft, iconCheck, iconClock, iconCalendar } from '../../icons.js';
import { bar, skeletonListRow } from '../../skeleton.js';
import { renderHandoffRequests } from './handoffRequests.js';
import { renderClosedSummary, renderUpcomingNotice, renderOpenSummary } from './summary.js';
import { renderPaymentList } from './paymentList.js';
import { renderWinnerCard, renderWinnerPickerOverlay } from './winner.js';
import { renderPayoutCard, renderPayoutModalOverlay } from './payout.js';
import { renderPaymentModalOverlay } from './paymentModal.js';
import { renderTransferBar } from './transferBar.js';

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
  // True once either admin has recorded a real contribution toward a
  // winner's payout but the total isn't fully covered yet — see
  // setPayoutContribution in actions/winners/payout.js, which closes the
  // month itself the instant every winner's paidByA + paidByB reaches its
  // payoutAmount. Winner/amount editing locks while this is true (see
  // renderWinnerCard below).
  var payoutStarted = f.winners.length > 0 && (f.payoutPaidA > 0 || f.payoutPaidB > 0);
  // A winner added via "Add another winner" (actions/winners/picker.js)
  // AFTER the month already closed starts genuinely unpaid, and
  // setPayoutContribution's close-and-advance transaction only ever fires
  // for the month's ORIGINAL close — so isClosed and an outstanding payout
  // can now genuinely coexist. A flat "Closed" pill would misreport that
  // as fully done; show it as still needing attention instead.
  var payoutPending = isClosed && !f.allPayoutCovered;

  // Gold matches the payout color used on the dashboard, the winner card,
  // and group detail's month rows — a payout in progress gets that same
  // accent everywhere it shows up.
  var statusLabel = payoutPending ? 'Payout pending' : (isClosed ? 'Closed' : (payoutStarted ? 'Payout in progress' : (isOpen ? 'Open' : 'Upcoming')));
  var statusBg = payoutPending ? 'var(--color-gold-soft)' : (isClosed ? 'var(--color-success-soft)' : (payoutStarted ? 'var(--color-gold-soft)' : (isOpen ? 'var(--color-secondary)' : 'var(--color-border)')));
  var statusColor = payoutPending ? 'var(--color-gold)' : (isClosed ? 'var(--color-success)' : (payoutStarted ? 'var(--color-gold)' : (isOpen ? 'var(--on-brand)' : 'var(--color-text-faint)')));
  var statusIcon = payoutPending ? iconClock(statusColor) : (isClosed ? iconCheck(statusColor) : (payoutStarted ? iconClock(statusColor) : (isUpcoming ? iconClock(statusColor) : '')));

  var html = '<div class="screen">' +
    '<div class="topbar">' +
      '<div class="back" data-action="nav-back">' + iconChevronLeft() + '</div>' +
      '<div style="flex:1 1 auto;"><div class="title">' + iconCalendar('var(--color-primary)', 18) + monthLabel(group.startYear, group.startMonthIndex, viewMonth) + '</div><div class="subtitle">' + escapeHtml(group.name) + ' · Month ' + viewMonth + ' of ' + group.durationMonths + '</div></div>' +
      '<div style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:5px 10px;border-radius:8px;background:' + statusBg + ';color:' + statusColor + ';">' + statusIcon + statusLabel + '</div>' +
    '</div>' +
    '<div class="content">';

  if (isOpen || isClosed) html += renderHandoffRequests(gid, viewMonth, readOnly, members, f, isClosed);

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

  // Hidden while a transfer selection is in progress (see the floating
  // transfer bar below) — its Remove/amount-edit controls have nothing to
  // do with handing off payments, and would just be a second set of
  // interactive rows competing with the transfer bar for attention.
  // Also shown on a closed month for any winner that's still unpaid (see
  // renderWinnerCard's closedMode) — a winner added via "Add another
  // winner" after close can still be a mistake worth undoing, so removal
  // stays available up until their payout actually starts.
  if ((isOpen || (isClosed && !f.allPayoutCovered)) && !state.ui.transferSelection) {
    html += renderWinnerCard(f, members, readOnly, isClosed);
  }
  // Also shown on a closed month once a winner still has something owed —
  // a winner added via "Add another winner" AFTER close (see addWinner in
  // actions/winners/picker.js) starts genuinely unpaid, and this is the
  // only way to actually start their payment cycle (openPayoutModal stays
  // locked for any winner that was already fully covered when the month
  // closed).
  if (!readOnly && !state.ui.transferSelection && (isOpen || (isClosed && !f.allPayoutCovered))) {
    html += renderPayoutCard(f, members);
  }

  // Closed-month "Add another winner" lives at the very end of the page,
  // not up with the winner/payout card(s) — it's a rare correction (an
  // admin catching a winner they missed after closing), not part of the
  // normal reading flow, so it shouldn't compete for attention with the
  // summary or payment list above it.
  if (isClosed && !readOnly) {
    html += '<button class="btn btn-primary" style="width:100%;" data-action="open-winner-picker">Add another winner</button>';
  }

  html += '</div>';

  if (state.ui.showWinnerPicker) html += renderWinnerPickerOverlay(gid, group, f, members);
  if (state.ui.paymentModal) html += renderPaymentModalOverlay(gid, viewMonth, group, members);
  if (state.ui.payoutModal) html += renderPayoutModalOverlay(f, members);
  if (state.ui.transferSelection) html += renderTransferBar(gid, viewMonth, group);

  return html;
}
