# Weddings app: current state

Last updated: 2026-11-01 (late). Tasks live in [task.md](task.md).

## What it is
Static landing page + lead capture for a wedding planner. Since 2026-11-01 it has its own Firebase
Hosting site `shivaleela-weddings` (same project `localbc-41b52`) that serves `public/weddings/` at `/`.
It shares only the Firebase project with the chit-funds app; code is separate under `public/weddings/`.
Customers (signed in or anonymous) request a callback or quotation; the planner
sees and manages leads after Google sign-in.

- Live (use this one, also the ad's final URL): https://shivaleela-weddings.web.app/
- Old path still works, with its canonical pointing at the new URL: https://localbc-41b52.web.app/weddings/
- Released: v0.1 (PR #78, git tag `v0.1`, deployed to hosting by hand from `develop` on 2026-10-29)
- Preview channel for review: `design-preview` (expires 2026-11-05),
  https://localbc-41b52--design-preview-qn6v6v5h.web.app/weddings/

## Code map (`public/weddings/`)
- `index.html`, `css/weddings.css` (layered; later rules override earlier ones), `js/`
  - `config.js` SERVICES (12), STATUSES, CONTACT (919901216122, edit here to change; the TODO comment above it is stale, the number is real), ADS (tag AW-11297900974 + conversion label), PLANNER_EMAIL
  - `main.js` hero, service grid, bottom-sheet form, submit, credits; opens the callback sheet on load when the URL has `?callback=1`
  - `leads.js` / `admin.js` lead create/read and the planner's Leads view
  - `firebase.js` imports `./firebase-config.js` (a weddings-only copy of the public Firebase web config; the hosting site root is `public/weddings`, so it cannot reach `../../firebase-config.js`; keep in sync with `public/firebase-config.js`)
  - `robots.txt`, `sitemap.xml` (home + /privacy/), canonical/Open Graph/Twitter/geo tags and JSON-LD `ProfessionalService` in `index.html`; section `#about` holds crawlable text (Kalaburagi intro, 12 services, 4 FAQs, one Kannada paragraph)
- `img/` service and hero photos (Unsplash) + `credits.json`; `img/orn/*.svg` custom ornament set
  (corner, frame, frieze2, divider, arch-frame, red-bg, bg)
- Asset URLs and CSS/JS carry `?v=N` cache-busters; bump them when changing files.
  HTML itself is cached ~1h by default (see task B3), so test with a fresh `?v=` URL.

## Hosting (since 2026-11-01, PRs #91, #92)
- `.firebaserc` targets: `main` = `localbc-41b52` (chit funds, root `public`, `/weddings/**` rewrite kept), `weddings` = `shivaleela-weddings` (root `public/weddings`). `firebase.json` has two hosting entries with the same cache headers (HTML no-cache, JS/CSS max-age 120).
- Plain `firebase deploy --only hosting` deploys both sites; to ship one use `--only hosting:weddings` or `--only hosting:main`.
- Preview without touching live: `firebase hosting:channel:deploy NAME --only weddings --expires 1d --project localbc-41b52`. Chrome caches a failed import, so test previews with the cache disabled or a fresh URL.
- Lesson: PR #91 shipped with `js/firebase.js` importing a file outside the new site root (404, broke all page JS on the new site); fixed in PR #92. Check every import and asset path against the site root.
- Custom domain: DuckDNS (`shivleela.duckdns.org`) was considered and dropped; the owner chose to keep `shivaleela-weddings.web.app`, which hides the project id in ads. A paid `.in` domain is still the stronger long-term option.

## Search visibility (PR #93, 2026-11-01)
Done in code: `robots.txt`, `sitemap.xml`, canonical, Open Graph/Twitter tags, Kalaburagi geo tags, local-intent title and description,
JSON-LD with the 12 services, crawlable `#about` section (about 530 words readable without JS). FAQ answers and the "nearby towns" wording are drafts to check against what the business offers.
Not done (owner): Google Business Profile, Google Search Console (add URL-prefix property, HTML-tag verification, submit the sitemap; ask Claude to add the tag), free listings (Justdial, Sulekha, WedMeGood, WeddingWire), reviews. A full Kannada version of the page does not exist.

## Google Ads state (`Leads-Search-1`, live since 2026-11-01)
- Budget ₹500/day, Maximise conversions, Kalaburagi, Search only. Funds ₹1,000 added 2026-11-01. 0 impressions so far (new campaign, tiny local search volume; Keyword Planner shows nearly all local terms at 0 to 100 a month).
- Ad final URL and sitelinks use `https://shivaleela-weddings.web.app/`. After the URL change the ad showed "1 of 1 under review".
- Sitelinks (Google needs 2, recommends 6): "Request a Callback" (campaign level, `/?callback=1`, opens the callback sheet) and "Our Services" (account level, `/#serviceGrid`). Both Pending review. The old sitelink with the `localbc-41b52` URL was removed.
- Keywords: 49 phrase-match keywords from Keyword Planner added via Ads Scripts (Tools > Bulk actions > Scripts) plus 14 campaign negatives; the script reported 1 error: "wedding set up companies" is missing. Broad matches the owner wanted are kept. In the UI a phrase keyword shows in quotes; the Match type column is the authority. Ineligible/low-volume keywords were removed.
- Images are not possible for this Search campaign (no image asset option; Asset Studio is AI generation only; auto-created assets are text only). Ad Preview and Diagnosis is blocked by Google's unusual-traffic CAPTCHA (owner solves it).
- Business name and logo assets are still removed so the ad can serve; re-add later.

## Design (v0.1)
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
- PR #80 HTML no-cache, #81 privacy page, #82 name + phone/WhatsApp +919901216122, #83/#84 SW logo and header lockup, #85 Google tag in head, #86 conversion label (ADS in config.js).
- PR #87 delete button on leads. PRs #91/#92 own hosting site + `?callback=1` + config import fix, PR #93 SEO. Google Ads campaign `Leads-Search-1` live since 2026-11-01 at ₹500/day, serving without business name and logo for now (see task.md A6); ads, assets and negatives are set in the Ads UI, not in the repo.

## Logo (A2, done: SW monogram)
Three option sets were drawn in the session scratchpad (not in repo). Set 3 (real typefaces as outlines,
distinct layouts: arch emblem, round badge, bold monogram, door panel, script, modern line) is the
current candidate set; owner has not picked yet. Rules: real display typefaces outlined, options must
differ in layout, divider, type and colour.

## Known gaps
See task.md. Main ones: ad not yet serving (0 impressions, under review), conversion not yet confirmed firing, search visibility steps outside the code not done, wide-screen layouts unchecked, Kannada unproofread.

## How to ship
Branch, deploy to a preview channel to review, PR into `develop`, merge,
`firebase deploy --only hosting:weddings,hosting:main --project localbc-41b52` (or one target), then tag.
Never deploy to production or push without the owner's say-so.
