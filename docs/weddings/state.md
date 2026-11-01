# Weddings app: current state

Last updated: 2026-11-01. Tasks live in [task.md](task.md).

## What it is
Static landing page + lead capture for a wedding planner, served at `/weddings`
on the same Firebase project as chit funds (`localbc-41b52`). It shares only the
Firebase project with the chit-funds app; code is separate under `public/weddings/`.
Customers (signed in or anonymous) request a callback or quotation; the planner
sees and manages leads after Google sign-in.

- Live: https://localbc-41b52.web.app/weddings/
- Released: v0.1 (PR #78, git tag `v0.1`, deployed to hosting by hand from `develop` on 2026-10-29)
- Preview channel for review: `design-preview` (expires 2026-11-05),
  https://localbc-41b52--design-preview-qn6v6v5h.web.app/weddings/

## Code map (`public/weddings/`)
- `index.html`, `css/weddings.css` (layered; later rules override earlier ones), `js/`
  - `config.js` SERVICES (12), STATUSES, CONTACT (919901216122, edit here to change), ADS (empty), PLANNER_EMAIL
  - `main.js` hero, service grid, bottom-sheet form, submit, credits
  - `leads.js` / `admin.js` lead create/read and the planner's Leads view
  - `firebase.js` shares `../firebase-config.js`
- `img/` service and hero photos (Unsplash) + `credits.json`; `img/orn/*.svg` custom ornament set
  (corner, frame, frieze2, divider, arch-frame, red-bg, bg)
- Asset URLs and CSS/JS carry `?v=N` cache-busters; bump them when changing files.
  HTML itself is cached ~1h by default (see task B3), so test with a fresh `?v=` URL.

## Data and rules
- Firestore collection `weddingLeads`. Public `create` is validated in `firestore.rules`
  (`validLead`); owners read their own; the planner (`isWeddingPlanner()`, email must match
  `PLANNER_EMAIL` in `config.js`) can read, update (status, plannerNote, updatedAt) and delete.
- The existing catch-all rule still lets the two chit-funds admins read/write `weddingLeads`;
  narrowing it was deliberately left out (risk to collection-group queries).
- Rules were deployed with PR #76. Not emulator-tested.

## Design (v0.1)
Old Indian wedding invitation with Kannada accents: cream cards with double gold/red rules and
square corners, filigree corner art, red paisley field, cusped-arch photo windows, lotus frieze
stripes, scroll dividers, 4-across service grid, ceremonies card, RSVP band, callback bottom sheet,
pinned Call / WhatsApp / Request-callback bar on mobile.

## Shipped since v0.1 (2026-11-01, deployed to production)
- PR #80 HTML no-cache, PR #81 privacy page, PR #82 name "Shivaleela Weddings" + phone/WhatsApp +919901216122.

## Logo (A2, done: SW monogram)
Three option sets were drawn in the session scratchpad (not in repo). Set 3 (real typefaces as outlines,
distinct layouts: arch emblem, round badge, bold monogram, door panel, script, modern line) is the
current candidate set; owner has not picked yet. Rules: real display typefaces outlined, options must
differ in layout, divider, type and colour.

## Known gaps
See task.md. Main ones: no logo yet, empty ADS config (owner to send AW id + label), lead test through
the Leads screen and a real form submit not done, wide-screen layouts unchecked, Kannada unproofread.

## How to ship
Branch, deploy to a preview channel to review, PR into `develop`, merge,
`firebase deploy --only hosting --project localbc-41b52`, then tag.
Never deploy to production or push without the owner's say-so.
