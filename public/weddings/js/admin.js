// Planner-only lead list. The email check here is UX only; firestore.rules
// is what actually restricts access.

import { watchAllLeads, updateLead } from './leads.js';
import { STATUSES } from './config.js';

const $ = function (id) { return document.getElementById(id); };
let stop = null;
let leads = [];

const filter = $('statusFilter');
STATUSES.forEach(function (s) {
  const o = document.createElement('option');
  o.value = s; o.textContent = s;
  filter.appendChild(o);
});
filter.addEventListener('change', render);

export function showAdmin() {
  $('admin').hidden = false;
  $('adminTools').hidden = false;
  stop = watchAllLeads(function (rows) { leads = rows; render(); }, function (err) {
    console.error(err);
    $('adminMsg').textContent = 'Could not load leads.';
    $('adminMsg').className = 'msg err';
  });
}

export function hideAdmin() {
  if (stop) { stop(); stop = null; }
  $('admin').hidden = true;
  $('leadList').replaceChildren();
}

function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}

function render() {
  const ul = $('leadList');
  ul.replaceChildren();
  const rows = leads.filter(function (l) { return !filter.value || l.status === filter.value; });
  if (!rows.length) ul.appendChild(el('li', 'No leads.'));
  rows.forEach(function (l) {
    const li = document.createElement('li');
    const when = l.createdAt && l.createdAt.toDate ? l.createdAt.toDate().toLocaleString() : '';
    const digits = String(l.phone).replace(/[^0-9]/g, '');
    li.append(
      el('strong', l.name), document.createTextNode(' '), el('span', l.status, 'pill'),
      el('div', [l.phone, l.city, l.email].filter(Boolean).join(' · '), 'meta'),
      el('div', (l.interest === 'full' ? 'Complete planning' : 'Services: ' + l.services.join(', ')) +
        (l.weddingDate ? ' · ' + l.weddingDate : '') + (l.guests != null ? ' · ' + l.guests + ' guests' : '') +
        ' · call ' + l.callbackTime, 'meta')
    );
    if (l.notes) li.appendChild(el('div', l.notes));
    if (l.source && Object.keys(l.source).length) li.appendChild(el('div', Object.entries(l.source).map(function (e) { return e.join('='); }).join(' '), 'meta'));
    li.appendChild(el('div', when, 'meta'));

    const actions = el('div', null, 'actions');
    const call = el('a', 'Call', 'btn small'); call.href = 'tel:' + l.phone.replace(/[^0-9+]/g, '');
    const wa = el('a', 'WhatsApp', 'btn small'); wa.href = 'https://wa.me/' + digits; wa.target = '_blank'; wa.rel = 'noopener';
    const sel = document.createElement('select');
    STATUSES.forEach(function (s) {
      const o = el('option', s); o.value = s; o.selected = s === l.status; sel.appendChild(o);
    });
    sel.addEventListener('change', function () { updateLead(l.id, { status: sel.value }); });
    const note = document.createElement('input');
    note.placeholder = 'Note'; note.maxLength = 500; note.value = l.plannerNote || '';
    note.addEventListener('change', function () { updateLead(l.id, { plannerNote: note.value }); });
    actions.append(call, wa, sel, note);
    li.appendChild(actions);
    ul.appendChild(li);
  });
}
