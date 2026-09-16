---
name: zool-install
description: Install, upgrade or roll back the ZOOL theme on a Komari or Nezha status panel. Use when asked to install zool / ZOOL theme on Komari or Nezha.
---

# ZOOL theme installation

Install the latest ZOOL release unless the user requests a specific version. Replace angle-bracket
placeholders with confirmed values before running commands. Stop on any failed step.

## Before you start

- Confirm the panel URL, requested action/version and access method with the user first.
  Komari needs an administrator session/account or server shell; Nezha needs server
  shell and the Docker Compose directory. Reuse authorized access; never guess
  credentials or request unnecessary secrets.
- Resolve `<data>` from the actual Komari data mount (the directory containing
  `komari.db` and `theme/`), and `<compose>` from the existing Nezha deployment.
  Record the current theme, installed version and relevant mounts before changes.
- Confirm with the user before destructive actions, including deleting directories,
  modifying/restoring a database, or restarting/recreating containers. Explain the
  exact action and impact; `docker compose up -d` may recreate containers.
  Never run `rm -rf` on an old theme directory.
- Use a fresh download/staging directory and a separate backup directory. Shell steps
  require curl, jq, unzip, tar and sha256sum; Komari database backups also need sqlite3.
  With admin-only access, have the server operator perform required backups before
  proceeding; report missing access instead of bypassing backups.

## Detect

```bash
curl -s 'https://<host>/api/public'
curl -s 'https://<host>/api/v1/setting'
```

Parse responses as JSON: `/api/public` containing a `theme` field (normally
`.data.theme`) identifies Komari; `/api/v1/setting` returning `success: true`
identifies Nezha. HTML, errors or ambiguous responses are not positive detection.
Record the panel version from its admin UI or deployment metadata: require
Komari >= 1.4 or Nezha dashboard v1. Do not infer the version from detection alone.

## Download

In the fresh download directory, run this in Bash, setting `panel` to the detected
`komari` or `nezha`. Fetch release metadata once and download exactly two assets;
do not use unbounded retries. Resolve URLs from the API, not guessed release paths.

```bash
set -euo pipefail
panel=komari
curl -fsSL 'https://api.github.com/repos/foru17/zool-theme/releases/latest' -o release.json
asset=$(jq -er --arg p "$panel" '
  [.assets[] | select(.name | test("^zool-" + $p + "-v[0-9]+\\.[0-9]+\\.[0-9]+\\.zip$"))]
  | if length == 1 then .[0].name else error("Expected one matching theme zip") end
' release.json)
zip_url=$(jq -er --arg n "$asset" '.assets[] | select(.name == $n) | .browser_download_url' release.json)
sums_url=$(jq -er '
  [.assets[] | select(.name == "SHA256SUMS")]
  | if length == 1 then .[0].browser_download_url else error("Missing or ambiguous SHA256SUMS") end
' release.json)
printf 'Release: %s; asset: %s\n' "$(jq -r .tag_name release.json)" "$asset"
```

Check that the release tag and asset version match the requested version before
continuing. If the user requested a version and latest is a different one, stop and report the
mismatch; do not silently install a different release. Expected names are
`zool-komari-v<version>.zip` and `zool-nezha-v<version>.zip`.

```bash
curl -fL "$zip_url" -o "$asset"
curl -fL "$sums_url" -o SHA256SUMS
```

## Verify checksum

Select exactly the downloaded filename; do not check unrelated release assets.
Run in the same Bash session and download directory:

```bash
awk -v file="$asset" '$2 == file || $2 == "*" file { print; count++ }
  END { if (count != 1) exit 1 }' SHA256SUMS > selected.SHA256SUMS
sha256sum -c selected.SHA256SUMS
```

Stop on missing/duplicate entries or a checksum mismatch; never extract or upload
an unverified zip. Inspect `unzip -l "$asset"` before extracting into a fresh stage:
Komari must contain `komari-theme.json`, `preview.png` and `dist/` (including
`dist/sw.js`); Nezha must contain `zool-dist/index.html` and `zool-dist/config.js`.
Reject unexpected absolute paths or parent-directory traversal entries.

## Back up

Use unique, timestamped backup filenames outside the served theme directory and
record their absolute paths. For a first install, record any absent directory
instead of attempting to archive it. Verify tar archives with `tar -tf`.

Komari: archive the existing `<data>/theme/zool-theme` directory:

```bash
tar -czf '<backup>/zool-komari-<timestamp>.tar.gz' -C '<data>/theme' zool-theme
```

Before switching themes, also take a consistent SQLite backup (not a live file copy):

