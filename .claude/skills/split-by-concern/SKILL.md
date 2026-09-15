---
name: split-by-concern
description: "Split a single overgrown plain-JS file in this repo (Chit Funds — no build step, plain ES modules loaded directly by the browser) into a folder of small, cohesive sibling files plus a README.md explaining the structure. Use this whenever the user asks to refactor, split, break up, or reorganize a file for maintainability — or whenever you notice a file is a refactor candidate yourself: as a rough smell, 400+ lines or a double-digit function count sharing one file. Applies to ANY file shape, not just view/render files — flat utility/action files (e.g. actions.js) split the same way, grouped by what changed together rather than by UI section. Also use when asked to do 'the same refactor as monthDetail.js' or 'the same thing we did for groupDetail.js' to another file — that phrase means: apply this skill."
---

# Split a heavy file into a folder by concern

This captures the exact refactor already proven on `public/js/views/monthDetail.js`
(619 lines / 19 functions → `public/js/views/monthDetail/` — 9 files + a README).
It is a pure structural move: same functions, same comments, same behavior —
only which file each one lives in, and how they import each other, changes.
Never rewrite logic while doing this; if you spot an actual bug along the way,
mention it separately rather than folding a fix into this refactor.

## Why this matters here specifically

This app has **no build step** — `public/index.html` loads `js/main.js` as a
real `<script type="module">`, which imports other files by their literal
relative path, which the browser fetches directly over HTTP. There is no
bundler to paper over a wrong path or a forgotten preload — a mistake here is
a blank screen or a console error, not a build failure caught in CI. That's
why the steps below are pedantic about import paths and about the two exact
places outside the target file that need updating.

## Step 1 — Read the whole target file first

Don't start splitting while skimming. Read every function, and for each one
note: what does it operate on, and what other functions in the same file does
it call or share state/helpers with? You're looking for natural clusters —
groups of functions a reader would look for together, and that tend to change
together when a feature in that area changes.

Two shapes come up in this codebase; both use the same folder structure:

- **A view file** (`public/js/views/*.js`) — cluster by *what section of the
  screen it renders*. `monthDetail.js`'s clusters were: the summary card, the
  tabbed payment list, the winner card + picker, the payout card + modal, the
  payment detail modal, hand-off request cards, the floating transfer bar —
  plus a `shared.js` for small helpers (a `signed()` formatter, a timeline
  row) used across more than one of those.
- **A flat action/utility file** (e.g. `public/js/actions.js`) — cluster by
  *what entity or feature the functions operate on*, not by screen. For
  actions.js specifically, expect clusters roughly like: group
  creation/editing, member management, payment recording, winner/payout
  actions, transfer/hand-off actions, auth/session actions — plus a
  `shared.js` for cross-cutting helpers (validation, common Firestore
  update patterns) used by more than one cluster.

A cluster becomes its own file. If a "cluster" is really one function that
doesn't share anything with its neighbors, it can stay tiny — don't force
files to hit a size target. The failure mode to avoid is the opposite one:
splitting so finely that files end up importing heavily from three or four
siblings each. If you find yourself doing that, the boundaries are wrong —
merge those clusters back together. Cohesion beats a line-count target.

## Step 2 — Lay out the folder

For a target file at `path/to/name.js`, create `path/to/name/` containing:

- **`index.js`** — the orchestrator. Re-exports/contains only the top-level
  entry point(s) that outside code already imports (e.g. `renderX` for a
  view, or nothing extra for a pure action file — see the note below). It
  imports from every sibling file but no sibling imports from it.
- **`shared.js`** — small helpers used by more than one sibling. Imports
  nothing from other siblings — it's the dependency floor everything else
  can sit on.
- **One file per cluster** from Step 1, named for what it contains
  (`summary.js`, `paymentList.js`, `groupCreation.js`, `transfers.js`, ...).
  These may import `shared.js` and app-wide modules, but never each other —
  if `payout.js` needs something from `winner.js`, that's a sign the shared
  piece belongs in `shared.js` instead.
- **`README.md`** — see Step 5.

**If the target file has many independent top-level exports** (true of an
actions.js-shaped file, where callers import a dozen different named
functions directly rather than one entry point), `index.js` doesn't need to
re-export everything — it's fine for external code to import a specific
action straight from `path/to/name/transfers.js` if that's clearer. Use
judgment: keep `index.js` as the orchestrator for anything that genuinely
has one conceptual entry point, and skip it (or keep it minimal) when the
file is really just a flat bag of siblings with no natural "main" function.
Either way, every file that used to live in `name.js` needs a new home, and
nothing should still be reachable only through a deleted file.

## Step 3 — Move code verbatim

