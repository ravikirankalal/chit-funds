# Weddings app: tasks

Companion: [state.md](state.md) (what exists now). Update both when work lands.

Live: https://shivaleela-weddings.web.app/  (own hosting site; old path https://localbc-41b52.web.app/weddings/ still works; v0.1, PR #78, tag `v0.1`)
Status key: [ ] open, [~] in progress, [x] done. Update this file as items finish.

## A. Blockers (do before any ad spend)

- [x] **A1. DONE: "Shivaleela Weddings" (2026-11-01).** Replaced "Wedding Planner" in the header,
      `<title>`, meta description and footer. Needs: name from owner.
- [x] **A2. Logo DONE 2026-11-01:** bold SW monogram (option 3) in header, favicon, `img/logo/`. Lockups (`lockup*.svg`) exist for later use; not yet used elsewhere. Design a logo or monogram (SVG) in the invitation
      theme (maroon, gold, Kannada accent); use it in the header, favicon
      (`public/weddings/icons/icon.svg`) and theme colour. Depends on A1.
- [x] **A3. DONE: +91 99012 16122 (2026-11-01), change in config.js.** Replaced placeholder `910000000000` in
      `public/weddings/js/config.js` (`CONTACT.phone`, `CONTACT.whatsapp`). Needs: numbers from owner.
- [x] **A4. End-to-end lead test on the live site.** DONE 2026-11-01: anonymous create accepted by the
      rules; anonymous read/list/delete refused (403); a real form submit from the live page worked and the
      planner can see the lead in Leads after sign-in. NOT CONFIRMED: status change confirmed working; delete button added (PR below) so the "Test Ads" lead can be removed.
