// Inline SVG icons. Kept as plain functions returning markup strings (not
// <img>/sprite refs) so they can inherit `currentColor` or take an explicit
// stroke color per call site — no build step means no SVG sprite tooling.

export function iconChevronLeft() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
export function iconChevronRight() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="var(--color-text-faint)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
export function iconCheck(color) {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13L9.5 17.5L19 7" stroke="' + (color || 'var(--on-brand)') + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
export function iconClose() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
}
export function iconPlus() {
  return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="var(--on-brand)" stroke-width="2.2" stroke-linecap="round"/></svg>';
}
export function iconHome(color) {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 11L12 4L20 11V19A1 1 0 0 1 19 20H5A1 1 0 0 1 4 19V11Z" stroke="' + (color || 'currentColor') + '" stroke-width="1.9" stroke-linejoin="round"/></svg>';
}
export function iconPeople(color) {
  var c = color || 'currentColor';
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3" stroke="' + c + '" stroke-width="1.9"/><path d="M3.5 19.5C3.5 16.5 6 14.5 9 14.5C12 14.5 14.5 16.5 14.5 19.5" stroke="' + c + '" stroke-width="1.9" stroke-linecap="round"/><path d="M15.5 9A2.5 2.5 0 1 0 15.5 4" stroke="' + c + '" stroke-width="1.9" stroke-linecap="round"/><path d="M16 14.6C18.4 15 20.5 16.7 20.5 19.5" stroke="' + c + '" stroke-width="1.9" stroke-linecap="round"/></svg>';
}
export function iconLedger(color) {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="8" width="16" height="11" rx="1.5" stroke="' + (color || 'currentColor') + '" stroke-width="1.9"/><path d="M8 8V6.5A2.5 2.5 0 0 1 10.5 4H13.5A2.5 2.5 0 0 1 16 6.5V8" stroke="' + (color || 'currentColor') + '" stroke-width="1.9"/></svg>';
}
export function iconGoogle() {
  return '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.6H24v9h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1C42.6 37.3 45.1 31.4 45.1 24.5z"/><path fill="#34A853" d="M24 46c6 0 10.9-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C8 41.2 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.6 28.1c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3C2.8 17.2 2 20.5 2 24s.8 6.8 2.3 9.8l7.3-5.7z"/><path fill="#EA4335" d="M24 10.4c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C34.9 3.9 30 2 24 2 15.4 2 8 6.8 4.3 14.2l7.3 5.7c1.8-5.2 6.6-9.5 12.4-9.5z"/></svg>';
}

