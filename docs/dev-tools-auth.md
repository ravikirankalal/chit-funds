# Dev tools: install & auth notes

Local CLI tool installs and auth state for `firebase`, `gcloud`, and `gh`, as set up on the primary dev Mac for this project.

None of these were installed via Homebrew — the `google-cloud-sdk` cask and the `gh` formula both required `sudo xcodebuild -license accept`, which needs an interactive password prompt. Standalone binaries were used instead.

## Firebase CLI (`firebase-tools`)

Already present via npm/nvm on `PATH`. Authenticated via `firebase login` as `ravikiran.kalal@gmail.com`. Credentials stored at `~/.config/configstore/firebase-tools.json`.

The login can go stale (expired refresh token) — if commands start failing with 401s, re-run:

```bash
firebase login --reauth
```

This needs a real browser and must be run interactively by the user — it can't be completed from a non-interactive shell/script.

## gcloud CLI

Installed standalone via Google's installer script (not Homebrew):

```bash
curl https://sdk.cloud.google.com | bash
```

Installed to `~/google-cloud-sdk`. Add it to `PATH` before use (not persisted to `~/.zshrc` yet):

```bash
export PATH="$HOME/google-cloud-sdk/bin:$PATH"
```

`gcloud auth login` was never completed (also needs an interactive browser). Instead, GCP REST APIs (Service Usage API, etc.) were called directly by exchanging the Firebase CLI's stored refresh token for an access token — Firebase's OAuth client already carries the `cloud-platform` scope. This is how the Firestore API was enabled and the Firestore database was created for the `localbc-41b52` project without ever needing `gcloud auth login`.

## GitHub CLI (`gh`)

Installed standalone (binary release `.zip` from `github.com/cli/cli/releases`, not Homebrew) to `~/bin/gh`. `~/bin` **is** on `PATH` via `~/.zshrc`, so `gh` is available in fresh terminal sessions without extra setup.

Authenticated via `gh auth login` (interactive, web browser flow) as GitHub user `ravikirankalal`, using SSH as the git protocol.

## Applying this later

Don't re-attempt `firebase login`, `gcloud auth login`, or `gh auth login` non-interactively — all three require a real browser and must be run by the user in their own terminal. Check status first before assuming any of these need setup again:

```bash
firebase login:list
gh auth status
# after exporting gcloud's PATH:
gcloud auth list
```

See also [firebase-project-setup.md](firebase-project-setup.md) for what these logins were used to set up.
