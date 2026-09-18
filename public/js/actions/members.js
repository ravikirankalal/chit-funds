import {
  doc, updateDoc, addDoc, collection, serverTimestamp, writeBatch, arrayUnion, arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { db } from '../firebase.js';
import { state, groupsById, membersById } from '../store.js';
import { isSuper } from '../helpers.js';
import { memberHasPaidInGroup } from '../finance/membership.js';
import { pushNav } from '../router.js';
import { render } from '../render.js';
import { setBusy } from './shared.js';

// The shared member directory + adding an existing person to another
// group — both independent of any single group's creation flow.
export function openMemberForm(id) {
  if (isSuper()) return;
  // Editing an existing member is never gated — only starting a brand-new
  // one is, so the config/app addMemberEnabled toggle (see store.js) can't
  // be bypassed by an overlay left open from before it was flipped off or a
  // direct console call, matching this app's other config-gated actions.
  if (!id && !state.config.addMemberEnabled) return;
  var existing = id ? membersById.get(id) : null;
  state.ui.memberForm = { id: id || null, name: existing ? existing.name : '' };
  render();
  pushNav();
}
export function closeMemberForm() { history.back(); }

export async function saveMemberForm() {
  if (isSuper()) return;
  var mf = state.ui.memberForm;
  if (!mf) return;
  if (!mf.id && !state.config.addMemberEnabled) return;
  var name = (mf.name || '').trim();
  if (!name) return;
  setBusy(true);
  try {
    if (mf.id) await updateDoc(doc(db, 'members', mf.id), { name: name });
    else await addDoc(collection(db, 'members'), { name: name, createdAt: serverTimestamp() });
    // openMemberForm() pushed a nav entry for this overlay; pop it via
    // history.back(), same as closeMemberForm() — see router.js's popstate
    // handler for why this no longer causes a render flash (it skips the
    // redundant re-render when the popped snapshot already matches the
    // state we just set synchronously below).
    state.ui.memberForm = null;
    history.back();
  } catch (err) {
    alert('Could not save member: ' + err.message);
  } finally { setBusy(false); }
}

export function openAddMemberToGroup(gid) {
  if (isSuper()) return;
  if (!state.config.addMemberToGroupEnabled) return;
  state.ui.addMemberToGroup = { gid: gid, draftName: '' };
  render();
  pushNav();
}
export function closeAddMemberToGroup() { history.back(); }

export async function addExistingMemberToGroup(gid, memberId) {
  if (isSuper()) return;
  if (!state.config.addMemberToGroupEnabled) return;
  setBusy(true);
  try {
    await updateDoc(doc(db, 'groups', gid), { memberIds: arrayUnion(memberId) });
  } catch (err) {
    alert('Could not add member: ' + err.message);
  } finally { setBusy(false); }
}

export async function createAndAddMemberToGroup(gid) {
  if (isSuper()) return;
  if (!state.config.addMemberToGroupEnabled) return;
  var amg = state.ui.addMemberToGroup;
  if (!amg) return;
  var name = (amg.draftName || '').trim();
  if (!name) return;
  setBusy(true);
  try {
    var batch = writeBatch(db);
    var newMemberRef = doc(collection(db, 'members'));
    batch.set(newMemberRef, { name: name, createdAt: serverTimestamp() });
    batch.update(doc(db, 'groups', gid), { memberIds: arrayUnion(newMemberRef.id) });
    await batch.commit();
    amg.draftName = '';
  } catch (err) {
    alert('Could not add member: ' + err.message);
  } finally { setBusy(false); }
}

export async function removeMemberFromGroup(gid, mid) {
  if (isSuper()) return;
  var group = groupsById.get(gid);
  if (!group) return;
  if (memberHasPaidInGroup(gid, group, mid)) return;
  setBusy(true);
  try {
    await updateDoc(doc(db, 'groups', gid), { memberIds: arrayRemove(mid) });
  } catch (err) {
    alert('Could not remove member: ' + err.message);
  } finally { setBusy(false); }
}
