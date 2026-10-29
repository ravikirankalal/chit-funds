// Wedding app entry: callback form, optional Google sign-in, "your requests",
// and (for the planner only) the lead list.

import { auth } from './firebase.js';
import {
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { SERVICES, ADS, PLANNER_EMAIL, CONTACT } from './config.js?v=2';
import { submitLead, watchMyLeads } from './leads.js';
import { icon } from './icons.js';
import { showAdmin, hideAdmin } from './admin.js';

const $ = function (id) { return document.getElementById(id); };
const form = $('leadForm');
const msg = $('formMsg');

// ---- Google Ads (only when configured) ----------------------------------
if (ADS.id) {
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ADS.id);
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', ADS.id);
}
function trackConversion() {
  if (ADS.id && ADS.conversionLabel && window.gtag) {
    window.gtag('event', 'conversion', { send_to: ADS.id + '/' + ADS.conversionLabel });
  }
}

// ---- Contact links -------------------------------------------------------
$('phoneLink').href = $('phoneLinkTop').href = 'tel:+' + CONTACT.phone;
$('waLink').href = 'https://wa.me/' + CONTACT.whatsapp;
document.querySelectorAll('.rsvp-call').forEach(function (a) { a.href = 'tel:+' + CONTACT.phone; });
document.querySelectorAll('.rsvp-wa').forEach(function (a) { a.href = 'https://wa.me/' + CONTACT.whatsapp; });

// ---- Icons, service tiles, "request callback" shortcuts -------------------
document.querySelectorAll('[data-ic]').forEach(function (n) { n.innerHTML = icon(n.dataset.ic); });
// The form opens as a bottom sheet over the page (no scrolling); it is moved
// back to its spot after the services grid when the sheet closes.
const sheet = $('sheet');
function openSheet() {
  $('sheetBody').appendChild(form);
  sheet.hidden = false;
  document.body.style.overflow = 'hidden';
  // Focus the panel, not a field: focusing an input would pop the keyboard open.
  $('sheetBody').parentNode.focus();
}
function closeSheet() {
  $('formSlot').appendChild(form);
  sheet.hidden = true;
  document.body.style.overflow = '';
}
function focusForm() { openSheet(); }
sheet.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeSheet(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
document.querySelectorAll('[data-focus-form]').forEach(function (a) {
  a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); focusForm(); });
});
// The whole hero is a tap target for "request a callback".
document.querySelector('.hero').addEventListener('click', focusForm);

SERVICES.forEach(function (s) {
  const t = document.createElement('button');
  t.type = 'button';
  t.className = 'tile';
  t.dataset.service = s.id;
  t.id = 'svc-' + s.id;
  const thumb = document.createElement('span');
  thumb.className = 'thumb';
  thumb.style.backgroundImage = 'url(img/' + s.id + '.jpg?v=3)';
  const cap = document.createElement('span');
  cap.className = 'cap';
  const name = document.createElement('b'); name.textContent = s.label;
  const blurb = document.createElement('small'); blurb.textContent = s.blurb || '';
  const go = document.createElement('em'); go.textContent = 'Get quote \u203A';
  cap.append(name, blurb, go);
  t.append(thumb, cap);
  t.setAttribute('aria-label', s.label + ' - get a quote');
  t.addEventListener('click', function () { pickService(s); });
  $('serviceGrid').appendChild(t);
});

// Photo credits (Unsplash API guidelines ask for photographer + Unsplash links).
fetch('img/credits.json').then(function (r) { return r.json(); }).then(function (list) {
  const p = $('credits');
  p.append('Photos on ');
  const u = document.createElement('a'); u.href = 'https://unsplash.com/?utm_source=wedding_planner&utm_medium=referral'; u.textContent = 'Unsplash';
  p.append(u, ' by ');
  list.forEach(function (c, i) {
    const a = document.createElement('a'); a.href = c.url; a.textContent = c.by; a.rel = 'noopener';
    p.append(a, i < list.length - 1 ? ', ' : '.');
  });
}).catch(function () {});

