// Wedding app entry: callback form, optional Google sign-in, "your requests",
// and (for the planner only) the lead list.

import { auth } from './firebase.js';
import {
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { SERVICES, ADS, PLANNER_EMAIL, CONTACT } from './config.js';
import { submitLead, watchMyLeads } from './leads.js';
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
$('phoneLink').href = 'tel:+' + CONTACT.phone;
$('waLink').href = 'https://wa.me/' + CONTACT.whatsapp;

// ---- Service checkboxes --------------------------------------------------
const box = $('servicesBox');
SERVICES.forEach(function (s) {
  const label = document.createElement('label');
  const cb = document.createElement('input');
  cb.type = 'checkbox'; cb.name = 'service'; cb.value = s.id;
  label.append(cb, document.createTextNode(s.label));
  box.appendChild(label);
});
form.addEventListener('change', function (e) {
  if (e.target.name === 'interest') box.hidden = e.target.value !== 'selected';
});

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
    setMsg('Thank you! We\'ll call you back soon.', 'ok');
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
