# Chit-funds app: tasks

Companion: [state.md](state.md). Status key: [ ] open, [~] in progress, [x] done.
The owner has not given a chit-funds task list yet; items below are only the ones that came up
while working on weddings. Add real ones as they arrive.

## Open
- [ ] **Release `develop` to `main`.** `main` is ~180 commits behind; decide when to cut a release PR
      (`gh pr create --base main --head develop`) so CI deploys and tags it again.
- [ ] **Review the Firestore catch-all rule** (shared with weddings). Narrowing is possible but risky:
      verify collection-group queries first, ideally with the emulator.
- [ ] **No automated tests.** Decide whether to add a minimal smoke test or rules tests
      (`dev-emulator.sh` exists).

## Done
- [x] Winner-picker flow reworked (#74).
- [x] Handoff biometrics and direction fixes (#73); admin-transfer error message (#75).