// ---- Service checkboxes --------------------------------------------------
const box = $('servicesBox');
SERVICES.forEach(function (s) {
  const label = document.createElement('label');
  const cb = document.createElement('input');
  cb.type = 'checkbox'; cb.name = 'service'; cb.value = s.id;
  const chip = document.createElement('span');
  chip.textContent = s.label;
  label.append(cb, chip);
  box.appendChild(label);
});
form.addEventListener('change', function (e) {
  if (e.target.name === 'interest') box.hidden = e.target.value !== 'selected';
});

// A tapped service tile pre-selects that service in the form and jumps to it.
function pickService(s) {
  form.elements.interest.value = 'selected';
  box.hidden = false;
  form.querySelectorAll('input[name=service]').forEach(function (cb) { if (cb.value === s.id) cb.checked = true; });
  const picked = $('picked');
  picked.hidden = false;
  picked.textContent = 'Quotation for: ' + form.querySelectorAll('input[name=service]:checked').length + ' service(s) selected. Add your number and we\'ll call you.';
  focusForm();
}

// ---- Submit --------------------------------------------------------------
function setMsg(text, kind) { msg.textContent = text; msg.className = 'msg ' + (kind || ''); }

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  const f = new FormData(form);
  if (f.get('website')) return; // honeypot tripped: pretend success, send nothing

  const name = String(f.get('name')).trim();
  const phone = String(f.get('phone')).trim();
  const interest = f.get('interest');
  const services = interest === 'selected' ? f.getAll('service') : [];
  if (name.length < 2) return setMsg('Please enter your name.', 'err');
  if (!/^[+]?[0-9 ()-]{7,20}$/.test(phone)) return setMsg('Please enter a valid phone number.', 'err');
  if (interest === 'selected' && !services.length) return setMsg('Pick at least one service.', 'err');

  const guests = f.get('guests') === '' ? null : parseInt(f.get('guests'), 10);
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  setMsg('Sending…');
  try {
    await submitLead({
      name, phone, interest, services,
      email: String(f.get('email')).trim(),
      city: String(f.get('city')).trim(),
      weddingDate: String(f.get('weddingDate')),
      guests: Number.isInteger(guests) ? guests : null,
      callbackTime: f.get('callbackTime'),
      notes: String(f.get('notes')).trim()
    }, auth.currentUser && auth.currentUser.uid);
    trackConversion();
    form.reset();
    box.hidden = true;
    form.querySelector('details').open = false;
    $('picked').hidden = true;
    setMsg('Thank you! We\'ll call you back soon.', 'ok');
    if (!sheet.hidden) setTimeout(closeSheet, 2500);
  } catch (err) {
    console.error(err);
    setMsg('Sorry, something went wrong. Please try again.', 'err');
  } finally {
    btn.disabled = false;
  }
});

// ---- Auth (optional) -----------------------------------------------------
const authBtn = $('authBtn');
authBtn.addEventListener('click', function () {
  if (auth.currentUser) signOut(auth);
  else signInWithPopup(auth, new GoogleAuthProvider()).catch(function (e) {
    if (e.code !== 'auth/popup-closed-by-user') setMsg('Sign-in failed. You can still request a callback without signing in.', 'err');
  });
});

let stopMine = null;
onAuthStateChanged(auth, function (user) {
  authBtn.textContent = user ? 'Sign out' : 'Sign in';
  if (stopMine) { stopMine(); stopMine = null; }
  $('mine').hidden = !user;
  if (user) {
    if (!form.elements.name.value) form.elements.name.value = user.displayName || '';
    if (!form.elements.email.value) form.elements.email.value = user.email || '';
    stopMine = watchMyLeads(user.uid, renderMine);
  }
  if (user && user.email === PLANNER_EMAIL) showAdmin(); else hideAdmin();
});

function renderMine(leads) {
  const ul = $('mineList');
  ul.replaceChildren();
  if (!leads.length) {
    const li = document.createElement('li');
    li.textContent = 'No requests yet.';
    ul.appendChild(li);
  }
  leads.forEach(function (l) {
    const li = document.createElement('li');
    const what = l.interest === 'full' ? 'Complete planning' : 'Services: ' + l.services.join(', ');
    const pill = document.createElement('span');
    pill.className = 'pill'; pill.textContent = l.status;
    li.append(document.createTextNode(what + ' '), pill);
    ul.appendChild(li);
  });
}
