# Weddings app: tasks

Companion: [state.md](state.md) (what exists now). Update both when work lands.

Live: https://localbc-41b52.web.app/weddings/  (v0.1, PR #78, tag `v0.1`)
Status key: [ ] open, [~] in progress, [x] done. Update this file as items finish.

## A. Blockers (do before any ad spend)

- [ ] **A1. Business name.** Pick the real name; replace "Wedding Planner" in the header,
      `<title>`, meta description and footer. Needs: name from owner.
- [ ] **A2. Logo / brand mark design.** Design a logo or monogram (SVG) in the invitation
      theme (maroon, gold, Kannada accent); use it in the header, favicon
      (`public/weddings/icons/icon.svg`) and theme colour. Depends on A1.
- [ ] **A3. Real phone and WhatsApp numbers.** Replace the placeholder `910000000000` in
      `public/weddings/js/config.js` (`CONTACT.phone`, `CONTACT.whatsapp`). Needs: numbers from owner.
- [ ] **A4. End-to-end lead test on the live site.** Submit a callback request, confirm it
      appears under Leads when signed in as the planner, change its status, then delete the test lead.
- [ ] **A5. Google Ads conversion tracking.** Fill `ADS` in `config.js` (conversion ID and
      label); confirm the conversion fires once per successful lead; check UTM/`gclid` is stored on the lead.
      Needs: Ads account details from owner.

## B. Should do soon

- [ ] **B1. Privacy policy page.** A standalone page (not the collapsed footer note),
      linked from the form and footer, covering name, phone, email, notes and ad source.
- [ ] **B2. Spam protection.** Review options beyond the honeypot and Firestore field rules;
      note that App Check enforcement would affect the chit-funds app.
- [ ] **B3. HTML caching.** Add a no-cache rule for HTML in `firebase.json` so deploys show up
      at once. It is a shared config, so ship it as its own PR (it affects chit funds too).
- [ ] **B4. Tablet and desktop check.** View the wide layouts; fix any problems.
- [ ] **B5. Kannada proofreading.** Have a native speaker check all Kannada text
      (ಶುಭ ವಿವಾಹ, ಕಾರ್ಯಕ್ರಮಗಳು, ceremony names, ಹೀಗೆ ನಡೆಯುತ್ತದೆ, ಶುಭಮಸ್ತು, Ganesha line).
- [ ] **B6. Real photos.** Replace Unsplash stock with the owner's own event photos when
      available; update `img/credits.json`; avoid implying stock images are past work.

## C. Nice to have

- [ ] **C1. Tap cue on service boxes** (they have no visible "get quote" hint now).
- [ ] **C2. Tidy CSS.** It has grown in layers; merge into one clean theme.
- [ ] **C3. Narrow the Firestore catch-all rule** (risky, separate change; see firestore.rules).
- [ ] **C4. Why-choose-us strip** and testimonials, only with real content.

## Release steps (each version)

1. Work on a branch; deploy to preview channel `design-preview` to review.
2. Open a PR into `develop`, merge, `firebase deploy --only hosting --project localbc-41b52`.
3. Tag the release (`v0.2`, ...).
