// Everything planner-specific lives here. Edit this file, not the other modules.

// The only account allowed to read/manage leads. IMPORTANT: also duplicated
// in firestore.rules (isWeddingPlanner) — rules can't import this file.
export const PLANNER_EMAIL = 'ravikiran.kalal@gmail.com';

// TODO(owner): PLACEHOLDER numbers — replace with the real ones before running
// ads or sharing the link. Digits only, with country code (no + or spaces).
export const CONTACT = { phone: '910000000000', whatsapp: '910000000000' };

// Google Ads. Leave ADS_ID empty to disable tracking entirely.
// ADS_ID looks like 'AW-1234567890'; the label is from the conversion action.
export const ADS = { id: '', conversionLabel: '' };

export const SERVICES = [
  { id: 'venue', label: 'Venue', blurb: 'Halls, lawns, resorts' },
  { id: 'decor', label: 'Decoration & mandap', blurb: 'Mandap, stage, flowers' },
  { id: 'catering', label: 'Catering', blurb: 'Menus for every guest' },
  { id: 'photo', label: 'Photography', blurb: 'Candid & traditional' },
  { id: 'video', label: 'Videography', blurb: 'Films & highlights' },
  { id: 'makeup', label: 'Bridal makeup', blurb: 'Bridal & family' },
  { id: 'mehendi', label: 'Mehendi', blurb: 'Bridal & guest artists' },
  { id: 'music', label: 'Music & DJ', blurb: 'DJ, band, sangeet' },
  { id: 'invites', label: 'Invitations', blurb: 'Cards & e-invites' },
  { id: 'priest', label: 'Priest / pandit', blurb: 'Rituals & muhurat' },
  { id: 'transport', label: 'Guest transport', blurb: 'Cars & guest travel' },
  { id: 'stay', label: 'Guest stay', blurb: 'Rooms for family' }
];

export const STATUSES = ['new', 'contacted', 'booked', 'closed'];
