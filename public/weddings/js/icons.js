// Small stroke icons (24px viewBox) for the service cards. Static markup only —
// no user data ever goes through here.
const P = {
  venue: '<path d="M3 21V9l9-6 9 6v12M9 21v-6h6v6"/>',
  decor: '<path d="M12 3c2 3 2 5 0 8-2-3-2-5 0-8zM5 12c3-1 5 0 7 3-3 1-5 0-7-3zM19 12c-3-1-5 0-7 3 3 1 5 0 7-3zM12 15v6"/>',
  catering: '<path d="M5 3v8a3 3 0 0 0 3 3v7M8 3v6M11 3v8a3 3 0 0 1-3 3M17 21V3c-2 1-3 4-3 8h3"/>',
  photo: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  makeup: '<path d="M9 21v-9h6v9zM10 12V6l2-3 2 3v6"/>',
  mehendi: '<path d="M12 21c-4-2-6-5-6-9V6l2 1V3l2 1V2l2 1 2-1v2l2-1v4l2-1v6c0 4-2 7-6 9z"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  invites: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  priest: '<path d="M12 3c3 4 5 6 5 9a5 5 0 0 1-10 0c0-3 2-5 5-9zM6 21h12"/>',
  transport: '<path d="M4 16V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8M4 16h16M4 16v2h3v-2M17 16v2h3v-2"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/>',
  stay: '<path d="M3 20V8M3 14h18v6M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  check: '<path d="M5 12l5 5 9-10"/>'
};
export function icon(name) {
  return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || '') + '</svg>';
}
