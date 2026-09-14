// Shimmering placeholder blocks — shared by every screen's loading state
// (and by index.html's own static markup, hand-mirrored there since it
// renders before any JS runs). A shimmer block always reads as "this part
// of the screen is on its way," which a bare "Loading…" message doesn't.

export function bar(w, h, extra) {
  return '<div class="skeleton" style="width:' + w + ';height:' + h + ';' + (extra || '') + '"></div>';
}

// A generic app-shell skeleton for the moment before we even know which
// screen we're headed to (auth still resolving) — shaped like the
// dashboard, the most common landing screen, so the transition into it
// feels continuous rather than a swap between two unrelated layouts.
export function renderBootSkeleton() {
  return '<div class="screen">' +
    '<div style="padding:20px 20px 4px; display:flex; align-items:center; justify-content:space-between;">' +
      '<div style="display:flex;flex-direction:column;gap:6px;">' + bar('120px', '11px') + bar('150px', '22px', 'margin-top:2px;') + '</div>' +
      bar('36px', '36px', 'border-radius:12px;flex-shrink:0;') +
    '</div>' +
    '<div class="content">' +
      bar('100%', '92px', 'border-radius:20px;') +
      '<div style="display:flex;gap:12px;">' + bar('50%', '56px', 'border-radius:14px;') + bar('50%', '56px', 'border-radius:14px;') + '</div>' +
      bar('100%', '68px', 'border-radius:16px;') +
      bar('100%', '68px', 'border-radius:16px;') +
    '</div>' +
  '</div>';
}

// A topbar-shaped skeleton for detail screens (group detail, month
// detail, member payments, group members) — back button + two lines of
// title text, so the header doesn't visibly "pop in" once real data
// arrives a beat after the shimmering body.
export function skeletonTopbar() {
  return '<div class="topbar">' +
    bar('32px', '32px', 'border-radius:11px;flex-shrink:0;') +
    '<div style="display:flex;flex-direction:column;gap:6px;">' + bar('150px', '15px') + bar('100px', '11px', 'margin-top:1px;') + '</div>' +
  '</div>';
}

export function skeletonListRow() {
  return '<div class="list-row" style="pointer-events:none;">' +
    bar('34px', '34px', 'border-radius:12px;flex-shrink:0;') +
    '<div style="flex:1 1 auto;display:flex;flex-direction:column;gap:6px;">' + bar('55%', '13px') + bar('35%', '11px') + '</div>' +
  '</div>';
}
