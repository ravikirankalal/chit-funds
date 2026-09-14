// Inline SVG icons. Kept as plain functions returning markup strings (not
// <img>/sprite refs) so they can inherit `currentColor` or take an explicit
// stroke color per call site — no build step means no SVG sprite tooling.

export function iconChevronLeft() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 6L9 12L15 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
export function iconChevronRight() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#a39d92" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
export function iconCheck(color) {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13L9.5 17.5L19 7" stroke="' + (color || '#fff') + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
export function iconClose() {
  return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
}
export function iconPlus() {
  return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>';
}
export function iconHome(color) {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 11L12 4L20 11V19A1 1 0 0 1 19 20H5A1 1 0 0 1 4 19V11Z" stroke="' + color + '" stroke-width="1.9" stroke-linejoin="round"/></svg>';
}
export function iconPeople(color) {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3" stroke="' + color + '" stroke-width="1.9"/><path d="M3.5 19.5C3.5 16.5 6 14.5 9 14.5C12 14.5 14.5 16.5 14.5 19.5" stroke="' + color + '" stroke-width="1.9" stroke-linecap="round"/><path d="M15.5 9A2.5 2.5 0 1 0 15.5 4" stroke="' + color + '" stroke-width="1.9" stroke-linecap="round"/><path d="M16 14.6C18.4 15 20.5 16.7 20.5 19.5" stroke="' + color + '" stroke-width="1.9" stroke-linecap="round"/></svg>';
}
export function iconLedger(color) {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="8" width="16" height="11" rx="1.5" stroke="' + color + '" stroke-width="1.9"/><path d="M8 8V6.5A2.5 2.5 0 0 1 10.5 4H13.5A2.5 2.5 0 0 1 16 6.5V8" stroke="' + color + '" stroke-width="1.9"/></svg>';
}
export function iconGoogle() {
  return '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.6H24v9h11.8c-.5 2.7-2.1 5-4.4 6.6v5.5h7.1C42.6 37.3 45.1 31.4 45.1 24.5z"/><path fill="#34A853" d="M24 46c6 0 10.9-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C8 41.2 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.6 28.1c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3C2.8 17.2 2 20.5 2 24s.8 6.8 2.3 9.8l7.3-5.7z"/><path fill="#EA4335" d="M24 10.4c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C34.9 3.9 30 2 24 2 15.4 2 8 6.8 4.3 14.2l7.3 5.7c1.8-5.2 6.6-9.5 12.4-9.5z"/></svg>';
}