- [~] **A5. Google Ads conversion tracking.** DONE 2026-11-01: tag `AW-11297900974` in the page head, conversion
      "Callback request" created, label set in `config.js`, deployed (PRs #85, #86). WAITING: first conversion to show in
      Ads (status Inactive until then, can take hours); enhanced conversions left to the owner; GSTIN billing banner unresolved.
- [~] **A6. Google Ads Search campaign `Leads-Search-1`.** PUBLISHED 2026-11-01 (Search network only, Kalaburagi city,
      location option "Presence", Maximise conversions, **₹500/day**, English/Hindi + 2 more). Keywords: phrase match incl. Gulbarga/Kalaburagi
      variations; 16 campaign-level negatives (e.g. birthday, cheap, course, download, dress, free, job, jewellery, "invitation card printing").
      Assets on campaign: 4 callouts (Venue & Decor, Catering & Photography, Bridal Makeup & Mehendi, Book Only What You Need); no sitelinks
      (one landing page). Landing page: `/weddings/`. The Call asset (+91 99012 16122) vanished by itself and the owner does NOT want a call button.
      2026-11-01 review: 8 of the 20 Gulbarga/Kalaburagi keywords were eligible, 12 "Low search volume" (removed); added 4 broader phrase-match keywords
      ("wedding planner", "wedding planners near me", "wedding event management", "wedding planning services"); location targeting keeps them local.
      Settings audit clean (Kalaburagi only, all-day schedule, no bid adjustments, score 95%). Skip Google's suggestions to opt in to search partners,
      Display Expansion and broad match until there is conversion data.
      LIVE: the ad's headlines and descriptions passed review (Eligible). 2026-11-01 the owner had the business name and SW logo REMOVED from the
      campaign (still in the asset library) because they were stuck in review and held the campaign; afterwards diagnostics changed from "pending
      policy review" to "still learning", Advisor says eligible (impressions were still 0 at that time). TO DO later: re-add the business name
      "Shivaleela Weddings" and the logo (PNGs in the phone's Pictures folder: shivaleela-logo-square-1200.png, shivaleela-logo-landscape-1200x300.png).
      Images: no Image asset option exists for this Search campaign/account (menu and ad editor offer only logo, sitelinks, promotions, prices,
      messages, snippets, lead forms, callouts, apps). Stock photos (Unsplash licence, cropped 1200x628 and 1200x1200, six subjects) are ready as
      `sw-ad-*.jpg` in the phone's Pictures folder; retry once the account has history.
      OPEN: remove "Call Now"/"Call Us Now" headlines from the ad; find and remove the stray "Bengaluru, 52 Sai Baba Temple Rd" location shown in the
      ad preview (not the owner's); GSTIN banner (owner); delete the "Test Ads" lead; first conversion. Kannada ad generation is unavailable in Ads.
      Review the search-terms report after a few days and add negatives. Rule from owner: never disconnect adb.
      2026-11-01 LATER: funds ₹1,000 added; ad final URL moved to https://shivaleela-weddings.web.app/ (ad "under review" again); 49 phrase keywords + 14
      negatives added with an Ads Script (1 error: "wedding set up companies" missing, add it); sitelinks "Request a Callback" (campaign, `/?callback=1`) and
      "Our Services" (account, `/#serviceGrid`) added, both pending, old sitelink with the project-id URL removed; Ad Preview blocked by CAPTCHA (owner);
      images confirmed impossible for this campaign. Decide: lower budget ₹500 to about ₹200 (Kalaburagi volume is tiny); add 4 more sitelinks (6 recommended);
      re-add business name and logo; review the search-terms report; first impressions and first conversion.

## A7. Own hosting site (DONE 2026-11-01)
- [x] Second Hosting site `shivaleela-weddings` serving `public/weddings` at `/` (PR #91), weddings-only `js/firebase-config.js` fixing a 404 that broke the page JS (PR #92), `/?callback=1` opens the callback sheet (PR #92). Keep `js/firebase-config.js` in sync with `public/firebase-config.js`.
- [ ] Optional: buy a `.in` domain and connect it to the `shivaleela-weddings` site (DuckDNS was dropped).

## A8. Search visibility without ads
- [x] In code (PR #93): robots.txt, sitemap.xml, canonical, Open Graph/Twitter, geo tags, JSON-LD, crawlable Kalaburagi section with FAQ, Kannada paragraph.
- [ ] Owner: check the FAQ and "nearby towns" wording is true for the business.
- [ ] Owner: Google Business Profile (verification by Google; biggest factor for "near me" and Maps).
- [ ] Owner: Google Search Console, URL-prefix property for https://shivaleela-weddings.web.app/ with the HTML-tag method; Claude adds the tag, then submit sitemap.xml.
- [ ] Owner: free listings (Justdial, Sulekha, WedMeGood, WeddingWire) with identical name and phone; ask clients for Google reviews; share the link on Instagram, Facebook, WhatsApp Business.
- [ ] Later: a Kannada version of the page; real photos (B6) for image search.

## B. Should do soon

- [x] **B1. Privacy policy page.** Added `public/weddings/privacy/index.html` (PR pending). Owner to read it; add business name and contact once known.
- (was) B1: A standalone page (not the collapsed footer note),
      linked from the form and footer, covering name, phone, email, notes and ad source.
- [ ] **B2. Spam protection.** Reviewed: nothing more to do without a Blaze-plan Cloud Function or App Check enforcement; watch lead quality instead.
- (was) B2: Review options beyond the honeypot and Firestore field rules;
      note that App Check enforcement would affect the chit-funds app.
- [~] **B3. HTML caching.** Separate PR `hosting-html-no-cache` (affects both apps); verified on a preview channel.
- (was) B3: Add a no-cache rule for HTML in `firebase.json` so deploys show up
      at once. It is a shared config, so ship it as its own PR (it affects chit funds too).
- [ ] **B4. Tablet and desktop check.** Not possible from the phone-only setup; needs a browser on a larger screen.
- (was) B4: View the wide layouts; fix any problems.
- [ ] **B5. Kannada proofreading.** Have a native speaker check all Kannada text
      (ಶುಭ ವಿವಾಹ, ಕಾರ್ಯಕ್ರಮಗಳು, ceremony names, ಹೀಗೆ ನಡೆಯುತ್ತದೆ, ಶುಭಮಸ್ತು, Ganesha line).
- [ ] **B6. Real photos.** Replace Unsplash stock with the owner's own event photos when
      available; update `img/credits.json`; avoid implying stock images are past work.

## C. Nice to have

- [ ] **C1. Tap cue on service boxes** (they have no visible "get quote" hint now).
- [ ] **C2. Tidy CSS (backlog, owner confirmed 2026-11-01).** It has grown in layers (many ?v= revisions); merge into one clean theme without changing the look.
- [ ] **C3. Narrow the Firestore catch-all rule** (risky, separate change; see firestore.rules).
- [ ] **C4. Why-choose-us strip** and testimonials, only with real content.

## Release steps (each version)

1. Work on a branch; deploy to preview channel `design-preview` to review.
2. Open a PR into `develop`, merge, `firebase deploy --only hosting:weddings,hosting:main --project localbc-41b52` (previews: `firebase hosting:channel:deploy NAME --only weddings --expires 1d`).
3. Tag the release (`v0.2`, ...).