Copy each function to its new file with its existing comments intact —
don't rewrite, don't "improve" while moving, don't drop a comment because it
seems obvious to you right now (it wasn't obvious to whoever wrote it).
Add only the import statements each file actually needs, using real relative
paths from the new, one-level-deeper location (e.g. `../helpers.js` becomes
`../../helpers.js` when the file moves from `views/name.js` into
`views/name/cluster.js`).

Run `node --check` on every new file as you go, not just at the end — it's
cheap and catches a typo'd import immediately instead of after ten more
files are written.

## Step 4 — Update the two places outside the folder, then grep for the rest

Exactly two places reference a view's entry file by path and must be
updated:

1. Wherever it's imported for rendering — currently `public/js/render.js`.
   Change the import path to point at the new `index.js`.
2. `public/index.html`'s `<link rel="modulepreload" href="...">` list —
   delete the old single-file line, add one `modulepreload` line per new
   file in the folder (this is a perf hint, not required for correctness,
   but every other view file already gets one line per file — match that).

An action file with many named exports may have **many** more call sites
than a view's one render function — find them all with a repo-wide grep for
the old import path (e.g. `grep -rn "actions\.js" public/` for the file's
own name, not just from render.js/index.html) and update each one to import
from the new location. Prefer importing straight from the specific sibling
file where the function now lives, matching how the rest of the app already
imports narrowly rather than through a single barrel file.

Then, separately, grep the whole repo for the **old path as text**, e.g.:

```bash
grep -rn "views/monthDetail\.js\|actions\.js" public/ --include="*.js" --include="*.html"
```

This catches two different things: any import you missed, and stale
**comments** elsewhere pointing at the old file (`// see renderX in
monthDetail.js`). Both need fixing — a comment pointing at a deleted file
is actively misleading to the next person. Update the path in place; don't
delete the comment just because it's inconvenient.

Finally, delete the original file — don't leave it behind as a shim or
compatibility layer. There's no build step to break here, but a stale
duplicate would be quietly wrong and worse than no fallback at all.

## Step 5 — Write the README

Drop a `README.md` in the new folder (this is real markdown, never imported
by the app — it exists purely for the next reader). Base it on
[`public/js/views/monthDetail/README.md`](../../../public/js/views/monthDetail/README.md),
which has:

- A one-paragraph "why this is a folder" intro.
- A table: file → what it exports → its responsibility, one row per file.
- A "dependency direction" paragraph stating the same rule as Step 2
  (index.js → siblings → shared.js, no sibling-to-sibling imports) so a
  reader adding a new file knows where it's allowed to import from.
- A "where do I make my change?" lookup — one line per likely kind of
  change, pointing at the file to edit. This is the part people actually
  use; don't skip it even under time pressure.
- A short "adding a new file" note covering the same two external
  registration points from Step 4, with relative links to them, so nobody
  has to rediscover that requirement by trial and error.

## Step 6 — Verify

1. `node --check` on every new and touched file (including `render.js` /
   whatever else you edited) — do this even though you already checked each
   file as you wrote it; a final sweep catches anything edited afterward.
2. Live-verify in the browser against the **local Firebase emulator** —
   never production. Check it's already running first (`curl -s -o /dev/null
   -w "%{http_code}" http://localhost:5050`); this app's convention is to
   leave it running persistently across a whole session, so don't stop or
   restart it if it's already up. If it's down, start it with
   `scripts/dev-emulator.sh up`.
3. To sign in, run `scripts/dev-emulator.sh signin` and paste its **actual
   printed output** verbatim into the browser console (substituting the
   `EMAIL` for whichever admin fits the screen you're testing) — do not
   reconstruct the snippet from memory. The script pins the exact Firebase
   SDK CDN version this app currently imports; retyping it from memory has
   previously used a stale/wrong version and failed with a confusing
   `getApp()`/`no-app` error that has nothing to do with the refactor.
   `scripts/dev-emulator.sh seed` loads a demo fixture if the emulator is
   empty.
4. If a page you just edited doesn't reflect the change after reloading,
   suspect the browser's HTTP cache before suspecting your code — this app's
   `index.html` and `firebase-config.js` have been served stale from cache
   before. Force a fresh fetch of the specific stale URL
   (`fetch(url, {cache: 'reload'})`) via the browser's JS console/tool, then
   reload normally, rather than assuming the edit didn't take.
5. Exercise every screen/flow that touches the refactored code, not just
   the first one you think of — for a view file that's every render branch
   (loading/open/closed/empty states, every modal); for an action file
   that's every UI action that calls into it.

## What "done" looks like

- `git status` shows the old file deleted, the new folder added, and only
  the necessary call-site files modified — nothing else.
- A diff of any moved function against its original is empty except for
  indentation/import changes.
- The repo-wide grep from Step 4 comes back clean.
- The new README's "where do I make my change?" table, read cold, would let
  someone find the right file without opening every sibling to check.
