// Wedding app entry: callback form, optional Google sign-in, "your requests",
// and (for the planner only) the lead list.

import { auth } from './firebase.js';
import {
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { SERVICES, ADS, PLANNER_EMAIL, CONTACT } from './config.js?v=5';
import { submitLead, watchMyLeads } from './leads.js?v=2';
import { icon } from './icons.js';
import { showAdmin, hideAdmin } from './admin.js?v=2';

const $ = function (id) { return document.getElementById(id); };
const form = $('leadForm');
const msg = $('formMsg');

// ---- Google Ads (only when configured) ----------------------------------
// The Google tag itself is in index.html <head> so Google can detect it; load it here only as a fallback.
if (ADS.id && !window.gtag) {
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
let closeTimer = 0;
function openSheet() {
  clearTimeout(closeTimer);
  sheet.classList.remove('closing');
  $('sheetBody').appendChild(form);
  sheet.hidden = false;
  document.body.style.overflow = 'hidden';
  // Focus the panel, not a field: focusing an input would pop the keyboard open.
  $('sheetBody').parentNode.focus();
}
function closeSheet() {
  if (sheet.hidden || sheet.classList.contains('closing')) return;
  sheet.classList.add('closing');
  document.body.style.overflow = '';
  closeTimer = setTimeout(function () {
    $('formSlot').appendChild(form);
    sheet.hidden = true;
    sheet.classList.remove('closing');
    resetForm();
  }, 210);
}
// Back to a clean form (after a success view, or when the sheet is dismissed).
function resetForm() {
  form.classList.remove('is-done');
  sheet.classList.remove('done');
  setMsg('');
  $('failActions').hidden = true;
  form.querySelectorAll('.invalid').forEach(clearInvalid);
}
function focusForm() { openSheet(); }
sheet.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeSheet(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
document.querySelectorAll('[data-focus-form]').forEach(function (a) {
  a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); focusForm(); });
});
// The whole hero is a tap target for "request a callback".
document.querySelector('.hero').addEventListener('click', focusForm);
// Ad sitelink "Request a Callback" lands on /?callback=1 and opens the form at once.
if (new URLSearchParams(location.search).get('callback') === '1') openSheet();

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

// Inline field errors: red border, small message under the field, gentle shake.
function markInvalid(input, text) {
  const label = input.closest('label');
  input.classList.add('invalid');
  input.setAttribute('aria-invalid', 'true');
  let note = label.querySelector('.field-err');
  if (!note) { note = document.createElement('span'); note.className = 'field-err'; note.setAttribute('role', 'alert'); label.appendChild(note); }
  note.textContent = text;
  label.classList.remove('shake'); void label.offsetWidth; label.classList.add('shake');
}
function clearInvalid(input) {
  input.classList.remove('invalid');
  input.removeAttribute('aria-invalid');
  const note = input.closest('label') && input.closest('label').querySelector('.field-err');
  if (note) note.remove();
}
form.addEventListener('input', function (e) { if (e.target.classList && e.target.classList.contains('invalid')) clearInvalid(e.target); });

function shakeForm() { form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); }

const submitBtn = form.querySelector('button[type=submit]');
function setSending(on) {
  submitBtn.disabled = on;
  submitBtn.classList.toggle('loading', on);
  submitBtn.querySelector('.lbl').textContent = on ? 'Sending…' : 'Request callback / quote';
}

// Marigold petals drift down over the page when a request goes through.
function celebrate() {
  if (navigator.vibrate) navigator.vibrate([30, 50, 70]);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const host = document.createElement('div');
  host.className = 'confetti';
  host.setAttribute('aria-hidden', 'true');
  const colors = ['#d9962b', '#e8821a', '#9c1c1a', '#f1d58a', '#c4560f', '#3e6b32'];
  for (let i = 0; i < 38; i++) {
    const p = document.createElement('i');
    p.className = 'petal';
    p.style.cssText = '--x:' + (Math.random() * 100).toFixed(1) + '%;--s:' + (6 + Math.random() * 7).toFixed(1) + 'px;--c:' + colors[i % colors.length] +
      ';--d:' + (2.8 + Math.random() * 2).toFixed(2) + 's;--w:' + (0.5 + Math.random() * 1.1).toFixed(2) + 's;--dx:' + ((Math.random() - 0.5) * 180).toFixed(0) + 'px;--r:' + (Math.random() * 720 - 360).toFixed(0) + 'deg';
    host.appendChild(p);
  }
  document.body.appendChild(host);
  setTimeout(function () { host.remove(); }, 6000);
}