```bash
sqlite3 '<data>/komari.db' ".backup '<backup>/komari-<timestamp>.db'"
sqlite3 '<backup>/komari-<timestamp>.db' 'PRAGMA integrity_check;'
```

Require `ok` from the integrity check. Record the original active theme.

Nezha: from `<compose>`, back up both the existing theme and Compose file:

```bash
tar -czf '<backup>/zool-nezha-<timestamp>.tar.gz' zool-dist
cp -p docker-compose.yaml '<backup>/docker-compose-<timestamp>.yaml'
```

Keep the existing `zool-dist/config.js` settings for the upgrade.

## Komari

**Method A — admin panel (recommended):** Open **Settings → Theme**, upload the
verified zip and enable **ZOOL**. For upgrades, ensure the uploader preserves old
`dist/assets/` files; if that cannot be established, use Method B with server access.

**Method B — server shell:** Extract the verified zip into `<stage>`, confirm
`komari-theme.json` has `short: zool-theme` and the requested version, then overlay:

```bash
unzip '<download>/zool-komari-v<version>.zip' -d '<stage>'
mkdir -p '<data>/theme/zool-theme'
cp -R '<stage>/.' '<data>/theme/zool-theme/'
```

The directory name must be `zool-theme`, matching the manifest's `short`. Select
**ZOOL** in the admin panel afterwards; with shell-only access, ask the operator to
perform this selection. Do not directly edit the database to activate the theme.
If a restart is needed, obtain confirmation before restarting the identified container.

For upgrades, **overlay files only; never delete old `dist/assets/` files**. Browsers
holding old HTML still need those hashed assets. Preserve the shipped `dist/sw.js`:
Komari has a built-in PWA, and ZOOL's worker replaces the stale worker, clears old
caches, unregisters itself and reloads clients. Do not delete `sw.js`.

## Nezha

Read `<compose>/data/config.yaml` first and record its exact `user_template` value,
commonly `user-dist` or `nazhua-dist`. Do not modify `config.yaml`; if the value is
absent or unclear, stop and resolve it with the operator.

Extract the verified zip into `<stage>` and overlay its `zool-dist/` next to the
Compose file:

```bash
unzip '<download>/zool-nezha-v<version>.zip' -d '<stage>'
mkdir -p '<compose>/zool-dist'
cp -R '<stage>/zool-dist/.' '<compose>/zool-dist/'
```

Upgrades must preserve all old `assets/` files. Restore the backed-up runtime
settings into `zool-dist/config.js` before serving the upgrade; settings live there,
not in `data/config.yaml`.

Add only this mount to the existing `dashboard` service's `volumes`, substituting
the exact template name; preserve all other mounts and configuration:

```yaml
- ./zool-dist:/dashboard/<user_template>:ro
```

If the mount already exists, do not duplicate it. From `<compose>`, validate with
`docker compose config --quiet`, then, after confirmation for any container
restart/recreation, run `docker compose up -d`. A file-only upgrade on an unchanged
mount does not require a restart.

## Verify

For Komari, confirm the API theme is `zool-theme`:

```bash
curl -s 'https://<host>/api/public' | jq -er '.data.theme'
```

For either panel, confirm the generator reports the installed release version:

```bash
curl -s 'https://<host>/' | grep -o 'generator" content="zool v[0-9.]*'
```

Open the homepage, confirm it renders without a blank screen, and hard-refresh once.
Check that assets load successfully. If browser access is unavailable, ask the user
to perform this check and report it as pending, not verified.

## Roll back

Overlay the recorded backup without deleting the current directory or hashed assets:

```bash
# Komari
tar -xzf '<backup>/zool-komari-<timestamp>.tar.gz' -C '<data>/theme'
# Nezha
tar -xzf '<backup>/zool-nezha-<timestamp>.tar.gz' -C '<compose>'
```

Komari file rollback needs no database change. If the active theme was switched,
select the original theme in the admin panel. Alternatively, after explicit
confirmation and coordinating a stopped database writer, restore the SQLite backup
with `sqlite3 '<data>/komari.db' ".restore '<backup>/komari-<timestamp>.db'"`;
this also rolls back other database changes since the backup.

Nezha: either restore the tar to return to the prior ZOOL version, or remove only the
added ZOOL volume line to return to the built-in template. The Compose backup records
the original configuration; preserve unrelated subsequent edits. After confirmation,
run `docker compose up -d` from `<compose>`. For a first install without a theme tar,
use the original-theme/mount-removal route. Repeat verification for the restored theme.

## Report

Tell the user the panel and installed ZOOL version, verification results (including
any pending checks), absolute backup paths and exact rollback commands using the
recorded paths. Never report success solely because file copying succeeded.
