#!/usr/bin/env node
// Finds a group by its exact `name` field and permanently deletes it,
// including every nested subcollection (months, months/payments,
// transferRequests). This is a real, irreversible production delete —
// it prompts for confirmation before touching anything.
//
// Usage:
//   node scripts/delete-group-by-name.js "sdlkfjsf"
//   node scripts/delete-group-by-name.js "sdlkfjsf" --yes   # skip the prompt

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const readline = require('readline');

const PROJECT_ID = 'localbc-41b52';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function request(method, url, token, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body !== undefined ? JSON.stringify(body) : undefined;
    const headers = { 'Authorization': 'Bearer ' + token };
    if (data !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, res => {
      let respBody = '';
      res.on('data', c => respBody += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(respBody ? JSON.parse(respBody) : {});
        } else {
          reject(new Error(method + ' ' + url + ' failed: ' + res.statusCode + ' ' + respBody));
        }
      });
    });
    req.on('error', reject);
    if (data !== undefined) req.write(data);
    req.end();
  });
}

function postForm(url, params) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(params).toString();
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(JSON.parse(body));
        else reject(new Error('Token refresh failed: ' + res.statusCode + ' ' + body));
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getAccessToken() {
  const cfgPath = path.join(os.homedir(), '.config/configstore/firebase-tools.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  // Firebase CLI's own public OAuth client (open-source firebase-tools constant, not a secret).
  const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
  const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';
  const resp = await postForm('https://oauth2.googleapis.com/token', {
    client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    refresh_token: cfg.tokens.refresh_token, grant_type: 'refresh_token'
  });
  return resp.access_token;
}

function idOf(docName) { return docName.split('/').pop(); }

async function findGroupsByName(token, name) {
  const resp = await request('POST', `${BASE}:runQuery`, token, {
    structuredQuery: {
      from: [{ collectionId: 'groups' }],
      where: { fieldFilter: { field: { fieldPath: 'name' }, op: 'EQUAL', value: { stringValue: name } } }
    }
  });
  return (Array.isArray(resp) ? resp : [resp])
    .filter(r => r.document)
    .map(r => ({ id: idOf(r.document.name), fields: r.document.fields }));
}

async function listCollectionIds(token, docPath) {
  const ids = [];
  let pageToken;
  do {
    const body = pageToken ? { pageToken } : {};
    const resp = await request('POST', `https://firestore.googleapis.com/v1/${docPath}:listCollectionIds`, token, body);
    ids.push(...(resp.collectionIds || []));
    pageToken = resp.nextPageToken;
  } while (pageToken);
  return ids;
}

async function listDocumentIds(token, collectionPath) {
  const ids = [];
  let pageToken;
  do {
    const q = pageToken ? `?pageSize=300&pageToken=${encodeURIComponent(pageToken)}` : '?pageSize=300';
    const resp = await request('GET', `https://firestore.googleapis.com/v1/${collectionPath}${q}`, token);
    for (const doc of (resp.documents || [])) ids.push(idOf(doc.name));
    pageToken = resp.nextPageToken;
  } while (pageToken);
  return ids;
}

let deletedCount = 0;

async function deleteRecursive(token, docPath) {
  const collIds = await listCollectionIds(token, docPath);
  for (const collId of collIds) {
    const collPath = `${docPath}/${collId}`;
    const docIds = await listDocumentIds(token, collPath);
    for (const id of docIds) {
      await deleteRecursive(token, `${collPath}/${id}`);
    }
  }
  await request('DELETE', `https://firestore.googleapis.com/v1/${docPath}`, token);
  deletedCount++;
}

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim().toLowerCase() === 'y'); }));
}

async function main() {
  const name = process.argv[2];
  const skipConfirm = process.argv.includes('--yes');
  if (!name) {
    console.error('Usage: node scripts/delete-group-by-name.js "<exact group name>" [--yes]');
    process.exit(1);
  }

  const token = await getAccessToken();
  const matches = await findGroupsByName(token, name);

  if (matches.length === 0) {
    console.log(`No group found with name "${name}".`);
    return;
  }

  console.log(`Found ${matches.length} group(s) named "${name}":`);
  for (const m of matches) console.log(`  - id: ${m.id}`);

  if (!skipConfirm) {
    const ok = await confirm(`\nPermanently delete ${matches.length} group(s) and all their months/payments/transferRequests? This cannot be undone. (y/N) `);
    if (!ok) { console.log('Aborted — nothing deleted.'); return; }
  }

  for (const m of matches) {
    const docPath = `projects/${PROJECT_ID}/databases/(default)/documents/groups/${m.id}`;
    await deleteRecursive(token, docPath);
    console.log(`Deleted group ${m.id} (${deletedCount} docs so far).`);
  }

  console.log(`Done. Deleted ${deletedCount} documents total.`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
