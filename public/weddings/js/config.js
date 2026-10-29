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
  { id: 'venue', label: 'Venue & booking' },
  { id: 'decor', label: 'Decoration & mandap' },
  { id: 'catering', label: 'Catering' },
  { id: 'photo', label: 'Photography' },
  { id: 'video', label: 'Videography' },
  { id: 'makeup', label: 'Bridal makeup' },
  { id: 'mehendi', label: 'Mehendi' },
  { id: 'music', label: 'Music & DJ' },
  { id: 'invites', label: 'Invitations' },
  { id: 'priest', label: 'Priest / pandit' },
  { id: 'transport', label: 'Guest transport' },
  { id: 'stay', label: 'Guest accommodation' }
];

export const STATUSES = ['new', 'contacted', 'booked', 'closed'];