// Small (14px) inline-label icons — used as a leading glyph next to stat
// labels, section labels, and list subtitles rather than as standalone
// tap targets, so they default to `currentColor` and a lighter stroke.
export function iconWallet(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2.5" stroke="' + (color || 'currentColor') + '" stroke-width="1.8"/><path d="M3 10H21" stroke="' + (color || 'currentColor') + '" stroke-width="1.8"/><circle cx="16.5" cy="14" r="1.2" fill="' + (color || 'currentColor') + '"/></svg>';
}
export function iconCalendar(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5.5" width="17" height="15" rx="2.5" stroke="' + (color || 'currentColor') + '" stroke-width="1.8"/><path d="M8 3.5V7.5M16 3.5V7.5M3.5 10H20.5" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round"/></svg>';
}
export function iconTrophy(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><path d="M7 4H17V10C17 13 14.8 15 12 15C9.2 15 7 13 7 10V4Z" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 6H4.5C4.5 8.5 5.8 10 7.8 10.3M17 6H19.5C19.5 8.5 18.2 10 16.2 10.3" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round"/><path d="M12 15V18M9 20.5H15M9 20.5C9 19.1 9 18 9 18H15C15 18 15 19.1 15 20.5" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
export function iconTrendingUp(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><path d="M3 17L9.5 10.5L13.5 14.5L21 7" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 7H21V13" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
export function iconCollection(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M12 19L6 13M12 19L18 13" stroke="' + (color || 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
export function iconPayout(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M12 5L6 11M12 5L18 11" stroke="' + (color || 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
export function iconTransfer(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><path d="M4 8H16M16 8L12.5 4.5M16 8L12.5 11.5" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 16H8M8 16L11.5 12.5M8 16L11.5 19.5" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
export function iconWarningTriangle(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><path d="M12 4L21.5 20H2.5L12 4Z" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 10V14.5" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="17.3" r="1" fill="' + (color || 'currentColor') + '"/></svg>';
}
export function iconLogout(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><path d="M9 21H5.5A2 2 0 0 1 3.5 19V5A2 2 0 0 1 5.5 3H9" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 16.5L21 12L16 7.5" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12H10" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round"/></svg>';
}
export function iconInfo(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="' + (color || 'currentColor') + '" stroke-width="1.8"/><path d="M12 11V16.5" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="7.7" r="1" fill="' + (color || 'currentColor') + '"/></svg>';
}
export function iconClock(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="' + (color || 'currentColor') + '" stroke-width="1.8"/><path d="M12 7V12.5L15.5 15" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
export function iconTrash(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><path d="M4.5 7H19.5M9.5 7V4.8C9.5 4.4 9.8 4 10.3 4H13.7C14.2 4 14.5 4.4 14.5 4.8V7M18 7L17.3 19.2C17.3 19.7 16.9 20 16.4 20H7.6C7.1 20 6.7 19.7 6.7 19.2L6 7" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
export function iconUndo(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><polyline points="2 5 2 11 8 11" stroke="' + (color || 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 16A9 9 0 1 0 6.6 6.6L2 11" stroke="' + (color || 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
export function iconTag(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><path d="M11.5 3.5H5.5C4.9 3.5 4.5 3.9 4.5 4.5V10.5C4.5 10.8 4.6 11.1 4.8 11.3L12.7 19.2C13.3 19.8 14.3 19.8 14.9 19.2L19.2 14.9C19.8 14.3 19.8 13.3 19.2 12.7L11.3 4.8C11.1 4.6 10.8 4.5 10.5 4.5" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8.2" cy="8.2" r="1.3" fill="' + (color || 'currentColor') + '"/></svg>';
}
export function iconCash(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="6" width="19" height="12" rx="2" stroke="' + (color || 'currentColor') + '" stroke-width="1.8"/><circle cx="12" cy="12" r="2.6" stroke="' + (color || 'currentColor') + '" stroke-width="1.8"/></svg>';
}
export function iconCard(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><rect x="2.5" y="5.5" width="19" height="13" rx="2.2" stroke="' + (color || 'currentColor') + '" stroke-width="1.8"/><path d="M2.5 9.5H21.5" stroke="' + (color || 'currentColor') + '" stroke-width="1.8"/></svg>';
}
export function iconPeopleSmall(color, size) {
  var c = color || 'currentColor';
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3" stroke="' + c + '" stroke-width="1.9"/><path d="M3.5 19.5C3.5 16.5 6 14.5 9 14.5C12 14.5 14.5 16.5 14.5 19.5" stroke="' + c + '" stroke-width="1.9" stroke-linecap="round"/><path d="M15.5 9A2.5 2.5 0 1 0 15.5 4" stroke="' + c + '" stroke-width="1.9" stroke-linecap="round"/><path d="M16 14.6C18.4 15 20.5 16.7 20.5 19.5" stroke="' + c + '" stroke-width="1.9" stroke-linecap="round"/></svg>';
}
export function iconPlusSmall(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="' + (color || 'currentColor') + '" stroke-width="2.2" stroke-linecap="round"/></svg>';
}
export function iconGroupStack(color, size) {
  return '<svg width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="6.5" rx="1.8" stroke="' + (color || 'currentColor') + '" stroke-width="1.8"/><rect x="4" y="13.5" width="16" height="6.5" rx="1.8" stroke="' + (color || 'currentColor') + '" stroke-width="1.8"/></svg>';
}
// An arrow rising to meet a ceiling line — "fill up to the max/target",
// used on the payout modal's "fill the rest in" button instead of text.
export function iconFillToMax(color, size) {
  return '<svg width="' + (size || 16) + '" height="' + (size || 16) + '" viewBox="0 0 24 24" fill="none"><path d="M4 5H20" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round"/><path d="M12 19V7M12 7L7.5 11.5M12 7L16.5 11.5" stroke="' + (color || 'currentColor') + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
