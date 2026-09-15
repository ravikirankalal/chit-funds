#!/usr/bin/env node
// Alters the app's fixed admin roster (ADMINS.A / ADMINS.B / SUPER_ADMIN).
//
// Admins are NOT Firestore documents — they're hardcoded by email in two
// places that must stay in sync: public/firebase-config.js (client config)
// and firestore.rules (server-side enforcement, which can't import the
// config file). This script edits both together so they never drift.
//
// Usage — pass only the fields you want to change, e.g. just Ramesh's email:
//   node scripts/manage-admins.js --a-email new-ramesh@gmail.com
//
// Full example (changes all three identities):
//   node scripts/manage-admins.js \
//     --a-email ramesh@gmail.com    --a-name Ramesh \
//     --b-email suresh@gmail.com    --b-name Suresh \
//     --super-email admin@gmail.com --super-name Ravikiran
//
// Add --deploy to run `firebase deploy --only hosting,firestore:rules`
// immediately after editing (omit it to review the diff / commit first).

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'public/firebase-config.js');
const RULES_PATH = path.join(ROOT, 'firestore.rules');
const PROJECT_ID = 'localbc-41b52';

function parseArgs(argv) {
  const out = { deploy: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--deploy') { out.deploy = true; continue; }
    const m = a.match(/^--([a-z-]+)$/);
    if (!m) throw new Error('Unrecognized argument: ' + a);
    const key = m[1];
    const value = argv[++i];
    if (value === undefined) throw new Error('Missing value for --' + key);
    out[key] = value;
  }
  return out;
}

function readCurrent(configSrc) {
  const aEmail = configSrc.match(/A:\s*\{\s*email:\s*"([^"]+)",\s*name:\s*"([^"]+)"/);
  const bEmail = configSrc.match(/B:\s*\{\s*email:\s*"([^"]+)",\s*name:\s*"([^"]+)"/);
  const superEmail = configSrc.match(/SUPER_ADMIN\s*=\s*\{\s*email:\s*"([^"]+)",\s*name:\s*"([^"]+)"/);
  if (!aEmail || !bEmail || !superEmail) throw new Error('Could not parse public/firebase-config.js — its ADMINS/SUPER_ADMIN shape may have changed; update this script to match.');
  return {
    'a-email': aEmail[1], 'a-name': aEmail[2],
    'b-email': bEmail[1], 'b-name': bEmail[2],
    'super-email': superEmail[1], 'super-name': superEmail[2]
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const configSrc = fs.readFileSync(CONFIG_PATH, 'utf8');
  const rulesSrc = fs.readFileSync(RULES_PATH, 'utf8');

  const current = readCurrent(configSrc);
  const next = Object.assign({}, current, args);

  const hasChange = Object.keys(current).some(k => current[k] !== next[k]);
  if (!hasChange) {
    console.log('No changes requested — pass --a-email / --a-name / --b-email / --b-name / --super-email / --super-name.');
    return;
  }

  console.log('Changes:');
  for (const k of Object.keys(current)) {
    if (current[k] !== next[k]) console.log('  ' + k + ': ' + current[k] + '  ->  ' + next[k]);
  }

  let newConfig = configSrc
    .replace(/A:\s*\{\s*email:\s*"[^"]+",\s*name:\s*"[^"]+"\s*\}/, `A: { email: "${next['a-email']}", name: "${next['a-name']}" }`)
    .replace(/B:\s*\{\s*email:\s*"[^"]+",\s*name:\s*"[^"]+"\s*\}/, `B: { email: "${next['b-email']}", name: "${next['b-name']}" }`)
    .replace(/SUPER_ADMIN\s*=\s*\{\s*email:\s*"[^"]+",\s*name:\s*"[^"]+"\s*\}/, `SUPER_ADMIN = { email: "${next['super-email']}", name: "${next['super-name']}" }`);
  fs.writeFileSync(CONFIG_PATH, newConfig);

  // isFinancialAdmin() checks A's and B's emails; isSuperAdmin() checks the
  // super admin's email. Rebuild both lists from the new values so a
  // shared email (e.g. B doubling as super admin) still dedupes correctly.
  const financialEmails = Array.from(new Set([next['a-email'], next['b-email']]));
  let newRules = rulesSrc
    .replace(/(request\.auth\.token\.email in \[)[^\]]+(\])/, `$1${financialEmails.map(e => `'${e}'`).join(', ')}$2`)
    .replace(/(request\.auth\.token\.email == )'[^']+'/, `$1'${next['super-email']}'`);
  fs.writeFileSync(RULES_PATH, newRules);

  console.log('\nUpdated public/firebase-config.js and firestore.rules.');
  console.log('Review with: git diff');

  if (args.deploy) {
    console.log('\nDeploying...');
    execSync(`firebase deploy --only hosting,firestore:rules --project ${PROJECT_ID}`, { stdio: 'inherit', cwd: ROOT });
  } else {
    console.log('Not deployed — rerun with --deploy, or commit and deploy manually:');
    console.log(`  firebase deploy --only hosting,firestore:rules --project ${PROJECT_ID}`);
  }
}

main();