function showSuccess(name, phone, when) {
  $('resName').textContent = name.split(' ')[0];
  $('resText').innerHTML = '';
  const t = document.createElement('span');
  t.textContent = 'We\'ll call you on ';
  const b = document.createElement('b'); b.textContent = phone;
  const w = document.createElement('span');
  w.textContent = when === 'anytime' ? ' soon.' : ' this ' + when + '.';
  $('resText').append(t, b, w);
  // Same promise in Kannada, matched to the chosen call time.
  const knWhen = { morning: 'ಬೆಳಿಗ್ಗೆ', afternoon: 'ಮಧ್ಯಾಹ್ನ', evening: 'ಸಂಜೆ' };
  $('resKn').textContent = knWhen[when] ? 'ನಾವು ' + knWhen[when] + ' ನಿಮಗೆ ಕರೆ ಮಾಡುತ್ತೇವೆ.' : 'ನಾವು ಶೀಘ್ರದಲ್ಲೇ ನಿಮಗೆ ಕರೆ ಮಾಡುತ್ತೇವೆ.';
  form.classList.add('is-done');
  sheet.classList.add('done');
  celebrate();
  const r = $('formResult');
  r.classList.remove('play'); void r.offsetWidth; r.classList.add('play');
  r.focus({ preventScroll: true });
  r.scrollIntoView({ block: 'nearest' });
}
$('resDone').addEventListener('click', function () {
  if (!sheet.hidden) closeSheet(); else resetForm();
});

function withTimeout(p, ms) {
  return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej({ code: 'deadline-exceeded' }); }, ms); })]);
}

function failureText(err) {
  if (!navigator.onLine || (err && (err.code === 'unavailable' || err.code === 'deadline-exceeded'))) return 'We could not reach the server. Check your connection and try again, or call or WhatsApp us.';
  if (err && err.code === 'permission-denied') return 'We could not save your request right now. Please call or WhatsApp us and we will help at once.';
  return 'Sorry, something went wrong. Please try again, or call or WhatsApp us.';
}

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  const f = new FormData(form);
  if (f.get('website')) return; // honeypot tripped: pretend success, send nothing

  form.querySelectorAll('.invalid').forEach(clearInvalid);
  setMsg('');
  $('failActions').hidden = true;

  const name = String(f.get('name')).trim();
  const phone = String(f.get('phone')).trim();
  const interest = f.get('interest');
  const services = interest === 'selected' ? f.getAll('service') : [];
  let firstBad = null;
  if (name.length < 2) { markInvalid(form.elements.name, 'Please enter your name.'); firstBad = firstBad || form.elements.name; }
  if (!/^[+]?[0-9 ()-]{7,20}$/.test(phone)) { markInvalid(form.elements.phone, 'Enter a valid phone number, digits only.'); firstBad = firstBad || form.elements.phone; }
  if (interest === 'selected' && !services.length) { setMsg('Pick at least one service.', 'err'); shakeForm(); return; }
  if (firstBad) { firstBad.focus(); return; }

  const guests = f.get('guests') === '' ? null : parseInt(f.get('guests'), 10);
  if (!navigator.onLine) { setMsg(failureText(null), 'err'); $('failActions').hidden = false; shakeForm(); return; }
  setSending(true);
  try {
    // Firestore waits for the server forever when the network is bad, so give up after 15s.
    await withTimeout(submitLead({
      name, phone, interest, services,
      email: String(f.get('email')).trim(),
      city: String(f.get('city')).trim(),
      weddingDate: String(f.get('weddingDate')),
      guests: Number.isInteger(guests) ? guests : null,
      callbackTime: f.get('callbackTime'),
      notes: String(f.get('notes')).trim()
    }, auth.currentUser && auth.currentUser.uid), 15000);
    trackConversion();
    const when = f.get('callbackTime');
    form.reset();
    box.hidden = true;
    form.querySelector('details').open = false;
    $('picked').hidden = true;
    showSuccess(name, phone, when);
  } catch (err) {
    console.error(err);
    setMsg(failureText(err), 'err');
    $('failActions').hidden = false;
    shakeForm();
    if (navigator.vibrate) navigator.vibrate(120);
  } finally {
    setSending(false);
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
